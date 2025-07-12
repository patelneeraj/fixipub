import JSZip from 'jszip';
import { db, type EpubMetadata, type StoredEpub } from './db';
import { epubStore } from '$lib/store/epub.svelte';

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

export async function saveSelectedFiles(files: File[]): Promise<void> {
	const parser = new DOMParser();
	let epubList: StoredEpub[] = [];

	for (let file of files) {
		if (!file) continue;

		if (!file.name.toLowerCase().endsWith('.epub')) {
			continue;
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
		} catch (err) {
			console.error(err);
		}
	}

	epubStore.epubList.push(...epubList);
}
