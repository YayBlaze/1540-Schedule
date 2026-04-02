<script lang="ts">
	import { goto } from '$app/navigation';
	import { eventKey } from '$lib/config';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let personUUID = $derived(data.personUUID);
	let personData = $derived(data.personData);
	let people = $derived(data.people);
</script>

<nav class="mb-5 flex h-fit w-full items-center justify-between bg-(--white) p-2 pr-5 pl-5">
	<h1 class="text-4xl text-(--black)">Preference Form</h1>
	<button
		onclick={() => goto('/')}
		class="rounded-lg border border-(--black) bg-(--black) p-2 text-(--white) transition duration-200 hover:bg-(--white) hover:text-(--black)"
		>Return to Schedule</button
	>
</nav>

{#if !personData}
	<form
		action="?/selectPerson"
		method="post"
		class="m-auto mb-10 flex size-fit flex-col items-center justify-around gap-2 rounded-xl bg-(--black2) p-5"
	>
		<h1>Please select your name:</h1>
		<select
			name="personSelect"
			class="h-fit w-[70%] rounded-md border border-(--grey) p-1 text-(--white)"
		>
			{#each people as person}
				<option value={person.uuid}>{person.displayName}</option>
			{/each}
		</select>
		<h1>or enter name if missing</h1>
		<div class="flex items-center justify-center gap-2">
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
		</div>

		<button id="submit" class="button-primary">Submit</button>
	</form>
{:else}
	<form action="?/submitForm" method="post" class="flex flex-col items-center justify-around">
		<h1 class="mb-2 text-4xl font-bold">Hello {personData.displayName}!</h1>
		<div class="question">
			<div class="flex justify-center gap-2">
				<input
					type="checkbox"
					name="attending"
					id="attending"
					checked={data.personData?.attendingEvent}
				/>
				<label for="attending">Are you attending {eventKey}?</label>
			</div>

			<div class="flex justify-center gap-2">
				<input type="checkbox" name="loadin" id="loadin" />
				<label for="loadin">Are you attending load in for {eventKey}?</label>
			</div>
		</div>
		<div class="question">
			<h1>Are you interested in...</h1>
			<div class="flex justify-center gap-2">
				<input
					type="checkbox"
					name="pits"
					id="pits"
					checked={(data.personData?.preferences.doPits ?? 0 > 0) ? true : false}
				/>
				<label for="pits">Working in the pits?</label>
			</div>
			<div class="flex justify-center gap-2">
				<input
					type="checkbox"
					name="media"
					id="media"
					checked={data.personData?.preferences.doMedia}
				/>
				<label for="media">Media?</label>
			</div>
			<div class="flex justify-center gap-2">
				<input
					type="checkbox"
					name="strategy"
					id="strategy"
					checked={data.personData?.preferences.doStrategy}
				/>
				<label for="strategy">Strategy?</label>
			</div>
			<div class="flex justify-center gap-2">
				<input
					type="checkbox"
					name="journalism"
					id="journalism"
					checked={data.personData?.preferences.doJournalism}
				/>
				<label for="journalism">Journalism?</label>
			</div>
		</div>

		<input type="hidden" name="personUUID" value={personUUID} />

		<button id="submit" class="button-primary">Submit</button>
	</form>
{/if}

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
	label {
		font-family: 'Nunito', sans-serif;
		font-optical-sizing: auto;
		font-weight: 400;
		font-style: normal;
		font-size: x-large;
	}
	.question {
		margin: auto;
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-around;
		border-radius: 0.75rem;
		padding: 1.25rem;
		background-color: var(--black2);
		gap: 0.5rem;
		height: fit;
		width: SubmitFunction;
	}
</style>
