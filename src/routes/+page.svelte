<script lang="ts">
	import { goto } from '$app/navigation';
	import { Role } from '$lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let schedule = $derived(data.schedule);
	let slots = $derived(data.slots);
	let roles = $derived(data.roles);
	let view = $derived(data.view);

	function getColor(role: Role) {
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
				return '--black';
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
	{#if view == 'person'}
		<table>
			<thead class="text-sm">
				<tr>
					<th class="bg-[#3c3c3c] p-2">Name</th>
					{#each slots as slot}
						<th class="w-fit bg-[#3c3c3c] p-2 text-nowrap">{slot.startLabel}-{slot.endLabel}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each schedule as person}
					<tr>
						<td class="p-2">{person.name}</td>
						{#each person.slots as slot}
							<td
								class="nunito border border-(--black) p-2 text-center"
								style="background-color: var({getColor(slot)}); color: var({slot ===
									Role.Strategy || slot === Role.Open
									? '--white'
									: '--black'});">{slot}</td
							>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<div class="nunito flex size-full flex-col items-center justify-around">
			{#each slots as slot}
				<div class="flex w-[95%] justify-between gap-5 border border-(--white) p-5">
					<p class="w-fit p-1 font-black text-nowrap">{slot.startLabel}-{slot.endLabel}</p>
					<div class="flex flex-wrap items-center gap-3">
						{#each Object.keys(roles[slot.slotNumber]) as role}
							{#if roles[slot.slotNumber][role as Role].length > 0}
								<div
									style="background-color: var({getColor(
										role as Role
									)}); color: var({(role as Role) === Role.Strategy || (role as Role) === Role.Open
										? '--white'
										: '--black'});"
									class="flex gap-1.5 rounded-md p-1"
								>
									<p class="font-bold">{role}</p>
									{#each roles[slot.slotNumber][role as Role] as person}
										<p>{person}</p>
									{/each}
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
