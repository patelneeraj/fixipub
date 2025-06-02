<script lang="ts">
	import { db, type EpubMetadata, type StoredEpub } from '$lib/db';
	import { rebuildEpubWithMetadata, updateEpubInDatabase } from '$lib/rebuild';

	interface Props {
		epub: StoredEpub;
	}

	let { epub = $bindable() }: Props = $props();

	// Edit state
	let isEditing = $state(false);
	let editedMetadata = $state({
		title: '',
		author: '',
		publisher: '',
		language: '',
		description: '',
		subjects: [] as string[],
		identifiers: {} as Record<string, string>
	});

	// Cover handling
	let coverUrl = $state<string | null>(null);
	let newCoverFile = $state<File | null>(null);
	let coverFileInput = $state<HTMLInputElement>();

	// Image resizing controls
	let showResizeControls = $state(false);
	let resizeWidth = $state(1200);
	let resizeHeight = $state(1600);
	let isResizing = $state(false);

	// Initialize cover URL once and memoize it
	let currentCoverBlob = $state<Blob | null>(null);

	// Only update cover URL when blob actually changes
	$effect(() => {
		const blob = epub.coverBlob;
		if (blob !== currentCoverBlob) {
			// Clean up previous URL
			if (coverUrl) {
				URL.revokeObjectURL(coverUrl);
			}

			if (blob) {
				coverUrl = URL.createObjectURL(blob);
			} else {
				coverUrl = null;
			}
			currentCoverBlob = blob;
		}
	});

	// Clean up URL when component is destroyed
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (coverUrl) {
			URL.revokeObjectURL(coverUrl);
		}
	});

	// Format creation date - memoized
	let formattedDate = $derived.by(() => {
		return epub.createdAt.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	});

	function sizeFormatter(bytes: number) {
		const kb = bytes / 1024;
		if (kb < 1024) {
			return `${Math.round(kb)} kB`;
		}
		const mb = kb / 1024;
		return `${mb.toFixed(2)} MB`;
	}

	// Cover resizing function
	async function resizeCoverImage(
		file: File | Blob,
		targetWidth: number,
		targetHeight: number
	): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			if (!ctx) {
				reject(new Error('Could not get canvas context'));
				return;
			}

			img.onload = () => {
				// Set canvas dimensions to target size
				canvas.width = targetWidth;
				canvas.height = targetHeight;

				// Stretch/compress the image to fit exactly the target dimensions
				// This will change the aspect ratio to match the target dimensions
				ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

				// Convert canvas to blob
				canvas.toBlob(
					(blob) => {
						if (blob) {
							resolve(blob);
						} else {
							reject(new Error('Failed to create blob from canvas'));
						}
					},
					'image/jpeg',
					0.9
				); // High quality JPEG
			};

			img.onerror = () => {
				reject(new Error('Failed to load image'));
			};

			// Create object URL and load the image
			const objectUrl = URL.createObjectURL(file);
			img.src = objectUrl;
		});
	}

	// Initialize edit form
	function startEdit() {
		editedMetadata = {
			title: epub.metadata.title || '',
			author: epub.metadata.author || '',
			publisher: epub.metadata.publisher || '',
			language: epub.metadata.language || '',
			description: epub.metadata.description || '',
			subjects: [...(epub.metadata.subjects || [])],
			identifiers: { ...(epub.metadata.identifiers || {}) }
		};
		newCoverFile = null;
		showResizeControls = false;
		isEditing = true;
	}

	// Cancel edit
	function cancelEdit() {
		isEditing = false;
		newCoverFile = null;
		showResizeControls = false;
		editedMetadata = {
			title: '',
			author: '',
			publisher: '',
			language: '',
			description: '',
			subjects: [],
			identifiers: {}
		};
	}

	// Handle cover file selection
	async function handleCoverChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file && file.type.startsWith('image/')) {
			newCoverFile = file;
			showResizeControls = true; // Show resize controls when a new image is selected
		}
	}

	// Show resize controls for existing cover
	function showResizeControlsForExisting() {
		if (epub.coverBlob || newCoverFile) {
			showResizeControls = true;
		}
	}

	// Handle manual resize
	async function handleResize() {
		const imageToResize = newCoverFile || epub.coverBlob;
		if (!imageToResize) return;

		try {
			isResizing = true;
			// Resize the image to the specified dimensions
			const resizedBlob = await resizeCoverImage(imageToResize, resizeWidth, resizeHeight);

			// Create a new File object from the resized blob
			newCoverFile = new File([resizedBlob], newCoverFile?.name || 'cover.jpg', {
				type: 'image/jpeg',
				lastModified: Date.now()
			});

			showResizeControls = false; // Hide controls after resizing
		} catch (error) {
			console.error('Error resizing cover image:', error);
		} finally {
			isResizing = false;
		}
	}

	async function saveChanges() {
		try {
			// Create a clean copy of the epub object for Dexie
			const updatedEpub: StoredEpub = {
				...epub,
				// Handle cover update - convert File to Blob if needed
				coverBlob: newCoverFile || epub.coverBlob,
				// Update metadata with cleaned values
				metadata: {
					...epub.metadata,
					title: editedMetadata.title,
					author: editedMetadata.author,
					publisher: editedMetadata.publisher,
					language: editedMetadata.language,
					description: editedMetadata.description,
					subjects: editedMetadata.subjects.filter((s) => s.trim() !== '') || undefined,
					identifiers: Object.fromEntries(
						Object.entries(editedMetadata.identifiers).filter(([k, v]) => k.trim() && v.trim())
					)
				}
			};

			// Save to Dexie
			await db.epubs.put(updatedEpub);
			await updateEpubInDatabase(db, updatedEpub);
			const newEpubBlob = (await db.epubs.get(updatedEpub.id))?.data;

			//Update local epub object
			epub.coverBlob = updatedEpub.coverBlob;
			epub.metadata = updatedEpub.metadata;
			epub.data = newEpubBlob!;

			isEditing = false;
			newCoverFile = null;
			showResizeControls = false;
		} catch (error: any) {
			console.error('Error saving changes:', error);
		}
	}

	// Subject management
	function addSubject() {
		editedMetadata.subjects = [...editedMetadata.subjects, ''];
	}

	function removeSubject(index: number) {
		editedMetadata.subjects = editedMetadata.subjects.filter((_, i) => i !== index);
	}

	function updateSubject(index: number, event: Event) {
		const target = event.target as HTMLInputElement;
		editedMetadata.subjects[index] = target.value;
	}

	// Identifier management
	function addIdentifier() {
		const newKey = `identifier-${Date.now()}`;
		editedMetadata.identifiers = {
			...editedMetadata.identifiers,
			[newKey]: ''
		};
	}

	function removeIdentifier(key: string) {
		const { [key]: removed, ...rest } = editedMetadata.identifiers;
		editedMetadata.identifiers = rest;
	}

	function updateIdentifierKey(oldKey: string, event: Event) {
		const target = event.target as HTMLInputElement;
		const newKey = target.value;
		if (newKey && newKey !== oldKey) {
			const value = editedMetadata.identifiers[oldKey];
			const { [oldKey]: removed, ...rest } = editedMetadata.identifiers;
			editedMetadata.identifiers = {
				...rest,
				[newKey]: value
			};
		}
	}

	function updateIdentifierValue(key: string, event: Event) {
		const target = event.target as HTMLInputElement;
		editedMetadata.identifiers = {
			...editedMetadata.identifiers,
			[key]: target.value
		};
	}
