// $lib/composables/useCoverUrls.svelte.ts
import type { StoredEpub } from '$lib/services/db';
import { getCoverUrlFromBlob } from '$lib/services/utils';
import { epubStore } from '$lib/store/epub.svelte';

export function useCoverUrls() {
	let coverUrls = $derived.by(() => {
		const urls = new Map<number, string>();
		for (const epub of epubStore.epubList) {
			if (epub.coverBlob && epub.id) {
				urls.set(epub.id, getCoverUrlFromBlob(epub.coverBlob)!);
			}
		}
		return urls;
	});

	function getCoverUrl(epubId: number): string | undefined {
		return coverUrls.get(epubId);
	}

	return {
		get coverUrls() {
			return coverUrls;
		},
		getCoverUrl
	};
}
