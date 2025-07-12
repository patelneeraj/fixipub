import { goto } from '$app/navigation';
import { page } from '$app/state';
import { epubStore } from '$lib/store/epub.svelte';

export function getCoverUrlFromBlob(blob: Blob | null): string | null {
	return blob ? URL.createObjectURL(blob) : null;
}
export function handleDownload(blob: Blob, filename: string) {
	if (blob) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}

export function changeToHtmlExtension(filename: string) {
	return filename.replace(/\.[^/.]+$/, '') + '.html';
}

export const shareBook = async () => {
	const file = new File(
		[epubStore.contextedEpub?.data!],
		changeToHtmlExtension(epubStore.contextedEpub?.metadata.title!),
		{
			type: 'text/html'
		}
	);

	try {
		if (navigator.canShare({ files: [file] })) {
			await navigator.share({
				title: `Share ${epubStore.contextedEpub?.metadata.title} to Kindle`,
				files: [file],
				text: 'Open with Kindle app to read this book!'
			});
		}
	} catch (error) {}
};

export const shareBookEpub = async () => {
	const file = new File(
		[epubStore.contextedEpub?.data!],
		epubStore.contextedEpub?.metadata.title! + '.epub',
		{
			type: 'application/epub+zip'
		}
	);

	try {
		if (navigator.canShare({ files: [file] })) {
			await navigator.share({
				title: `Share ${epubStore.contextedEpub?.metadata.title} to Kindle`,
				files: [file],
				text: 'Open with Kindle app to read this book!'
			});
		}
	} catch (error) {}
};

export function updateSelectedEpub(value: string) {
	const url = new URL(page.url);
	url.searchParams.set('id', value);
	goto(url.toString());
}

export function removeSelectedEpub() {
	const url = new URL(page.url);
	url.searchParams.delete('id');
	goto(url.toString());
}
