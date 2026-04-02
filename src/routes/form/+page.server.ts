import { addPerson, changePersonStatus, getPeople, getPerson, updatePreferences } from '$lib/db';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Preferences } from '$lib/types';

export const load: PageServerLoad = async ({ cookies }) => {
	let personUUID = cookies.get('uuid');

	const people = await getPeople();

	let personData = null;
	if (personUUID) personData = await getPerson(personUUID);

	return { personUUID, personData, people };
};

export const actions = {
	selectPerson: async ({ request, cookies }) => {
		const data = await request.formData();
		const personUUID = data.get('personSelect')?.toString();
		if (!personUUID) {
			const firstName = data.get('firstName')?.toString();
			const lastName = data.get('lastName')?.toString();
			if (!firstName || !lastName) return fail(400);
			let newPersonUUID = await addPerson({ firstName, lastName });
			cookies.set('uuid', newPersonUUID, { path: '/' });
		} else {
			cookies.set('uuid', personUUID, { path: '/' });
		}
	},
	submitForm: async ({ request }) => {
		const data = await request.formData();
		const personUUID = data.get('personUUID')?.toString();
		if (!personUUID) return fail(400);
		const attending = data.get('attending')?.toString() === 'on';
		const pits = data.get('pits')?.toString() === 'on';
		const media = data.get('media')?.toString() === 'on';
		const strategy = data.get('strategy')?.toString() === 'on';
		const journalism = data.get('journalism')?.toString() === 'on';

		let preferences: Preferences = {
			doPits: pits ? 1 : 0,
			doJournalism: journalism,
			doMedia: media,
			doStrategy: strategy
		};
		await updatePreferences(personUUID, preferences);

		const personData = await getPerson(personUUID);
		if (personData?.attendingEvent != attending) await changePersonStatus(personUUID);
	}
} satisfies Actions;
