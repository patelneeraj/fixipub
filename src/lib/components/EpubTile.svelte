<script lang="ts">
	import { sharedComposables } from '$lib/contexts/conposableContexts';
	import { epubStore } from '$lib/store/epub.svelte';

	const { epub } = $props();
	const { epubActions, contextMenu, coverUrls } = sharedComposables;
</script>

<button
	id="epubIcon_{epub.id}"
	onclick={() => epubActions.handleSelect(epub)}
	oncontextmenu={(e) => contextMenu.handleRightClick(e, epub)}
	class="flex h-[180px] w-full justify-center sm:h-[220px] lg:h-[250px]"
>
	<div
		class="flex aspect-[0.7/1] h-full flex-col overflow-hidden rounded-xl border lg:rounded-2xl {epub ===
		epubStore.selectedEpub
			? 'border-primary border-2'
			: 'border-gray-500'}"
	>
		<div class="flex-1 overflow-hidden">
			{#if epub.coverBlob}
				<img
					src={coverUrls.getCoverUrl(epub.id!)}
					alt="No Cover"
					class="h-full w-full object-fill"
				/>
			{:else}
				<div
					class="bg-base-200 flex h-full w-full items-center justify-center rounded-lg shadow-lg"
				>
					<svg class="text-base-content/30 h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
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
