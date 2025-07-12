import { epubStore } from '$lib/store/epub.svelte';
import Dexie, { type Table } from 'dexie';

export interface EpubMetadata {
	title: string;
	author: string;
	description: string;
	identifiers: Record<string, string>;
	publisher: string;
	language: string;
	subjects: string[];
	coverPath: string | null;
}

export interface StoredEpub {
	id?: number;
	name: string;
	data: Blob; // the original .epub file
	coverBlob: Blob | null; // cover image as Blob
	metadata: EpubMetadata;
	createdAt: Date;
}

class EpubDatabase extends Dexie {
	epubs!: Table<StoredEpub>;

	constructor() {
		super('EpubDB');
		this.version(1).stores({
			epubs: '++id, name, createdAt'
		});
	}
}

export const db = new EpubDatabase();

export async function deleteStoredEpub(id: number) {
	await db.epubs.delete(id);
	epubStore.epubList = epubStore.epubList.filter((epub) => {
		return epub.id !== id;
	});
}
