<script lang="ts">
	import type { StoredEpub } from '$lib/db';

	export let epub: StoredEpub;

	// Convert Blob to URL for cover image display
	let coverUrl: string | null = null;

	$: if (epub.coverBlob) {
		// Clean up previous URL to prevent memory leaks
		if (coverUrl) {
			URL.revokeObjectURL(coverUrl);
		}
		coverUrl = URL.createObjectURL(epub.coverBlob);
	}

	// Clean up URL when component is destroyed
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (coverUrl) {
			URL.revokeObjectURL(coverUrl);
		}
	});

	// Format creation date
	$: formattedDate = epub.createdAt.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
</script>

<div class="h-full overflow-y-auto">
	<div class="card bg-base-100 mx-auto w-full max-w-4xl shadow-xl">
		<div class="card-body p-4 sm:p-6 lg:p-8">
			<!-- Header Section -->
			<div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
				<!-- Cover Image -->
				<div class="mx-auto flex-shrink-0 lg:mx-0">
					{#if coverUrl}
						<div class="avatar">
							<div class="h-48 w-32 rounded-lg shadow-lg sm:h-60 sm:w-40 lg:h-72 lg:w-48">
								<img
									src={coverUrl}
									alt="Book cover for {epub.metadata.title}"
									class="h-full w-full rounded-lg object-cover"
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
				</div>

				<!-- Main Info -->
				<div class="flex-1 space-y-4">
					<!-- Title -->
					<div>
						<h1 class="text-primary text-2xl leading-tight font-bold sm:text-3xl lg:text-4xl">
							{epub.metadata.title || 'Untitled'}
						</h1>
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
						<span class="text-secondary text-lg font-semibold sm:text-xl">
							{epub.metadata.author || 'Unknown Author'}
						</span>
					</div>

					<!-- Publisher & Language -->
					<div class="flex flex-col gap-4 text-sm sm:flex-row">
						{#if epub.metadata.publisher}
							<div class="badge badge-outline badge-primary">
								📚 {epub.metadata.publisher}
							</div>
						{/if}
						{#if epub.metadata.language}
							<div class="badge badge-outline badge-secondary">
								🌐 {epub.metadata.language.toUpperCase()}
							</div>
						{/if}
					</div>

					<!-- Creation Date -->
					<div class="text-base-content/70 text-sm">
						Added on {formattedDate}
					</div>
				</div>
			</div>

			<!-- Description -->
			{#if epub.metadata.description}
				<div class="divider my-6"></div>
				<div class="space-y-2">
					<h3 class="text-accent text-lg font-semibold">Description</h3>
					<div class="description-content text-base-content/80 leading-relaxed">
						{@html epub.metadata.description}
					</div>
				</div>
			{/if}

			<!-- Subjects/Tags -->
			{#if epub.metadata.subjects && epub.metadata.subjects.length > 0}
				<div class="space-y-3">
					<h3 class="text-accent text-lg font-semibold">Subjects</h3>
					<div class="flex flex-wrap gap-2">
						{#each epub.metadata.subjects as subject}
							<div class="badge badge-ghost badge-sm">
								{subject}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Identifiers -->
			{#if epub.metadata.identifiers && Object.keys(epub.metadata.identifiers).length > 0}
				<div class="divider my-6"></div>
				<div class="space-y-3">
					<h3 class="text-accent text-lg font-semibold">Identifiers</h3>
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
				</div>
			{/if}
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
	/* .prose p {
		word-wrap: break-word;
		overflow-wrap: break-word;
	} */

	/* Ensure long identifiers can be selected and don't overflow */
	.select-all {
		user-select: all;
	}
</style>
