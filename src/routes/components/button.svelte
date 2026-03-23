<script lang="ts">
	let { text, onClick, primary } = $props();
</script>

{#if primary}
	<button
		onclick={onClick}
		class="h-fit rounded-xl border border-(--white) bg-(--white) p-3 text-(--black) transition duration-200 hover:bg-(--black) hover:text-(--white)"
		>{text}</button
	>
{:else}
	<button
		onclick={onClick}
		class="h-fit rounded-xl border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
		>{text}</button
	>
{/if}
