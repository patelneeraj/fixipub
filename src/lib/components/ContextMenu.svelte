<script lang="ts">
	import { sharedComposables } from '$lib/contexts/conposableContexts';
	import { useEpubActions } from '$lib/services/epubActions';
	import { Download, Share2, Trash } from '@lucide/svelte';

	const { contextMenu } = sharedComposables;
	const epubActions = useEpubActions();

	const handleDeleteItem = async () => {
		if (contextMenu.contextedItem) {
			await epubActions.handleDelete(contextMenu.contextedItem);
			contextMenu.closeContextMenu();
		}
	};

	const handleDownloadItem = () => {
		if (contextMenu.contextedItem) {
			epubActions.handleDownload(contextMenu.contextedItem);
		}
	};

	const handleShareBook = () => {
		contextMenu.closeContextMenu();
		epubActions.handleShare();
	};

	const handleShareBookEpub = () => {
		contextMenu.closeContextMenu();
		epubActions.handleShareEpub();
	};
</script>

{#if contextMenu.showContextMenu}
	<div
		bind:this={contextMenu.contextMenuElement}
		class="fixed z-50 shadow-lg"
		style="left: {contextMenu.menuX}px; top: {contextMenu.menuY}px;"
	>
		<ul class="menu bg-base-200 rounded-box w-56 border">
			<li class="menu-title line-clamp-1 py-1">
				{contextMenu.contextedItem?.metadata.title}
			</li>
			<li><button onclick={handleDeleteItem}><Trash />Delete</button></li>
			<li><button onclick={handleDownloadItem}><Download /> Download</button></li>

			{#if typeof navigator.share === 'function' && typeof navigator.canShare === 'function'}
				<li>
					<button onclick={handleShareBook}><Share2 /> Share(Will Work For Kindle App Only)</button>
				</li>
				<li>
					<button onclick={handleShareBookEpub}
						><Share2 /> Share(Supposed to work only in Safari)</button
					>
				</li>
			{/if}
		</ul>
	</div>
{/if}
