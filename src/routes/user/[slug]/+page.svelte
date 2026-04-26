<script lang="ts">
	import { Toggle, Input, Label, Tooltip, Button, Helper, Alert, P } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import { team } from '$lib/config';
	import type { PageProps } from './$types';
	import { Role, RolePool, type PersonData } from '$lib/types';
	import { CheckCircleOutline } from 'flowbite-svelte-icons';
	import { msToRelative } from '$lib/db';

	let { data }: PageProps = $props();
	let people = $derived(data.people);
	// svelte-ignore state_referenced_locally
	let personData = $state(data.personData);
	let personDataString = $derived(JSON.stringify(personData));
	// svelte-ignore state_referenced_locally
	const ogPersonData = structuredClone(data.personData);
	let schedule = $derived(data.schedule);
	let slots = $derived(data.slots);
	let roles = $derived(data.roles);
	let showSuccessMsg = $derived(data.showSuccess);
	let successMsg = $derived(data.successMsg);
	let scheduleVisible = $derived(data.scheduleVisible);

	let incomingTradeRequest = $derived(data.tradeRequestData);
	let incomingTradeSlot = $derived(slots[(incomingTradeRequest.slot ?? 1) - 1]);

	let tradingPerson: PersonData | undefined = $state();
	let tradingSlot:
		| {
				slotNumber: number;
				startTimestamp: number;
				endTimestamp: number;
				startLabel: string;
				endLabel: string;
				allowUpdate: boolean;
		  }
		| undefined = $state();
	let tradingPersonRole = $derived.by(() => {
		let fullSchedule = schedule.find((v) => v.uuid === tradingPerson?.uuid)?.slots;
		if (!fullSchedule || !tradingSlot) return undefined;
		return fullSchedule[tradingSlot.slotNumber - 1];
	});
	let userRole = $derived.by(() => {
		let fullSchedule = schedule.find((v) => v.uuid === personData.uuid)?.slots;
		if (!fullSchedule || !tradingSlot) return undefined;
		return fullSchedule[tradingSlot.slotNumber - 1];
	});

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

	const msToTime = (ms: number) => {
		return ms > 0
			? new Date(ms).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })
			: 'Never';
	};

	async function tradeRequest() {
		const res = await fetch('/api/submitTrade', {
			method: 'POST',
			body: JSON.stringify({
				tradeInit: personData.uuid,
				traderReceive: tradingPerson?.uuid,
				slot: tradingSlot?.slotNumber
			})
		});
		if ((await res.json()).status == 200) {
			goto(
				`/user/${personData.uuid}?success=true&successMsg=Submitted trade request with ${tradingPerson?.displayName}`
			);
		}
	}

	async function declineTradeRequest() {
		const res = await fetch('/api/declineTrade', {
			method: 'POST',
			body: JSON.stringify({
				uuid: incomingTradeRequest.uuid
			})
		});
		if ((await res.json()).status == 200) {
			goto(
				`/user/${personData.uuid}?success=true&successMsg=Successfully denied ${incomingTradeRequest.person}'s Trade Request`
			);
		}
	}

	async function acceptTradeRequest() {
		await fetch('/api/acceptTrade', {
			method: 'POST',
			body: JSON.stringify({
				uuid: incomingTradeRequest.uuid
			})
		});
		goto(
			`/user/${personData.uuid}?success=true&successMsg=Accepted ${incomingTradeRequest.person}'s Trade Request`
		);
	}
</script>

<nav class="mb-5 flex h-fit max-w-screen items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<h1 class="pr-5 text-4xl text-(--black)">{team} Schedule</h1>
	<div>
		<button
			onclick={() => goto('/')}
			class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
			>Return to schedule</button
		>
	</div>
</nav>

