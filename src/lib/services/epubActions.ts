import { deleteStoredEpub, type StoredEpub } from '$lib/services/db';
import { handleDownload, shareBook, shareBookEpub, updateSelectedEpub } from '$lib/services/utils';

export class EpubActions {
	static handleSelect(epub: StoredEpub) {
		updateSelectedEpub(epub.id?.toString()!);
	}

	static async handleDelete(epub: StoredEpub) {
		if (!epub.id) return;
		await deleteStoredEpub(epub.id);
	}

	static handleDownload(epub: StoredEpub) {
		if (!epub.data || !epub.metadata.title) return;
		handleDownload(epub.data, epub.metadata.title);
	}

	static async handleShare() {
		await shareBook();
	}

	static async handleShareEpub() {
		await shareBookEpub();
	}
}

export function useEpubActions() {
	const handleSelect = (epub: StoredEpub) => EpubActions.handleSelect(epub);
	const handleDelete = (epub: StoredEpub) => EpubActions.handleDelete(epub);
	const handleDownload = (epub: StoredEpub) => EpubActions.handleDownload(epub);
	const handleShare = () => EpubActions.handleShare();
	const handleShareEpub = () => EpubActions.handleShareEpub();

	return {
		handleSelect,
		handleDelete,
		handleDownload,
		handleShare,
		handleShareEpub
	};
}
