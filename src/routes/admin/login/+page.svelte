<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let msg = $derived(form?.msg ?? data.msg);
	let color = $derived(data.color);
	let pass = $derived(data.pass);
</script>

<title>Login</title>

<div class="m-auto mt-[10%] flex size-fit flex-col gap-5 p-[5%] text-center">
	<h1 class="m-0 text-[3rem]">Enter Admin Password</h1>
	<p class="text-[1.5rem]" style="color: {color}" id="msg">{form?.msg ?? msg}</p>
	<form method="post" class="flex flex-col gap-4">
		<input name="pass" type="password" bind:value={pass} placeholder="Password" />
		<button
			id="submit"
			class="m-auto rounded-[5px] border-2 border-solid border-(--white) bg-(--grey) p-[3%] text-[1.5rem] text-(--white)"
			>Login</button
		>
	</form>
</div>

<style>
	input {
		background-color: #4c4c4c;
		color: white;
		border: 2px solid white;
		border-radius: 5px;
		padding: 2%;
		margin: auto;
	}
</style>
