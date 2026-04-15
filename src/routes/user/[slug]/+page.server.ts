import {
	getNamesInRole,
	getPerson,
	getPersonSchedule,
	isValidSession,
	updatePerson
} from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { getSlots } from '$lib/db';
import { Role, type PersonData } from '$lib/types';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const personUUID = params.slug;
	const sessionID = cookies.get('session') ?? '';
	const adminSession = cookies.get('adminSession') ?? '';
	const isPerson = await isValidSession(sessionID, personUUID);
	const isAdmin = await isValidSession(adminSession, 'admin');
	if (!isPerson && !isAdmin) await redirect(303, '/');

	const personData = await getPerson(personUUID);
	if (!personData) return redirect(303, '/login');

	const slots = await getSlots();
	const personScheduleRaw = await getPersonSchedule(personData.uuid);
	let personSchedule = Object.keys(personScheduleRaw)
		.filter(
			(key) => key.startsWith('slot') && parseInt(key.slice(-1)) <= (slots.at(-1)?.slotNumber ?? 0)
		)
		.map((key) => personScheduleRaw[key as keyof typeof personScheduleRaw] as Role);

	let roles: Record<string, string[]>[] = [];
	for (let slot of slots) {
		let sn = slot.slotNumber;
		roles.push({
			Open: await getNamesInRole(Role.Open, sn),
			Pits: await getNamesInRole(Role.Pits, sn),
			'Pit Lead': await getNamesInRole(Role.PitLead, sn),
			Scouting: await getNamesInRole(Role.Scouting, sn),
			Strategy: await getNamesInRole(Role.Strategy, sn),
			Drive: await getNamesInRole(Role.Drive, sn),
			Media: await getNamesInRole(Role.Media, sn),
			Journalism: await getNamesInRole(Role.Journalism, sn),
			'Tiara Judge': await getNamesInRole(Role.TiaraJudge, sn)
		});
	}

	return { personData, personSchedule, slots, roles };
};

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const personDataString = data.get('personData')?.toString();
		if (!personDataString) return fail(400);
		const personData = JSON.parse(personDataString) as PersonData;
		updatePerson(personData);
	}
} satisfies Actions;
