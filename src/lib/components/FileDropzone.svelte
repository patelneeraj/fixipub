<script lang="ts">
	let fileInput: HTMLInputElement | null = $state(null);
	let isDragOver = $state(false);

	// File input properties
	let {
		accept = '*/*',
		multiple = false,
		onFileSelect
	}: { accept: string; multiple: boolean; onFileSelect: (files: File[]) => void } = $props();

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;

		const droppedFiles = Array.from(e.dataTransfer?.files || []);
		onFileSelect(droppedFiles);
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const selectedFiles = Array.from(target.files || []);
		onFileSelect(selectedFiles);
	}

	function openFilePicker() {
		fileInput!.click();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openFilePicker();
		}
	}

	// Reactive class string
	let dropzoneClass = $derived(
		[
			'border-2',
			'border-dashed',
			'rounded-lg',
			'p-8',
			'text-center',
			'cursor-pointer',
			'transition-all',
			'duration-200',
			'bg-base-100',
			'hover:border-primary',
			'hover:bg-primary/5',
			isDragOver ? 'border-primary bg-primary/10 scale-105' : 'border-base-300'
		].join(' ')
	);
</script>

<div class="w-full">
	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		{multiple}
		onchange={handleFileSelect}
		class="hidden"
	/>

	<!-- Dropzone area -->
	<div
		class={dropzoneClass}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={openFilePicker}
		role="button"
		tabindex="0"
		onkeydown={handleKeydown}
	>
		<div class="flex flex-col items-center gap-4">
			<!-- Upload icon -->
			<svg
				class="text-base-content/60 h-12 w-12"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
				/>
			</svg>

			<div class="space-y-2">
				<h3 class="text-base-content text-lg font-semibold">Drop files here or click to browse</h3>
				<p class="text-base-content/70 text-sm">
					{#if accept !== '*/*'}
						Accepted formats: <span class="font-medium">{accept}</span><br />
					{/if}
					{#if multiple}
						You can select multiple files
					{:else}
						Select a file to upload
					{/if}
				</p>
			</div>
		</div>
	</div>
</div>
