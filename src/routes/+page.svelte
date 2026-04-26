<script lang="ts">
	import { goto } from '$app/navigation';
	import { Role } from '$lib/types';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { team } from '$lib/config';
	import { Button, Toast } from 'flowbite-svelte';
	import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { msToRelative } from '$lib/db';

	let { data }: PageProps = $props();

	let visible = $derived(data.scheduleVisible);
	let isAdmin = $derived(data.isAdmin);
	let schedule = $derived(data.schedule);
	let slots = $derived(data.slots);
	let roles = $derived(data.roles);
	let currentSlot = $derived(data.currentSlot);
	let nextSlot = $derived(data.nextSlot);
	let timeToNextSlot = $derived(msToRelative(nextSlot?.startTimestamp ?? Date.now() - Date.now()));
	let view = $derived(data.view);
	let currentPerson = $derived(data.currentPerson);
	let personData = $derived(currentPerson.data);
	let currentRole = $derived(currentPerson.currentRole);
	let nextRole = $derived(currentPerson.nextRole);
	let tradingRequestData = $derived(data.tradeRequestData);

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
			case Role.TiaraJudge:
				return '--purple2';
			default:
				return '--black';
		}
	}

	const msToTime = (ms: number) => {
		return ms > 0
			? new Date(ms).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })
			: 'Never';
	};

	function calcRoleTime(role: Role, name: string) {
		const personSchedule = schedule.find((v) => v.name == name);
		if (!personSchedule) return 0;
		let correct = [];
		for (let i = 0; i < personSchedule.slots.length; i++) {
			let slot = personSchedule.slots[i];
			if ((slot as Role) === (role as Role)) correct.push(slots[i]);
		}
		let totalMS = 0;
		for (let slot of correct) {
			totalMS += slot.endTimestamp - slot.startTimestamp;
		}
		return msToRelative(totalMS);
	}

	const timeView = () => goto('/?view=time');
	const personView = () => goto('/?view=person');

	let interval: NodeJS.Timeout;
	onMount(() => {
		if (nextSlot) timeToNextSlot = msToRelative(nextSlot.startTimestamp - Date.now());
		interval = setInterval(() => {
			if (nextSlot) timeToNextSlot = msToRelative(nextSlot.startTimestamp - Date.now());
		}, 30 * 1000);
	});

	onDestroy(() => clearInterval(interval));
</script>

<!-- top nav -->
<nav class="mb-5 flex h-fit w-screen items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<div class="flex items-center justify-start gap-1">
		<h1 class="pr-5 text-2xl text-(--black)">{team} Schedule</h1>
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

	<div class="flex flex-wrap items-center justify-center gap-2">
		<button
			onclick={() => goto('/logout')}
			class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--red) transition duration-200 hover:border-(--red) hover:bg-(--white) hover:text-(--red)"
			>Logout</button
		>
		<button
			onclick={() => goto('/admin')}
			class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
			>Admin</button
		>
	</div>
</nav>