<form class="flex max-w-screen flex-col justify-around gap-5 p-3" method="POST">
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
		{#if scheduleVisible}
			<div class="max-w-screen overflow-x-scroll">
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
							{#each schedule.find((person) => person.uuid === personData.uuid)?.slots as slot}
								{#if slot}
									<td
										class="border border-(--black) p-2 text-center"
										style="background-color: var({getColor(slot)}); color: var({slot ===
											Role.Strategy || slot === Role.Open
											? '--white'
											: '--black'});"
										onclick={() => {
											if (slot === Role.Scouting)
												window.open('https://scout.team1540.org', '_blank');
										}}>{slot}</td
									>
								{/if}
							{/each}
						</tr>
					</tbody>
				</table>
			</div>
			<div class="flex items-center gap-2 p-3">
				Times:
				{#each Object.keys(roles[0]) as role}
					{#if calcRoleTime(role as Role, personData.displayName) != '0s'}
						<div
							style="background-color: var({getColor(role as Role)}); color: var({(role as Role) ===
								Role.Strategy || (role as Role) === Role.Open
								? '--white'
								: '--black'});"
							class="nunito flex gap-1.5 rounded-md p-1 font-medium"
						>
							<p>{role}: {calcRoleTime(role as Role, personData.displayName)}</p>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<div
				class="nunito flex size-full flex-col items-center justify-around gap-5 text-4xl font-bold"
			>
				<h1>Schedule not published D:</h1>
			</div>
		{/if}
	</div>
	<div class="m-auto flex h-fit w-[95%] flex-col items-stretch justify-between gap-5 md:flex-row">
		<div class="item">
			<h1 class="text-2xl">Personal Information</h1>
			<div class="flex flex-wrap gap-2">
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
					<Helper class="mt-2 text-xs"
						>Must be your catlin email or you will be locked out of your account</Helper
					>
				</div>
				<div class="w-70">
					<Label for="phone">Phone Number</Label>
					<Input
						type="number"
						id="phone"
						aria-describedby="helper-text-explanation"
						placeholder="1234567890"
						bind:value={personData.phone}
					/>
					<Helper class="mt-2 text-xs"
						>Optional | Used to send SMS messages with updates (not currently functional)</Helper
					>
				</div>
			</div>
		</div>
		<div class="item flex flex-col gap-2">
			<h1 class="text-2xl">Schedule Preferences</h1>
			<p class="nunito text-(--grey)">Note: will not update schedule until the next generation</p>
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

	{#if scheduleVisible}
		<div class="item m-auto max-w-screen overflow-x-scroll">
			<h1 class="text-2xl" id="trade">
				{incomingTradeRequest.uuid ? 'Incoming Trade Request' : 'Trade Schedule Slots'}
			</h1>
			{#if !incomingTradeRequest.uuid}
				<div class="flex items-center gap-2">
					<p class="nunito">Trading With:</p>
					<input type="hidden" name="tradingInit" value={personData} />
					<select class="w-40" bind:value={tradingPerson} name="tradingReceive">
						{#each people as person}
							{#if person.attendingEvent && person.uuid != personData.uuid}
								<option value={person}>{person.displayName}</option>
							{/if}
						{/each}
					</select>
					<p class="nunito">Trading Slot:</p>
					<select class="w-40" bind:value={tradingSlot} name="slot">
						{#each slots as slot}
							<option value={slot}>
								{#if slot.startLabel != ''}
									<p>{slot.startLabel}-{slot.endLabel}</p>
								{:else}
									<p>{msToTime(slot.startTimestamp)}-{msToTime(slot.endTimestamp)}</p>
								{/if}
							</option>
						{/each}
					</select>
					<p class="nunito">
						({msToRelative(
							(tradingSlot?.endTimestamp ?? slots[0].endTimestamp) -
								(tradingSlot?.startTimestamp ?? slots[0].startTimestamp)
						)})
					</p>
				</div>
			{:else}
				<div class="flex items-center gap-2">
					<div class="flex flex-col justify-center text-center">
						<p class="nunito font-bold!">Incoming Trade From</p>
						<p class="nunito">{incomingTradeRequest.person}</p>
					</div>
					<div class="flex flex-col justify-center text-center">
						<p class="nunito font-bold!">Trading Slot</p>
						<p class="nunito">
							{#if incomingTradeSlot.startLabel != ''}
								{incomingTradeSlot.startLabel}-{incomingTradeSlot.endLabel}
							{/if}
							{msToTime(incomingTradeSlot.startTimestamp)}-{msToTime(
								incomingTradeSlot.endTimestamp
							)}
							({msToRelative(
								(tradingSlot?.endTimestamp ?? slots[0].endTimestamp) -
									(tradingSlot?.startTimestamp ?? slots[0].startTimestamp)
							)})
						</p>
					</div>
				</div>
			{/if}
			<div class="flex items-center gap-4">
				<div>
					<h1 class="text-xl">You have</h1>
					<div
						style="background-color: var({getColor(
							incomingTradeRequest.outgoingRole ?? (userRole as Role)
						)}); color: var({(incomingTradeRequest.outgoingRole ?? (userRole as Role)) ===
							Role.Strategy ||
						(incomingTradeRequest.outgoingRole ?? (userRole as Role)) === Role.Open
							? '--white'
							: '--black'});"
						class="nunito rounded-md p-1 text-center font-medium"
					>
						<p>{incomingTradeRequest.outgoingRole ?? userRole}</p>
					</div>
				</div>
				<div>
					<h1 class="text-xl">{incomingTradeRequest.person ?? tradingPerson?.displayName} has</h1>
					<div
						style="background-color: var({getColor(
							incomingTradeRequest.incomingRole ?? (tradingPersonRole as Role)
						)}); color: var({(incomingTradeRequest.incomingRole ?? (tradingPersonRole as Role)) ===
							Role.Strategy ||
						(incomingTradeRequest.incomingRole ?? (tradingPersonRole as Role)) === Role.Open
							? '--white'
							: '--black'});"
						class="nunito rounded-md p-1 text-center font-medium"
					>
						<p>{incomingTradeRequest.incomingRole ?? tradingPersonRole}</p>
					</div>
				</div>
				{#if !incomingTradeRequest.uuid}
					<button class="button-primary mt-3" type="button" onclick={tradeRequest}
						>Submit Trade Request</button
					>
				{:else}
					<button type="button" class="button-primary" onclick={acceptTradeRequest}
						>Accept Trade</button
					>
					<button type="button" class="button-secondary" onclick={declineTradeRequest}
						>Deny Trade</button
					>
				{/if}
			</div>
		</div>
	{/if}

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

{#if showSuccessMsg}
	<div class="fixed bottom-2 w-full">
		<Alert color="green" dismissable class="m-auto w-100">
			{#snippet icon()}<CheckCircleOutline class="h-5 w-5" />{/snippet}
			{successMsg}
		</Alert>
	</div>
{/if}

<style>
	.item {
		background-color: var(--black2);
		padding: 1rem;
		width: 95%;
		border: 1px solid var(--white);
		border-radius: 20px;
	}

	select {
		height: fit-content;
		border: 1px solid var(--grey);
		border-radius: 0.375rem;
		padding: 0.25rem;
		color: var(--white);
		background-color: #3c3c3c;
	}

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
