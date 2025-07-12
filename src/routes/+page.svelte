<script lang="ts">
	import DisplayMetadata from '$lib/components/DisplayMetadata.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import FileDialog from '$lib/components/FileDialog.svelte';
	import EpubList from '$lib/components/EpubList.svelte';
	import Divider from '$lib/components/Divider.svelte';
	import { sharedComposables } from '$lib/contexts/conposableContexts';
	import { onMount } from 'svelte';
	import { epubStore } from '$lib/store/epub.svelte';

	onMount(async () => {
		await epubStore.loadEpubs();
	});
</script>

<svelte:document
	on:click={sharedComposables.contextMenu.handleDocumentClick}
	on:keydown={sharedComposables.contextMenu.handleEscape}
/>
<ContextMenu />
<FileDialog />
<div class="flex h-full w-full flex-col overflow-auto lg:flex-row">
	<EpubList />
	<Divider />
	<DisplayMetadata />
</div>
