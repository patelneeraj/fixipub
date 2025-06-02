<script lang="ts">
	import JSZip from 'jszip';
	import { db, type EpubMetadata, type StoredEpub } from '$lib/db';
	import { CirclePlus, Trash, ArrowLeft, Download, Share, Share2 } from '@lucide/svelte';
	import FileDropzone from '$lib/components/FileDropzone.svelte';
	import DisplayMetadata from '$lib/components/DisplayMetadata.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { add } from 'dexie';

	onMount(async () => {
		await loadStoredEpubs();
	});

	function updateSelectedEpub(value: string) {
		const url = new URL(page.url);
		url.searchParams.set('id', value);
		goto(url.toString());
	}

	function removeSelectedEpub() {
		const url = new URL(page.url);
		url.searchParams.delete('id');
		goto(url.toString());
	}

	let showContextMenu = $state(false);
	let menuX = $state(0);
	let menuY = $state(0);

	let contextedEpub = $state<StoredEpub>();

	let selectedEpub = $derived.by(() => {
		let id = page.url.searchParams.get('id');
		if (id) {
			return epubList.find((epub) => {
				return epub.id?.toString() === id;
			});
		} else {
			return undefined;
		}
	});

	let loading: boolean = $state(false);
	let error: string | null = $state(null);
	let epubList = $state<StoredEpub[]>([]);
	let filter: string = $state('');
	let fileInputDialog: HTMLDialogElement | null = $state(null);
	let contextMenuElement: HTMLElement | null = $state(null);

	function changeToHtmlExtension(filename: string) {
		return filename.replace(/\.[^/.]+$/, '') + '.html';
	}

	const shareBook = async () => {
		showContextMenu = false;
		const file = new File(
			[contextedEpub?.data!],
			changeToHtmlExtension(contextedEpub?.metadata.title!),
			{
				type: 'text/html'
			}
		);

		try {
			if (navigator.canShare({ files: [file] })) {
				await navigator.share({
					title: `Share ${contextedEpub?.metadata.title} to Kindle`,
					files: [file],
					text: 'Open with Kindle app to read this book!'
				});
			}
		} catch (error) {}
	};

	// Mobile view state
	let showMetadata = $derived.by(() => {
		if (selectedEpub) {
			return true;
		} else {
			return false;
		}
	});

	function handleDocumentClick(e: MouseEvent) {
		if (showContextMenu) {
			// Check if the click is outside the menu
			if (contextMenuElement && !contextMenuElement.contains(e.target as Node)) {
				showContextMenu = false;
			}
		}
	}

	function handleEscape(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showContextMenu = false;
		}
	}

	function handleRightClick(e: MouseEvent, epub: StoredEpub) {
		e.preventDefault();

		contextedEpub = epub;
		showContextMenu = true;

		// Let the menu render, then adjust position
		tick().then(() => {
			if (!contextMenuElement) return;

			const menuRect = contextMenuElement.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			let x = e.clientX;
			let y = e.clientY;

			if (x + menuRect.width > viewportWidth) {
				x = viewportWidth - menuRect.width - 10;
			}
			if (y + menuRect.height > viewportHeight) {
				y = viewportHeight - menuRect.height - 10;
			}

			menuX = Math.max(0, x);
			menuY = Math.max(0, y);
		});
	}

	function deleteItem() {
		deleteStoredEpub(contextedEpub?.id!);
		showContextMenu = false;
	}

	function openDialog() {
		fileInputDialog!.showModal();
	}

	function closeDialog() {
		fileInputDialog!.close();
	}

	function handleEpubSelect(epub: StoredEpub) {
		updateSelectedEpub(epub.id?.toString()!);
	}

	function goBackToList() {
		removeSelectedEpub();
	}

	let filteredEpubList = $derived(
		epubList.filter((epub) => {
			return (
				epub.metadata.title.toLowerCase().includes(filter.toLowerCase()) ||
				epub.metadata.description.toLowerCase().includes(filter.toLowerCase()) ||
				epub.metadata.author.toLowerCase().includes(filter.toLowerCase()) ||
				epub.metadata.publisher.toLowerCase().includes(filter.toLowerCase()) ||
				epub.metadata.subjects.join(', ').toLowerCase().includes(filter.toLowerCase())
			);
		})
	);

	async function loadStoredEpubs() {
		epubList = await db.epubs.toArray();
	}

	async function deleteStoredEpub(id: number) {
		await db.epubs.delete(id);
		epubList = epubList.filter((epub) => {
			return epub.id !== id;
		});
	}

	function getCoverUrlFromBlob(blob: Blob | null): string | null {
		return blob ? URL.createObjectURL(blob) : null;
	}

	export async function getCoverBlob(zip: JSZip, coverPath: string): Promise<Blob | null> {
		try {
			const file = zip.file(coverPath);
			if (!file) return null;

			const blob = await file.async('blob');
			return blob;
		} catch (err) {
			console.error('Failed to extract cover blob:', err);
			return null;
		}
	}

	async function handleFileSelect(files: File[]): Promise<void> {
		closeDialog();
		const parser = new DOMParser();
		files.forEach(async (file) => {
			if (!file) return;

			if (!file.name.toLowerCase().endsWith('.epub')) {
				error = 'Please select an EPUB file';
				return;
			}

			try {
				const zip = await JSZip.loadAsync(file);

				let mimetypeFile = zip.files['mimetype'];

				let mimetype = await mimetypeFile.async('text');

				if (mimetype.trim() !== 'application/epub+zip') {
					throw new Error('Invalid Epub File');
				}

				let containerFile = zip.files['META-INF/container.xml'];

				let containerFileText = await containerFile.async('text');

				const parsedCF = parser.parseFromString(containerFileText, 'application/xml');

				const ns = 'urn:oasis:names:tc:opendocument:xmlns:container';
				const rootfileElement = parsedCF.getElementsByTagNameNS(ns, 'rootfile')[0];
				const opfPath = rootfileElement.getAttribute('full-path');
				if (!opfPath) {
					throw new Error('Invalid Epub file!');
				}

				let opfFile = zip.files[opfPath];
				let opfData = await opfFile.async('text');

				let metadata = parseOpfMetadata(opfData, opfPath, zip);
				const coverBlob = metadata.coverPath ? await getCoverBlob(zip, metadata.coverPath) : null;

				let newEpub: StoredEpub = {
					name: file.name,
					data: file,
					coverBlob,
					metadata,
					createdAt: new Date()
				};

				let addedEpubId = await db.epubs.add(newEpub);
				newEpub.id = addedEpubId;

				epubList.push(newEpub);
				//updateSelectedEpub(addedEpubId);
			} catch (err) {
				console.error(err);
			}
		});
	}

	export function parseOpfMetadata(
		opfXmlString: string,
		opfFilePath: string,
		zip: JSZip
	): EpubMetadata {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(opfXmlString, 'application/xml');

		const nsResolver: XPathNSResolver = (prefix: string | null) => {
			const ns: Record<string, string> = {
				dc: 'http://purl.org/dc/elements/1.1/',
				opf: 'http://www.idpf.org/2007/opf',
				dcterms: 'http://purl.org/dc/terms/'
			};
			return ns[prefix!] || null;
		};

		function getString(xpath: string): string {
			const result = xmlDoc.evaluate(xpath, xmlDoc, nsResolver, XPathResult.STRING_TYPE, null);
			return result.stringValue.trim();
		}

		function getIdentifiers(): Record<string, string> {
			const identifiers: Record<string, string> = {};
			const result = xmlDoc.evaluate(
				'//dc:identifier',
				xmlDoc,
				nsResolver,
				XPathResult.ORDERED_NODE_ITERATOR_TYPE,
				null
			);

			let node = result.iterateNext();
			while (node) {
				const element = node as Element;
				const scheme =
					element.getAttributeNS('http://www.idpf.org/2007/opf', 'scheme') ||
					element.getAttribute('opf:scheme');
				const value = element.textContent?.trim() || '';

				if (scheme && value) {
					// Convert scheme to lowercase and handle common mappings
					let key = scheme.toLowerCase();
					switch (key) {
						// Amazon identifiers
						case 'mobi-asin':
						case 'amazon-asin':
						case 'asin':
							key = 'asin';
							break;
						case 'amazon':
						case 'amazon-id':
							key = 'amzn';
							break;

						// ISBN variants
						case 'isbn':
						case 'isbn-10':
						case 'isbn10':
							key = 'isbn';
							break;
						case 'isbn-13':
						case 'isbn13':
							key = 'isbn13';
							break;

						// Google Books
						case 'google':
						case 'google-books':
						case 'googlebooks':
						case 'goog':
							key = 'google';
							break;

						// Goodreads
						case 'goodreads':
						case 'goodreads-id':
						case 'gr':
							key = 'goodreads';
							break;

						// Library identifiers
						case 'lccn':
						case 'library-of-congress':
							key = 'lccn';
							break;
						case 'oclc':
						case 'worldcat':
							key = 'oclc';
							break;
						case 'dewey':
						case 'ddc':
							key = 'dewey';
							break;

						// DOI and academic
						case 'doi':
							key = 'doi';
							break;
						case 'pmid':
						case 'pubmed':
							key = 'pmid';
							break;

						// Publisher specific
						case 'uuid':
						case 'guid':
							key = 'uuid';
							break;
						case 'uri':
						case 'url':
							key = 'uri';
							break;

						// Apple
						case 'apple':
						case 'apple-id':
						case 'itunes':
							key = 'apple';
							break;

						// Kobo
						case 'kobo':
						case 'kobo-id':
							key = 'kobo';
							break;

						// Barnes & Noble
						case 'bn':
						case 'barnes-noble':
						case 'nook':
							key = 'bn';
							break;

						// Project Gutenberg
						case 'gutenberg':
						case 'pg':
						case 'project-gutenberg':
							key = 'gutenberg';
							break;

						// Custom/Internal IDs
						case 'calibre':
						case 'calibre-id':
							key = 'calibre';
							break;
						case 'custom':
						case 'internal':
							key = 'custom';
							break;

						// Keep original if no mapping found
						default:
							// Remove common prefixes and clean up
							key = key.replace(/^(opf:|dc:|dcterms:)/, '');
							break;
					}
					identifiers[key] = value;
				}
				node = result.iterateNext();
			}

			return identifiers;
		}

		function getSubjects(): string[] {
			const subjects: string[] = [];
			const result = xmlDoc.evaluate(
				'//dc:subject',
				xmlDoc,
				nsResolver,
				XPathResult.ORDERED_NODE_ITERATOR_TYPE,
				null
			);

			let node = result.iterateNext();
			while (node) {
				const element = node as Element;
				const subject = element.textContent?.trim();

				if (subject) {
					subjects.push(subject);
				}
				node = result.iterateNext();
			}

			return subjects;
		}

		function getCover(): string | null {
			const nsResolver = (prefix: string | null): string | null => {
				if (prefix === 'opf') return 'http://www.idpf.org/2007/opf';
				return null;
			};

			const opfDir = opfFilePath.substring(0, opfFilePath.lastIndexOf('/'));

			// Try to get the cover ID from metadata
			const coverMetaResult = xmlDoc.evaluate(
				'//opf:metadata/opf:meta[@name="cover"]/@content',
				xmlDoc,
				nsResolver,
				XPathResult.STRING_TYPE,
				null
			);

			const coverId = coverMetaResult.stringValue.trim();

			let coverHref = '';

			if (coverId) {
				const manifestItemResult = xmlDoc.evaluate(
					`//opf:manifest/opf:item[@id="${coverId}"]/@href`,
					xmlDoc,
					nsResolver,
					XPathResult.STRING_TYPE,
					null
				);
				coverHref = manifestItemResult.stringValue.trim();

				if (coverHref) {
					// Always resolve relative to OPF dir
					coverHref = normalizePath(opfDir + '/' + coverHref);
					if (zip.files[coverHref]) {
						return coverHref;
					}
				}
			}

			// Fallback: search all files for a likely cover image
			const candidates = Object.keys(zip.files).filter((filename) => {
				const name = filename.toLowerCase();
				return /(^|\/)cover\.(jpe?g|png|gif|svg)$/.test(name);
			});

			for (const candidate of candidates) {
				// Check if candidate is in same folder or a subfolder of OPF dir
				const resolved = normalizePath(candidate);
				if (resolved.startsWith(opfDir)) {
					return resolved;
				}
			}

			if (zip.file(opfDir + '/' + coverId)) {
				return opfDir + '/' + coverId;
			}

			return null;
		}

		function normalizePath(path: string): string {
			const parts = path.split('/');
			const normalizedParts: string[] = [];

			for (const part of parts) {
				if (part === '.' || part === '') {
					continue;
				} else if (part === '..') {
					normalizedParts.pop();
				} else {
					normalizedParts.push(part);
				}
			}

			return normalizedParts.join('/');
		}

		const title = getString('//dc:title');
		const author = getString('//dc:creator');
		const description = getString('//dc:description');
		const language = getString('//dc:language');
		const publisher = getString('//dc:publisher');
		const identifiers = getIdentifiers();
		const subjects = getSubjects();
		const coverPath = getCover();

		return {
			title,
			author,
			description,
			language,
			identifiers,
			publisher,
			subjects,
			coverPath
		};
	}

	function handleDownload(blob: Blob, filename: string) {
		if (blob) {
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
	}
</script>

<svelte:document on:click={handleDocumentClick} on:keydown={handleEscape} />

{#if showContextMenu}
	<div
		bind:this={contextMenuElement}
		class="fixed z-50 shadow-lg"
		style="left: {menuX}px; top: {menuY}px;"
	>
		<ul class="menu bg-base-200 rounded-box w-56 border">
			<li class="menu-title line-clamp-1 py-1">
				{contextedEpub?.metadata.title}
			</li>
			<li><button onclick={deleteItem}><Trash />Delete</button></li>
			<li>
				<button
					onclick={() => {
						handleDownload(contextedEpub?.data!, contextedEpub?.metadata.title!);
					}}><Download /> Download</button
				>
			</li>

			{#if typeof navigator.share === 'function' && typeof navigator.canShare === 'function'}
				<li>
					<button
						onclick={() => {
							shareBook();
						}}><Share2 /> Share(Will Work For Kindle App Only)</button
					>
				</li>
			{/if}
		</ul>
	</div>
{/if}

<dialog bind:this={fileInputDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Upload your EPUB!</h3>
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2">✕</button>
		</form>
		<div class="dialog-body p-5">
			<FileDropzone accept=".epub" multiple={true} onFileSelect={handleFileSelect} />
		</div>
	</div>
</dialog>

<div class="flex h-full w-full flex-col lg:flex-row">
	<!-- EPUB List Section -->
	<div class="flex w-full min-w-min flex-col lg:w-1/3 {showMetadata ? 'hidden lg:flex' : 'flex'}">
		<div class="flex w-full flex-col gap-2 p-3 sm:flex-row sm:gap-4 sm:p-5">
			<button onclick={openDialog} class="btn btn-sm sm:btn-md whitespace-nowrap">
				<CirclePlus class="h-4 w-4 sm:h-5 sm:w-5" /> Add EPUB
			</button>
			<label
				class="input bg-base-200 input-sm sm:input-md flex w-full items-center gap-2 border-transparent ring-0 focus-within:border-transparent focus-within:ring-0 focus-within:outline-none"
			>
				<svg
					class="h-4 w-4 opacity-50 sm:h-5 sm:w-5"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
				>
					<g
						stroke-linejoin="round"
						stroke-linecap="round"
						stroke-width="2.5"
						fill="none"
						stroke="currentColor"
					>
						<circle cx="11" cy="11" r="8"></circle>
						<path d="m21 21-4.3-4.3"></path>
					</g>
				</svg>
				<input
					bind:value={filter}
					type="search"
					placeholder="Search"
					class="grow bg-transparent text-sm focus:border-transparent focus:ring-0 focus:outline-none sm:text-base"
				/>
			</label>
		</div>
		{#if filteredEpubList.length == 0}
			<div class=" flex h-full items-center justify-center text-gray-500">
				<p>Add an EPUB to get started</p>
			</div>
		{:else}
			<div
				class="grid h-full auto-rows-min grid-cols-2 gap-x-3 gap-y-10 overflow-auto p-3 sm:grid-cols-[repeat(auto-fit,_minmax(120px,_1fr))] sm:gap-x-4 sm:gap-y-5 sm:p-5 lg:grid-cols-[repeat(auto-fit,_minmax(175px,_1fr))]"
			>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				{#each filteredEpubList as epub}
					<button
						id="epubIcon_{epub.id}"
						onclick={() => {
							handleEpubSelect(epub);
						}}
						oncontextmenu={(e: MouseEvent) => {
							handleRightClick(e, epub);
						}}
						class="flex h-[180px] w-full justify-center sm:h-[220px] lg:h-[250px]"
					>
						<div
							class="flex aspect-[0.7/1] h-full flex-col overflow-hidden rounded-xl border lg:rounded-2xl {epub ==
							selectedEpub
								? 'border-primary border-2'
								: 'border-gray-500'}"
						>
							<div class="flex-1 overflow-hidden">
								{#if epub.coverBlob}
									<img
										src={getCoverUrlFromBlob(epub.coverBlob)}
										alt="No Cover"
										class="h-full w-full object-fill"
									/>
								{:else}
									<div
										class="bg-base-200 flex h-full w-full items-center justify-center rounded-lg shadow-lg"
									>
										<svg
											class="text-base-content/30 h-12 w-12"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
											/>
										</svg>
									</div>
								{/if}
							</div>

							<div
								class="flex h-[2rem] flex-col justify-center overflow-hidden px-1 text-center text-xs font-medium sm:h-[2.4rem] sm:px-2 sm:text-sm"
							>
								<div class="line-clamp-2 leading-[1rem] sm:leading-[1.2rem]">
									{epub.metadata.title}
								</div>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Divider (hidden on mobile) -->
	<div class="hidden h-full w-px bg-gray-300 lg:block"></div>

	<!-- Metadata Section -->
	<div class="h-full w-full lg:w-2/3 {showMetadata ? 'flex flex-col' : 'hidden lg:block'}">
		{#if selectedEpub}
			<!-- Mobile back button -->
			<div class="bg-base-100 flex w-full items-center border-b lg:hidden">
				<button onclick={goBackToList} class="btn btn-ghost btn-sm w-full justify-start text-left">
					<ArrowLeft class="h-4 w-4" /> Back to Library
				</button>
			</div>
			<div class="flex-1 overflow-auto">
				<DisplayMetadata bind:epub={selectedEpub}></DisplayMetadata>
			</div>
		{:else if !showMetadata}
			<div class="hidden h-full items-center justify-center text-gray-500 lg:flex">
				<p>Select an EPUB to view its metadata</p>
			</div>
		{/if}
	</div>
</div>
