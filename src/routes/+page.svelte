<script lang="ts">
	import { goto } from '$app/navigation';
	import { Role } from '$lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let schedule = $derived(data.schedule);
	let slots = $derived(data.slots);
	let view = $derived(data.view);

	function getColor(role: Role) {
		role = Role[role as unknown as keyof typeof Role];
		switch (role) {
			case Role.Drive:
				return '--blue';
			case Role.PitLead:
				return '--purple3';
			case Role.Pits:
				return '--purple1';
			case Role.Scouting:
				return '--green2';
			case Role.Strategy:
				return '--green3';
			case Role.Media:
				return '--green1';
			case Role.Journalism:
				return '--yellow';
			default:
				return '--black2';
		}
	}

	function timeView() {
		goto('/?view=time');
	}
	function personView() {
		goto('/?view=person');
	}
</script>

<nav class="flex h-fit w-screen items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<div class="flex items-center justify-start gap-1">
		<h1 class="pr-5 text-4xl text-(--black)">1540 Schedule</h1>
		{#if view == 'time'}
			<button
				class="rounded-md border border-(--white) bg-(--black) p-2 text-(--white)"
				onclick={timeView}>By time</button
			>
			<button class="rounded-md border border-(--black) p-2 text-(--black)" onclick={personView}
				>By person</button
			>
		{:else}
			<button class="rounded-md border border-(--black) p-2 text-(--black)" onclick={timeView}
				>By time</button
			>
			<button
				class="rounded-md border border-(--white) bg-(--black) p-2 text-(--white)"
				onclick={personView}>By person</button
			>
		{/if}
	</div>

	<button
		onclick={() => goto('/admin')}
		class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
		>Admin</button
	>
</nav>

<div class="m-auto size-fit overflow-x-scroll bg-(--black2) p-5">
	<table>
		<thead class="text-sm">
			<tr>
				<th class="bg-[#3c3c3c] p-2">Name</th>
				{#each slots as slot}
					<th class="w-fit bg-[#3c3c3c] p-2 text-nowrap">{slot.startLabel}-{slot.endLabel}</th>
				{/each}
			</tr>
			{#each schedule as person}
				<tr>
					<td class="p-2">{person.name}</td>
					{#each person.slots as slot}
						<td
							class="nunito text-center"
							style="background-color: var({getColor(slot)}); color: var({Role[
								slot as unknown as keyof typeof Role
							] === Role.Strategy || Role[slot as unknown as keyof typeof Role] === Role.Open
								? '--white'
								: '--black'});">{slot}</td
						>
					{/each}
				</tr>
			{/each}
		</thead>
	</table>
</div>

<style>
	td {
		border: 1px solid var(--black);
		padding: 0.5rem;
	}
</style>
