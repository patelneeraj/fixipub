import { useContextMenu } from '$lib/composables/useContextMenu.svelte';
import { useEpubSearch } from '$lib/composables/useEpubSearch.svelte';
import { useDialog } from '$lib/composables/useDialog.svelte';
import { useCoverUrls } from '$lib/composables/useCoverUrls.svelte';
import { useEpubActions } from '$lib/services/epubActions';

// Create instances once when module loads
export const sharedComposables = {
	contextMenu: useContextMenu(),
	search: useEpubSearch(),
	fileDialog: useDialog(),
	coverUrls: useCoverUrls(),
	epubActions: useEpubActions()
};
