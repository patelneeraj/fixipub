import { page } from '$app/state';
import { db, type StoredEpub } from '$lib/services/db';

class EpubStore {
	epubList = $state<StoredEpub[]>([]);

	isLoading = $state(false);

	selectedEpub: StoredEpub | undefined = $derived.by(() => {
		let id = page.url.searchParams.get('id');
		if (id) {
			return epubStore.epubList.find((epub) => {
				return epub.id?.toString() === id;
			});
		} else {
			return undefined;
		}
	});

	showMetadata = $derived(!!this.selectedEpub);

	async loadEpubs() {
		if (this.isLoading) return;
		this.isLoading = true;
		this.epubList = await db.epubs.toArray();
		this.isLoading = false;
	}
}

export const epubStore = new EpubStore();
