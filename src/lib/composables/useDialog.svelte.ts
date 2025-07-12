import { saveSelectedFiles } from '$lib/services/epub';

export function useDialog() {
	let dialogElement: HTMLDialogElement | null = $state(null);

	function openDialog() {
		if (!dialogElement) return;
		dialogElement.showModal();
	}

	function closeDialog() {
		if (!dialogElement) return;
		dialogElement.close();
	}

	function handleFileSelect(files: File[]) {
		closeDialog();
		saveSelectedFiles(files);
	}

	return {
		get dialogElement() {
			return dialogElement;
		},
		set dialogElement(value: HTMLDialogElement | null) {
			dialogElement = value;
		},
		openDialog,
		closeDialog,
		handleFileSelect
	};
}
