<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let people = $derived(data.people);
</script>

<nav class="mb-5 flex h-fit w-full items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<h1 class="text-4xl text-(--black)">Login</h1>
	<button
		onclick={() => goto('/admin')}
		class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
		>Admin</button
	>
</nav>

<form
	action="?/login"
	method="post"
	class="m-auto mb-10 flex size-fit flex-col items-center justify-around gap-2 rounded-xl bg-(--black2) p-5 text-2xl"
>
	<h1>Please select your name:</h1>
	<select
		name="personSelect"
		class="h-fit w-[70%] rounded-md border border-(--grey) bg-[#3c3c3c] p-1 text-(--white)"
	>
		{#each people as person}
			{#if person.attendingEvent}
				<option value={person.uuid}>{person.displayName}</option>
			{/if}
		{/each}
	</select>
	<button id="submit" class="button-primary">Submit</button>
</form>

<style>
	.button-primary {
		height: fit-content;
		border: 1px solid var(--white);
		border-radius: 10px;
		background-color: var(--white);
		padding: 1rem;
		color: var(--black);
		transition-property: color, background-color;
		transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
		transition-duration: 200ms;
		font-size: x-large;
	}
	.button-primary:hover {
		background-color: var(--black2);
		color: var(--white);
	}
</style>
