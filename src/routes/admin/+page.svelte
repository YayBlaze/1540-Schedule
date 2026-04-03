<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import { RolePool } from '$lib/types';
	let { data }: PageProps = $props();

	var people = $derived(data.people);
	var times = $derived(data.times);
	var date = $derived(data.date);
	var slots = $derived(data.slots);
	// svelte-ignore state_referenced_locally
	var slotsToEdit = $state(slots);
	while (slotsToEdit.length < 11) {
		slotsToEdit.push({
			slotNumber: slotsToEdit.length + 1,
			startLabel: '',
			startTimestamp: 0,
			endLabel: '',
			endTimestamp: 0
		});
	}
	var { lunchStart, lunchEnd, dayStart, dayEnd } = $derived(times);

	function toDatetimeLocal(ms: number) {
		if (!ms) return '';
		const d = new Date(ms);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
</script>

<nav class="flex h-fit w-full items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<h1 class="text-4xl text-(--black)">1540 Admin</h1>
	<button
		onclick={() => goto('/')}
		class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
		>Return to Schedule</button
	>
</nav>

<div class="flex w-full flex-col justify-around gap-5 p-3">
	<div class="item flex items-center justify-between">
		<div>
			<h1 class="text-xl">Generate Schedule</h1>
			<p class="pb-1 text-sm text-(--red)">
				Warning: This action will re-generate the schedule and slots for all people
			</p>
		</div>
		<form action="?/generate" method="post">
			<button class="button-primary" id="submit">Generate</button>
		</form>
	</div>
	<div class="m-auto flex w-[95%] justify-around gap-5">
		<div class="item h-100">
			<h1 class="text-xl">People</h1>
			<p class="text-md pb-1 text-(--grey)">Add and remove people</p>
			<form
				action="?/newPerson"
				method="post"
				class="flex h-fit w-full items-center justify-around pb-2"
			>
				<input
					type="text"
					name="firstName"
					placeholder="First Name"
					class="h-fit w-[40%] rounded-md border border-(--grey) p-1 text-(--white)"
				/>
				<input
					type="text"
					name="lastName"
					placeholder="Last Name"
					class="h-fit w-[40%] rounded-md border border-(--grey) p-1 text-(--white)"
				/>
				<button id="submit" class="button-primary">Add</button>
			</form>
			<div class="max-h-69 overflow-scroll">
				{#each people as person}
					<div
						class="mb-1 flex items-center justify-between rounded-xl border border-(--white) p-2"
					>
						<p>{person.displayName}</p>
						<div class="flex h-fit items-center justify-around gap-1">
							<form action="?/updateStatus" method="post">
								<input type="hidden" name="id" value={person.uuid} />
								<button id="submit" class="button-secondary">
									{person.attendingEvent ? 'Attending' : 'Missing'}
								</button>
							</form>
							<form action="?/deletePerson" method="post">
								<input name="id" type="hidden" value={person.uuid} />
								<button id="submit" class="button-destructive">Remove</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</div>
		<div class="item h-100">
			<h1 class="text-xl">People to Roles</h1>
			<p class="text-md pb-1 text-(--grey)">Assign people to different role pools</p>
			<form
				action="?/assign"
				method="post"
				class="flex h-fit w-full items-center justify-around pb-2"
			>
				<select
					name="person"
					class="h-fit w-[40%] rounded-md border border-(--grey) p-1 text-(--white)"
				>
					{#each people as person}
						{#if person.attendingEvent && (!person.rolePool || person.rolePool == RolePool.None)}
							<option value={person.uuid}>{person.displayName}</option>
						{/if}
					{/each}
				</select>
				<select
					name="role"
					class="h-fit w-[40%] rounded-md border border-(--grey) p-1 text-(--white)"
				>
					<option value={RolePool.PitLead}>Pit Lead</option>
					<option value={RolePool.Drive}>Drive Team</option>
					<option value={RolePool.NO_Scouting}>No Scouting</option>
					<option value={RolePool.ONLY_Strategy}>Strategy Only</option>
					<option value={RolePool.TiaraJudge}>Tiara Judge</option>
				</select>
				<button id="submit" class="button-primary">Assign</button>
			</form>
			<div class="max-h-69 overflow-scroll">
				{#if people.filter((person) => person.rolePool != null && person.rolePool != RolePool.None && person.attendingEvent).length < 1}
					<h1 class="p-2 text-center text-xl">No Exceptions</h1>
				{/if}
				{#each people as person}
					{#if person.rolePool != null && person.rolePool != RolePool.None && person.attendingEvent}
						<div
							class="mb-1 flex items-center justify-between rounded-xl border border-(--white) p-2"
						>
							<p>{person.displayName} -> {person.rolePool}</p>
							<form action="?/deleteAssignment" method="post">
								<input name="id" type="hidden" value={person.uuid} />
								<button id="submit" class="button-destructive">Remove</button>
							</form>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	<div class="item">
		<h1 class="text-xl">Competition Settings</h1>
		<p class="text-md pb-1 text-(--grey)">Set event day timing windows and lunch breaks</p>
		<form method="post" action="?/saveCompSettings" class="flex items-center justify-around gap-2">
			<input
				type="text"
				name="date"
				placeholder="Event Date"
				class="h-fit w-[50%] rounded-md border border-(--grey) p-1 text-(--white)"
				bind:value={date}
			/>
			<input
				type="text"
				name="dayStart"
				placeholder="Event Start"
				class="h-fit w-[50%] rounded-md border border-(--grey) p-1 text-(--white)"
				bind:value={dayStart}
			/>
			<input
				type="text"
				name="lunchStart"
				placeholder="Lunch Start"
				class="h-fit w-[50%] rounded-md border border-(--grey) p-1 text-(--white)"
				bind:value={lunchStart}
			/>
			<input
				type="text"
				name="lunchEnd"
				placeholder="Lunch End"
				class="h-fit w-[50%] rounded-md border border-(--grey) p-1 text-(--white)"
				bind:value={lunchEnd}
			/>
			<input
				type="text"
				name="dayEnd"
				placeholder="Event End"
				class="h-fit w-[50%] rounded-md border border-(--grey) p-1 text-(--white)"
				bind:value={dayEnd}
			/>
			<button
				id="submit"
				class="button-primary"
				onclick={() =>
					alert('Settings saved, but you need to re-generate the schedule for it to take affect')}
				>Save</button
			>
		</form>
	</div>

	<div class="item">
		<h1 class="text-xl">Edit time slots</h1>
		<p class="text-md pb-1 text-(--grey)">Set label and timestamps of the time slots</p>
		<p class="pb-1 text-sm text-(--grey)">
			To remove a slot, set the start label to nothing *not recommended
		</p>
		<div class="flex w-full flex-wrap items-center gap-4">
			{#each slotsToEdit as slot}
				<form
					class="flex h-69 w-[30%] flex-col items-center justify-around gap-2 rounded-2xl border border-(--white) p-2"
					method="post"
					action="?/editSlot"
				>
					<h1>Slot {slot.slotNumber}</h1>
					<input type="hidden" name="slotNum" value={slot.slotNumber} />
					<input
						type="text"
						name="startLabel"
						placeholder="Start Label"
						class="h-fit w-[80%] rounded-md border border-(--grey) p-1"
						value={slot.startLabel}
					/>
					<input
						type="datetime-local"
						name="startTimestamp"
						class="h-fit w-[80%] rounded-md border border-(--grey) p-1"
						value={toDatetimeLocal(slot.startTimestamp)}
					/>
					<input
						type="text"
						name="endLabel"
						placeholder="End Label"
						class="h-fit w-[80%] rounded-md border border-(--grey) p-1"
						value={slot.endLabel}
					/>
					<input
						type="datetime-local"
						name="endTimestamp"
						class="h-fit w-[80%] rounded-md border border-(--grey) p-1"
						placeholder="End Timestamp"
						value={toDatetimeLocal(slot.endTimestamp)}
					/>
					<button class="button-primary" id="submit">Save</button>
				</form>
			{/each}
		</div>
	</div>
</div>

<style>
	.item {
		background-color: var(--black2);
		padding: 1rem;
		width: 95%;
		margin: auto;
		border: 1px solid var(--white);
		border-radius: 20px;
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

	.button-destructive {
		height: fit-content;
		border: 1px solid #3c3c3c;
		border-radius: 10px;
		background-color: #3c3c3c;
		padding: 0.5rem;
		color: var(--white);
		font-size: 0.875rem;
		transition-property: color, background-color, border;
		transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
		transition-duration: 200ms;
	}
	.button-destructive:hover {
		background-color: var(--black2);
		border: 1px solid var(--red);
		color: var(--red);
	}
</style>
