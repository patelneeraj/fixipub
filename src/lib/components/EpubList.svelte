<script lang="ts">
	import { sharedComposables } from '$lib/contexts/conposableContexts';
	import { epubStore } from '$lib/store/epub.svelte';
	import { CirclePlus } from '@lucide/svelte';
	import EpubTile from './EpubTile.svelte';
	import EpubSearchBar from './EpubSearchBar.svelte';

	const { fileDialog, search } = sharedComposables;
</script>

<div
	class="flex w-full min-w-min flex-col lg:w-1/3 {epubStore.showMetadata
		? 'hidden lg:flex'
		: 'flex'}"
>
	<div class="flex w-full flex-col gap-2 p-3 sm:flex-row sm:gap-4 sm:p-5">
		<button onclick={fileDialog.openDialog} class="btn btn-sm sm:btn-md whitespace-nowrap">
			<CirclePlus class="h-4 w-4 sm:h-5 sm:w-5" /> Add EPUB
		</button>
		<EpubSearchBar />
	</div>

	{#if search.filteredEpubList.length === 0}
		<div class="flex h-full items-center justify-center text-gray-500">
			<p>Add an EPUB to get started</p>
		</div>
	{:else}
		<div
			class="grid h-full auto-rows-min grid-cols-2 gap-x-3 gap-y-10 overflow-auto p-3 sm:grid-cols-[repeat(auto-fit,_minmax(120px,_1fr))] sm:gap-x-4 sm:gap-y-5 sm:p-5 lg:grid-cols-[repeat(auto-fit,_minmax(175px,_1fr))]"
		>
			{#each search.filteredEpubList as epub (epub.id)}
				<EpubTile {epub} />
			{/each}
		</div>
	{/if}
</div>