</script>

<div class="h-full overflow-y-auto">
	<div class="card bg-base-100 mx-auto w-full max-w-4xl">
		<div class="card-body p-4 sm:p-6 lg:p-8">
			<!-- Edit Controls -->
			<div class="mb-4 flex justify-end">
				{#if !isEditing}
					<button class="btn btn-primary btn-sm" onclick={startEdit}>
						<svg class="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.828-2.828z"
							/>
						</svg>
						Edit
					</button>
				{:else}
					<div class="flex gap-2">
						<button class="btn btn-success btn-sm" onclick={saveChanges}>
							<svg class="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
							Save
						</button>
						<button class="btn btn-ghost btn-sm" onclick={cancelEdit}>
							<svg class="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
							Cancel
						</button>
					</div>
				{/if}
			</div>

			<!-- Header Section -->
			<div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
				<!-- Cover Image -->
				<div class="mx-auto flex-shrink-0 lg:mx-0">
					<div class="relative">
						{#if coverUrl || newCoverFile}
							<div class="">
								<div class="h-48 max-w-64 min-w-24 rounded-lg shadow-lg sm:h-60 lg:h-72">
									<img
										src={newCoverFile ? URL.createObjectURL(newCoverFile) : coverUrl}
										alt="Book cover for {epub.metadata.title}"
										class="h-full rounded-lg object-cover"
									/>
								</div>
							</div>
						{:else}
							<div
								class="bg-base-200 flex h-48 w-32 items-center justify-center rounded-lg shadow-lg sm:h-60 sm:w-40 lg:h-72 lg:w-48"
							>
								<svg class="text-base-content/30 h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
									/>
								</svg>
							</div>
						{/if}

						{#if isEditing}
							<div class="absolute -right-2 -bottom-2">
								<!-- svelte-ignore a11y_consider_explicit_label -->
								<button
									class="btn btn-circle btn-sm btn-primary"
									onclick={() => coverFileInput?.click()}
								>
									<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
										<path
											d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.828-2.828z"
										/>
									</svg>
								</button>
								<input
									bind:this={coverFileInput}
									type="file"
									accept="image/*"
									class="hidden"
									onchange={handleCoverChange}
								/>
							</div>
						{/if}
					</div>

					<!-- Cover controls and resize options -->
					{#if isEditing}
						<div class="mt-3 space-y-3">
							<!-- Cover file info -->
							{#if newCoverFile}
								<div class="text-center">
									<span class="text-success block text-xs">Cover selected: {newCoverFile.name}</span
									>
									<span class="text-info text-xs">Size: {sizeFormatter(newCoverFile.size)}</span>
								</div>
							{/if}

							<!-- Show resize button for existing or new cover -->
							{#if (epub.coverBlob || newCoverFile) && !showResizeControls}
								<div class="text-center">
									<button class="btn btn-outline btn-sm" onclick={showResizeControlsForExisting}>
										<svg class="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
												clip-rule="evenodd"
											/>
										</svg>
										Resize Cover
									</button>
								</div>
							{/if}

							<!-- Resize Controls -->
							{#if showResizeControls}
								<div class="bg-base-200 space-y-3 rounded-lg p-3">
									<div class="text-center">
										<span class="text-sm font-medium">Resize Cover</span>
									</div>
									<div class="flex gap-2">
										<div class="flex-1">
											<!-- svelte-ignore a11y_label_has_associated_control -->
											<label class="label py-1">
												<span class="label-text text-xs">Width</span>
											</label>
											<input
												type="number"
												bind:value={resizeWidth}
												class="input input-bordered input-sm w-full"
												min="100"
												max="4000"
											/>
										</div>
										<div class="flex-1">
											<!-- svelte-ignore a11y_label_has_associated_control -->
											<label class="label py-1">
												<span class="label-text text-xs">Height</span>
											</label>
											<input
												type="number"
												bind:value={resizeHeight}
												class="input input-bordered input-sm w-full"
												min="100"
												max="4000"
											/>
										</div>
									</div>
									<div class="flex gap-2">
										<button
											class="btn btn-primary btn-sm flex-1"
											class:loading={isResizing}
											onclick={handleResize}
											disabled={isResizing}
										>
											{#if isResizing}
												Resizing...
											{:else}
												<svg class="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
													<path
														fill-rule="evenodd"
														d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
														clip-rule="evenodd"
													/>
												</svg>
												Resize
											{/if}
										</button>
										<button
											class="btn btn-ghost btn-sm"
											onclick={() => (showResizeControls = false)}
											disabled={isResizing}
										>
											Cancel
										</button>
									</div>
								</div>{/if}
						</div>
					{/if}
				</div>

				<!-- Main Info -->
				<div class="flex-1 space-y-4">
					<!-- Title -->
					<div>
						{#if isEditing}
							<input
								type="text"
								bind:value={editedMetadata.title}
								class="input input-bordered input-primary w-full text-2xl font-bold"
								placeholder="Enter title"
							/>
						{:else}
							<h1 class="text-primary text-2xl leading-tight font-bold sm:text-3xl lg:text-4xl">
								{epub.metadata.title || 'Untitled'}
							</h1>
						{/if}
					</div>

					<!-- Author -->
					<div class="flex items-center gap-2">
						<svg
							class="text-secondary h-5 w-5 flex-shrink-0"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
								clip-rule="evenodd"
							/>
						</svg>
						{#if isEditing}
							<input
								type="text"
								bind:value={editedMetadata.author}
								class="input input-bordered input-secondary flex-1 text-lg font-semibold"
								placeholder="Enter author name"
							/>
						{:else}
							<span class="text-secondary text-lg font-semibold sm:text-xl">
								{epub.metadata.author || 'Unknown Author'}
							</span>
						{/if}
					</div>

					<!-- Publisher & Language -->
					<div class="flex flex-col gap-4 text-sm sm:flex-row">
						{#if isEditing}
							<input
								type="text"
								bind:value={editedMetadata.publisher}
								class="input input-bordered input-sm"
								placeholder="Publisher"
							/>
							<input
								type="text"
								bind:value={editedMetadata.language}
								class="input input-bordered input-sm"
								placeholder="Language (e.g., en, es, fr)"
							/>
						{:else}
							{#if epub.metadata.publisher}
								<div class="badge badge-outline badge-primary">
									📚 {epub.metadata.publisher}
								</div>
							{:else if isEditing}
								<input
									type="text"
									bind:value={editedMetadata.publisher}
									class="input input-bordered input-sm"
									placeholder="Publisher"
								/>
							{/if}
							{#if epub.metadata.language}
								<div class="badge badge-outline badge-secondary">
									🌐 {epub.metadata.language.toUpperCase()}
								</div>
							{:else if isEditing}
								<input
									type="text"
									bind:value={editedMetadata.language}
									class="input input-bordered input-sm"
									placeholder="Language"
								/>
							{/if}
						{/if}
					</div>

					<!-- Creation Date -->
					<div class="text-base-content/70 text-sm">
						Added on {formattedDate}
					</div>
					<div class="text-base-content/70 text-sm">
						Size: {sizeFormatter(epub.data.size)}
					</div>
				</div>
			</div>

			<!-- Description -->
			<div class="divider my-6"></div>
			<div class="space-y-2">
				<h3 class="text-accent text-lg font-semibold">Description</h3>
				{#if isEditing}
					<textarea
						bind:value={editedMetadata.description}
						class="textarea textarea-bordered min-h-32 w-full"
						placeholder="Enter book description"
					></textarea>
				{:else if epub.metadata.description}
					<div class="description-content text-base-content/80 leading-relaxed">
						{@html epub.metadata.description}
					</div>
				{:else}
					<div class="text-base-content/50 italic">No description available</div>
				{/if}
			</div>

			<!-- Subjects/Tags -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="text-accent text-lg font-semibold">Subjects</h3>
					{#if isEditing}
						<button class="btn btn-sm btn-ghost" onclick={addSubject}>
							<svg class="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
									clip-rule="evenodd"
								/>
							</svg>
							Add Subject
						</button>
					{/if}
				</div>
				{#if isEditing}
					<div class="space-y-2">
						{#each editedMetadata.subjects as subject, index}
							<div class="flex items-center gap-2">
								<input
									type="text"
									value={subject}
									oninput={(e) => updateSubject(index, e)}
									class="input input-bordered input-sm flex-1"
									placeholder="Enter subject"
								/>
								<!-- svelte-ignore a11y_consider_explicit_label -->
								<button
									class="btn btn-sm btn-ghost btn-circle"
									onclick={() => removeSubject(index)}
								>
									<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</div>
						{/each}
						{#if editedMetadata.subjects.length === 0}
							<div class="text-base-content/50 text-sm">No subjects added yet</div>
						{/if}
					</div>
				{:else if epub.metadata.subjects && epub.metadata.subjects.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each epub.metadata.subjects as subject}
							<div class="badge badge-ghost badge-sm">
								{subject}
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-base-content/50 italic">No subjects available</div>
				{/if}
			</div>

			<!-- Identifiers -->
			<div class="divider my-6"></div>
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="text-accent text-lg font-semibold">Identifiers</h3>
					{#if isEditing}
						<button class="btn btn-sm btn-ghost" onclick={addIdentifier}>
							<svg class="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
									clip-rule="evenodd"
								/>
							</svg>
							Add Identifier
						</button>
					{/if}
				</div>
				{#if isEditing}
					<div class="space-y-3">
						{#each Object.entries(editedMetadata.identifiers) as [key, value]}
							<div class="bg-base-200 space-y-2 rounded-lg p-3">
								<div class="flex items-center gap-2">
									<input
										type="text"
										value={key}
										oninput={(e) => updateIdentifierKey(key, e)}
										class="input input-bordered input-sm flex-1"
										placeholder="Identifier type (e.g., ISBN, DOI)"
									/>
									<!-- svelte-ignore a11y_consider_explicit_label -->
									<button
										class="btn btn-sm btn-ghost btn-circle"
										onclick={() => removeIdentifier(key)}
									>
										<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
												clip-rule="evenodd"
											/>
										</svg>
									</button>
								</div>
								<input
									type="text"
									{value}
									oninput={(e) => updateIdentifierValue(key, e)}
									class="input input-bordered input-sm w-full font-mono"
									placeholder="Identifier value"
								/>
							</div>
						{/each}
						{#if Object.keys(editedMetadata.identifiers).length === 0}
							<div class="text-base-content/50 text-sm">No identifiers added yet</div>
						{/if}
					</div>
				{:else if epub.metadata.identifiers && Object.keys(epub.metadata.identifiers).length > 0}
					<div class="grid grid-cols-1 gap-3">
						{#each Object.entries(epub.metadata.identifiers) as [type, value]}
							<div
								class="bg-base-200 flex flex-col gap-2 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between"
							>
								<span
									class="text-base-content/70 flex-shrink-0 text-sm font-medium tracking-wide uppercase"
								>
									{type}
								</span>
								<span class="text-base-content text-right font-mono text-sm break-all select-all">
									{value}
								</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-base-content/50 italic">No identifiers available</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* HTML content styling for description */
	.description-content :global(p) {
		margin-bottom: 1rem;
	}

	.description-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.description-content :global(strong) {
		font-weight: 600;
	}

	.description-content :global(em) {
		font-style: italic;
	}

	.description-content :global(a) {
		color: oklch(var(--p));
		text-decoration: underline;
	}

	.description-content :global(ul),
	.description-content :global(ol) {
		margin: 1rem 0;
		padding-left: 1.5rem;
	}

	.description-content :global(li) {
		margin-bottom: 0.5rem;
	}

	.description-content :global(h1),
	.description-content :global(h2),
	.description-content :global(h3),
	.description-content :global(h4),
	.description-content :global(h5),
	.description-content :global(h6) {
		font-weight: 600;
		margin: 1rem 0 0.5rem 0;
	}

	.description-content :global(blockquote) {
		border-left: 4px solid oklch(var(--b3));
		padding-left: 1rem;
		margin: 1rem 0;
		font-style: italic;
	}

	/* Custom styles for better text wrapping and responsiveness */
	.select-all {
		user-select: all;
	}
</style>
