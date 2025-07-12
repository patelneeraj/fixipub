import type { StoredEpub } from '$lib/services/db';

export function useContextMenu() {
	let showContextMenu = $state(false);
	let menuX = $state(0);
	let menuY = $state(0);
	let contextMenuElement: HTMLElement | null = $state(null);
	let contextedItem: StoredEpub | undefined = $state();

	function handleDocumentClick(e: MouseEvent) {
		if (!showContextMenu) return;
		if (contextMenuElement && !contextMenuElement.contains(e.target as Node)) {
			showContextMenu = false;
		}
	}

	function handleEscape(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		showContextMenu = false;
	}

	function handleRightClick(e: MouseEvent, item: StoredEpub) {
		e.preventDefault();
		contextedItem = item;

		// Calculate position immediately
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuWidth = 224; // w-56 = 14rem = 224px
		const menuHeight = 200; // approximate

		menuX = Math.min(e.clientX, viewportWidth - menuWidth - 10);
		menuY = Math.min(e.clientY, viewportHeight - menuHeight - 10);

		showContextMenu = true;
	}

	function closeContextMenu() {
		showContextMenu = false;
	}

	return {
		get showContextMenu() {
			return showContextMenu;
		},
		get menuX() {
			return menuX;
		},
		get menuY() {
			return menuY;
		},
		get contextMenuElement() {
			return contextMenuElement;
		},
		set contextMenuElement(value: HTMLElement | null) {
			contextMenuElement = value;
		},
		get contextedItem() {
			return contextedItem;
		},
		handleDocumentClick,
		handleEscape,
		handleRightClick,
		closeContextMenu
	};
}
