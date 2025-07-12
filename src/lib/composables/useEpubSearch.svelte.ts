// $lib/composables/useEpubSearch.svelte.ts
import type { StoredEpub } from '$lib/services/db';
import { epubStore } from '$lib/store/epub.svelte';

export function useEpubSearch() {
	let filter = $state('');

	let searchableEpubList = $derived(
		epubStore.epubList.map((epub) => ({
			...epub,
			searchText: [
				epub.metadata.title,
				epub.metadata.description,
				epub.metadata.author,
				epub.metadata.publisher,
				epub.metadata.subjects.join(', ')
			]
				.join(' ')
				.toLowerCase()
		}))
	);

	let filteredEpubList = $derived(
		filter.trim() === ''
			? epubStore.epubList
			: searchableEpubList.filter((epub) => epub.searchText.includes(filter.toLowerCase()))
	);

	function clearFilter() {
		filter = '';
	}

	return {
		get filter() {
			return filter;
		},
		set filter(value: string) {
			filter = value;
		},
		get filteredEpubList() {
			return filteredEpubList;
		},
		clearFilter
	};
}
