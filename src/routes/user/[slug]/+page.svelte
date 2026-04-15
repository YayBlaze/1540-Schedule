<script lang="ts">
	import { Toggle, Input, Label, Tooltip, Button, Helper, PhoneInput } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import { team } from '$lib/config';
	import type { PageProps } from './$types';
	import { Role, RolePool } from '$lib/types';

	let { data }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	let personData = $state(data.personData);
	let personDataString = $derived(JSON.stringify(personData));
	// svelte-ignore state_referenced_locally
	const ogPersonData = structuredClone(data.personData);
	let personSchedule = $derived(data.personSchedule);
	let slots = $derived(data.slots);
	let roles = $derived(data.roles);

	let hasUpdated = $derived.by(() => JSON.stringify(ogPersonData) !== JSON.stringify(personData));

	function getColor(role: RolePool | Role) {
		switch (role) {
			case RolePool.Drive:
				return '--blue';
			case RolePool.PitLead:
				return '--purple3';
			case RolePool.NO_Scouting:
				return '--green2';
			case RolePool.ONLY_Strategy:
				return '--green3';
			case RolePool.TiaraJudge:
				return '--purple2';
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

	function msToRelative(ms: number): string {
		let seconds = ms / 1000;
		let days = Math.floor(seconds / (24 * 3600));
		seconds = seconds % (24 * 3600);
		let hour = Math.floor(seconds / 3600);
		seconds %= 3600;
		let minutes = Math.floor(seconds / 60);
		seconds %= 60;

		let string = Math.round(seconds) + 's';
		if (minutes != 0) string = Math.round(minutes) + 'mins';
		if (hour != 0) string = Math.round(hour) + 'hrs, ' + string;
		if (days != 0) string = '>24hrs';

		return string;
	}

	function calcRoleTime(role: Role) {
		if (!personSchedule) return 0;
		let correct = [];
		for (let i = 0; i < personSchedule.length; i++) {
			let slot = personSchedule[i];
			if ((slot as Role) === (role as Role)) correct.push(slots[i]);
		}
		let totalMS = 0;
		for (let slot of correct) {
			totalMS += slot.endTimestamp - slot.startTimestamp;
		}
		return msToRelative(totalMS);
	}

	const msToTime = (ms: number) => {
		return ms > 0
			? new Date(ms).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })
			: 'Never';
	};
</script>

<nav class="mb-5 flex h-fit w-screen items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<h1 class="pr-5 text-4xl text-(--black)">{team} Schedule</h1>
	<div>
		<button
			onclick={() => goto('/')}
			class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
			>Return to schedule</button
		>
	</div>
</nav>

<form class="flex w-full flex-col justify-around gap-5 p-3" method="POST">
	<input type="hidden" name="personData" bind:value={personDataString} />
	<div class="item m-auto flex flex-col gap-2">
		<h1 class="text-center text-5xl">Welcome {personData?.displayName}</h1>
		<Toggle
			bind:checked={personData.attendingEvent}
			size="large"
			color="green"
			class="nunito text-3xl">Attending Event</Toggle
		>
		<Toggle
			bind:checked={personData.attendingLoadIn}
			size="large"
			color="green"
			class="nunito text-3xl">Wants to attend load in</Toggle
		>
		<div class="flex items-center gap-2">
			Role Pool:
			<Button
				type="button"
				class="size-fit rounded-md p-2 text-center"
				id="rolePool"
				style="background-color: var({getColor(
					personData.rolePool
				)}); color: var({personData.rolePool === RolePool.ONLY_Strategy ||
				personData.rolePool === RolePool.None
					? '--white'
					: '--black'});"
			>
				{personData.rolePool}
			</Button>
			<Tooltip triggeredBy="rolePool">Contact an Admin to change</Tooltip>
		</div>
	</div>
	<div class="item m-auto">
		<h1 class="text-2xl">My Schedule</h1>
		<table class="nunito">
			<thead class="text-sm">
				<tr>
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
				<tr>
					{#each personSchedule as slot}
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
			</tbody>
		</table>
		<div class="flex items-center gap-2 p-3">
			Times:
			{#each Object.keys(roles[0]) as role}
				{#if calcRoleTime(role as Role) != '0s'}
					<div
						style="background-color: var({getColor(role as Role)}); color: var({(role as Role) ===
							Role.Strategy || (role as Role) === Role.Open
							? '--white'
							: '--black'});"
						class="nunito flex gap-1.5 rounded-md p-1 font-medium"
					>
						<p>{role}: {calcRoleTime(role as Role)}</p>
					</div>
				{/if}
			{/each}
		</div>
	</div>
	<div class="m-auto flex h-fit w-[95%] items-stretch justify-between gap-5">
		<div class="item flex flex-wrap gap-2">
			<div class="w-70">
				<Label for="first_name">First name</Label>
				<Input
					type="text"
					id="first_name"
					placeholder="John"
					required
					class="nunito"
					bind:value={personData.firstName}
				/>
			</div>
			<div class="w-70">
				<Label for="last_name">Last name</Label>
				<Input
					type="text"
					id="last_name"
					placeholder="Doe"
					required
					class="nunito"
					bind:value={personData.lastName}
				/>
			</div>
			<div class="w-70">
				<Label for="email">Email address</Label>
				<Input
					aria-describedby="helper-text-explanation"
					type="email"
					id="email"
					placeholder="john.doe@company.com"
					required
					class="nunito"
					bind:value={personData.email}
				/>
				<Helper class="mt-2 text-xs">Used the same email as the roles google form</Helper>
			</div>
			<div class="w-70">
				<Label for="phone">Phone Number</Label>
				<Input
					type="number"
					id="phone"
					aria-describedby="helper-text-explanation"
					placeholder="1234567890"
					required
					bind:value={personData.phone}
				/>
				<Helper class="mt-2 text-xs">Used for SMS notifications upon new role</Helper>
			</div>
		</div>
		<div class="item flex flex-col gap-2">
			<p class="nunito">Note: will not update schedule until the next generation</p>
			<Toggle
				bind:checked={personData.preferences.doPits}
				size="large"
				color="green"
				class="nunito text-2xl">Wants to work in pits</Toggle
			>
			<Toggle
				bind:checked={personData.preferences.doMedia}
				size="large"
				color="green"
				class="nunito text-2xl">Wants to do media</Toggle
			>
			<Toggle
				bind:checked={personData.preferences.doJournalism}
				size="large"
				color="green"
				class="nunito text-2xl">Wants to do journalism</Toggle
			>
			<Toggle
				bind:checked={personData.preferences.doStrategy}
				size="large"
				color="green"
				class="nunito text-2xl">Wants to do strategy</Toggle
			>
		</div>
	</div>

	{#if hasUpdated}
		<div class="fixed bottom-10 left-80 w-[50%] rounded-2xl border bg-(--black2) p-2 text-center">
			Changes not saved
			<Button color="green" type="submit">Save</Button>
			<Button color="alternative" type="button" onclick={() => (personData = ogPersonData)}
				>Reset</Button
			>
		</div>
	{/if}
</form>

<style>
	.item {
		background-color: var(--black2);
		padding: 1rem;
		width: 95%;
		border: 1px solid var(--white);
		border-radius: 20px;
	}
</style>
