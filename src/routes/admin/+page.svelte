<script lang="ts">
	import Button from '../components/button.svelte';
	import Input from '../components/input.svelte';
	import { goto } from '$app/navigation';
</script>

<nav class="flex h-fit w-full items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<h1 class="text-4xl text-(--black)">1540 Admin</h1>
	<Button text="Back to Schedule" onClick={() => goto('/')} primary={false}></Button>
</nav>

<div class="flex w-full flex-col justify-around gap-5 p-3">
	<div class="m-auto flex w-[95%] justify-around gap-5">
		<div class="item">
			<h1 class="text-xl">Roles</h1>
			<p class="text-md pb-1 text-(--grey)">Manage available roles</p>
			<div class="flex gap-3">
				<Input placeholder="New role name (eg. Awards)"></Input>
				<Button text="Add role" onClick primary={true}></Button>
			</div>
		</div>
		<div class="item">
			<h1 class="text-xl">People to Roles</h1>
			<p class="text-md pb-1 text-(--grey)">Assign people to different role pools</p>
		</div>
	</div>
	<div class="item">
		<h1 class="text-xl">Competition Settings</h1>
		<p class="text-md pb-1 text-(--grey)">Set event day timing windows and lunch breaks</p>
		<div class="flex gap-2">
			<Input placeholder="Day"></Input>
			<Input placeholder="8:00"></Input>
			<Input placeholder="19:30"></Input>
			<Input placeholder="13:00"></Input>
			<Input placeholder="14:00"></Input>
			<Button text="Save" onClick primary={true}></Button>
		</div>
	</div>
</div>

<style>
	.item {
		background-color: var(--black2);
		padding: 1rem;
		width: 95%;
		height: fit-content;
		margin: auto;
		border: 1px solid var(--white);
		border-radius: 5px;
	}
</style>
