import {
	getIncomingRequests,
	getNamesInRole,
	getPeople,
	getPerson,
	getPersonSchedule,
	getSchedule,
	isValidSession,
	updatePerson
} from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { getSlots } from '$lib/db';
import { Role, type PersonData } from '$lib/types';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const personUUID = params.slug;
	const sessionID = cookies.get('session') ?? '';
	const adminSession = cookies.get('adminSession') ?? '';
	const isPerson = await isValidSession(sessionID, personUUID);
	const isAdmin = await isValidSession(adminSession, 'admin');
	if (!isPerson && !isAdmin) await redirect(303, '/');

	const people = await getPeople();
	const personData = people.find((person) => person.uuid === personUUID);
	if (!personData) return redirect(303, '/auth');

	let peopleLookUp: any = {};
	for (let person of people) {
		peopleLookUp[person.uuid] = person.displayName;
	}

	const showSuccess = url.searchParams.get('success') == 'true';

	const slots = await getSlots();
	let scheduleRAW = await getSchedule();
	let schedule = scheduleRAW.map((row) => ({
		name: peopleLookUp[row.personUUID],
		uuid: row.personUUID,
		slots: Object.keys(row)
			.filter(
				(key) =>
					key.startsWith('slot') && parseInt(key.slice(-1)) <= (slots.at(-1)?.slotNumber ?? 0)
			)
			.map((key) => row[key as keyof typeof row] as Role)
	}));

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

	let tradeRequestData: {
		uuid: string | null;
		person: string | null;
		slot: number | null;
		incomingRole: Role | null;
		outgoingRole: Role | null;
	} = {
		uuid: null,
		person: null,
		slot: null,
		incomingRole: null,
		outgoingRole: null
	};
	if (personUUID) {
		const receivingRequests: any[] = await getIncomingRequests(personUUID);
		if (receivingRequests && receivingRequests.length > 0) {
			tradeRequestData = {
				uuid: receivingRequests[0].requestUUID,
				person: peopleLookUp[receivingRequests[0].personInit],
				slot: receivingRequests[0].slotID,
				incomingRole:
					schedule.find((v) => v.uuid === receivingRequests[0].personInit)?.slots[
						receivingRequests[0].slotID - 1
					] ?? null,
				outgoingRole:
					schedule.find((v) => v.uuid === personData.uuid)?.slots[
						receivingRequests[0].slotID - 1
					] ?? null
			};
		}
	}

	return { personData, people, schedule, slots, roles, tradeRequestData, showSuccess };
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
