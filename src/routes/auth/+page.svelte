<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<nav class="mb-5 flex h-fit w-full items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<h1 class="text-4xl text-(--black)">Login</h1>
	<button
		onclick={() => goto('/admin')}
		class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
		>Admin</button
	>
</nav>

<div class="mb-5 flex justify-center">
	<button class="button-primary m-auto" onclick={() => goto('/auth/oauth')}
		>Login with Veracross</button
	>
</div>

<form action="?/guest" method="post" class="flex w-full justify-center">
	<button class="button-secondary">Or continue as guest</button>
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

	.button-secondary {
		height: fit-content;
		border-radius: 10px;
		background-color: #3c3c3c;
		padding: 0.5rem;
		color: var(--white);
		font-size: 0.875rem;
		transition-property: color, background-color;
		transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
		transition-duration: 200ms;
	}
	.button-secondary:hover {
		background-color: var(--white);
		color: var(--black2);
	}
</style>