{#if !visible && isAdmin}
	<h1 class="m-auto text-center text-4xl text-(--red)">Viewing as Admin</h1>
{/if}

<!-- trade request popup -->
{#if tradingRequestData?.uuid}
	<Toast align={false} class="fixed right-5 bg-(--black2) dark:bg-(--black2)">
		{#snippet icon()}
			<ExclamationCircleSolid class="h-6 w-6" />
		{/snippet}

		<span class="font-semibold text-gray-900 dark:text-white"
			>Trade request from {tradingRequestData.person}</span
		>
		<div class="mt-3">
			<div class="mb-2 text-sm font-normal"></div>
			<div class="grid grid-cols-2 gap-2">
				<Button
					size="xs"
					class="w-full"
					color="green"
					onclick={() => goto(`/user/${personData?.uuid}#trade`)}>View</Button
				>
			</div>
		</div>
	</Toast>
{/if}

<!-- button to visit person page -->
{#if personData}
	<div class="flex items-center justify-center gap-2">
		<h1 class="text-2xl">Welcome {personData?.displayName}</h1>
		<button class="button-primary" onclick={() => goto(`/user/${personData?.uuid}`)}
			>View Person Page</button
		>
	</div>
{/if}

<!-- current slot / role  -->
{#if visible || isAdmin}
	<div class="m-auto mb-5 flex size-fit gap-2 rounded-xl bg-(--black2) p-5">
		<div class="flex flex-col items-center justify-center gap-2">
			<p>Current Slot: {currentSlot.label}</p>
			{#if currentRole}
				<p style="color: var({currentRole != Role.Open ? getColor(currentRole) : 'white'}">
					Current Role: {currentRole}
				</p>
			{/if}
		</div>
		{#if nextSlot}
			<div class="flex flex-col items-center justify-center gap-2 border-l-2 border-(--white) pl-2">
				<p>
					{#if nextSlot.startLabel != 'None'}
						Next Slot: {nextSlot.startLabel != ''
							? nextSlot.startLabel
							: msToTime(nextSlot.slotNumber)}-{nextSlot.endLabel != ''
							? nextSlot.endLabel
							: msToTime(nextSlot.endTimestamp)} in {timeToNextSlot}
					{:else}
						Next Slot: None
					{/if}
				</p>
				{#if nextRole}
					<p style="color: var({nextRole != Role.Open ? getColor(nextRole) : 'white'}">
						Next Role: {nextRole}
					</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<!-- main schedule  -->
{#if (visible || isAdmin) && view == 'person'}
	<div class="m-auto mb-10 size-fit max-w-screen overflow-x-scroll rounded-xl bg-(--black2) p-5">
		<table class="nunito">
			<thead class="text-sm">
				<tr>
					<th class="bg-[#3c3c3c] p-2">Name</th>
					{#each slots as slot}
						<th
							class="w-fit bg-[#3c3c3c] p-2 text-nowrap"
							style="font-weight: {slot.startTimestamp < Date.now() &&
							slot.endTimestamp > Date.now()
								? 900
								: 400}; color: var({slot.startTimestamp < Date.now() &&
							slot.endTimestamp > Date.now()
								? '--yellow'
								: '--white'})"
						>
							{#if slot.startLabel != ''}<p>{slot.startLabel}-{slot.endLabel}</p>{/if}
							<p>{msToTime(slot.startTimestamp)}-{msToTime(slot.endTimestamp)}</p></th
						>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each schedule as person}
					<tr>
						<td
							class="p-2"
							style="color: var({personData?.displayName == person.name
								? '--yellow'
								: '--white'}); font-weight: {personData?.displayName == person.name ? 900 : 400}"
							onclick={() => {
								if (isAdmin) goto(`/user/${person.uuid}`);
							}}>{person.name}</td
						>
						{#each person.slots as slot}
							{#if slot}
								<td
									class="border border-(--black) p-2 text-center"
									style="background-color: var({getColor(slot)}); color: var({slot ===
										Role.Strategy || slot === Role.Open
										? '--white'
										: '--black'});"
									onclick={() => {
										if (slot === Role.Scouting) window.open('https://scout.team1540.org', '_blank');
									}}>{slot}</td
								>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if (visible || isAdmin) && view == 'time'}
	<div
		class="nunito flex size-fit max-w-screen flex-col items-center justify-around gap-5 overflow-x-scroll"
	>
		{#each slots as slot}
			<div class="flex w-[90%] justify-between gap-5 rounded-md bg-(--black2) p-5">
				<div
					class="w-fit p-1 font-black text-nowrap"
					style="font-weight: {slot.startTimestamp < Date.now() && slot.endTimestamp > Date.now()
						? 900
						: 400}; color: var({slot.startTimestamp < Date.now() && slot.endTimestamp > Date.now()
						? '--yellow'
						: '--white'})"
				>
					{#if slot.startLabel != ''}<p>{slot.startLabel}-{slot.endLabel}</p>{/if}
					<p>{msToTime(slot.startTimestamp)}-{msToTime(slot.endTimestamp)}</p>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					{#each Object.keys(roles[slot.slotNumber - 1]) as role}
						{#if roles[slot.slotNumber - 1][role as Role].length > 0}
							<div
								style="background-color: var({getColor(
									role as Role
								)}); color: var({(role as Role) === Role.Strategy || (role as Role) === Role.Open
									? '--white'
									: '--black'});"
								class="flex flex-wrap gap-1.5 rounded-md p-1"
							>
								<p class="font-bold">{role}</p>
								{#each roles[slot.slotNumber - 1][role as Role] as person}
									<p>{person}</p>
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="nunito flex size-full flex-col items-center justify-around gap-5 text-4xl font-bold">
		<h1>Schedule not published D:</h1>
	</div>
{/if}

<!-- time amounts -->
{#if visible || isAdmin}
	<div
		class="m-auto mt-10 flex h-fit w-[90%] max-w-screen flex-col gap-2 overflow-x-scroll rounded-xl bg-(--black2) p-5"
	>
		{#each schedule as person}
			<div class="flex items-center gap-2 p-3">
				<h1>{person.name}</h1>
				{#each Object.keys(roles[0]) as role}
					{#if calcRoleTime(role as Role, person.name) != '0s'}
						<div
							style="background-color: var({getColor(role as Role)}); color: var({(role as Role) ===
								Role.Strategy || (role as Role) === Role.Open
								? '--white'
								: '--black'});"
							class="nunito flex gap-1.5 rounded-md p-1 font-medium"
						>
							<p>{role}: {calcRoleTime(role as Role, person.name)}</p>
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
{/if}

<style>
	.button-primary {
		height: fit-content;
		border: 1px solid var(--white);
		border-radius: 10px;
		background-color: var(--white);
		padding: 0.5rem;
		color: var(--black);
		transition-property: color, background-color;
		transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
		transition-duration: 200ms;
	}
	.button-primary:hover {
		background-color: var(--black2);
		color: var(--white);
	}
</style>
