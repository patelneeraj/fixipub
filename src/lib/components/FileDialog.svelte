<script lang="ts">
	import { sharedComposables } from '$lib/contexts/conposableContexts';
	import FileDropzone from './FileDropzone.svelte';

	const { fileDialog } = sharedComposables;
</script>

<dialog bind:this={fileDialog.dialogElement} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Upload your EPUB!</h3>
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2">✕</button>
		</form>
		<div class="dialog-body p-5">
			<FileDropzone accept=".epub" multiple={true} onFileSelect={fileDialog.handleFileSelect} />
		</div>
	</div>
</dialog>
