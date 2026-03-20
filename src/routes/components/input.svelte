<script lang="ts">
	let { value = $bindable(), placeholder } = $props();
</script>

<input
	type="text"
	bind:value
	{placeholder}
	class="w-[80%] rounded-md border border-(--grey) p-1 text-(--white)"
/>
