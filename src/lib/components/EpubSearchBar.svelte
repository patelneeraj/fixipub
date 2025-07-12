<script lang="ts">
	import { sharedComposables } from '$lib/contexts/conposableContexts';

	const { search } = sharedComposables;
</script>

<label
	class="input bg-base-200 input-sm sm:input-md flex w-full items-center gap-2 border-transparent ring-0 focus-within:border-transparent focus-within:ring-0 focus-within:outline-none"
>
	<svg
		class="h-4 w-4 opacity-50 sm:h-5 sm:w-5"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
	>
		<g
			stroke-linejoin="round"
			stroke-linecap="round"
			stroke-width="2.5"
			fill="none"
			stroke="currentColor"
		>
			<circle cx="11" cy="11" r="8"></circle>
			<path d="m21 21-4.3-4.3"></path>
		</g>
	</svg>
	<input
		bind:value={search.filter}
		type="search"
		placeholder="Search"
		class="grow bg-transparent text-sm focus:border-transparent focus:ring-0 focus:outline-none sm:text-base"
	/>
</label>
