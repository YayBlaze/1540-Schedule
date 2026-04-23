import {
	getPeople,
	getNamesInRole,
	getSchedule,
	getSlots,
	msToSlot,
	getPerson,
	getCFG,
	isValidSession,
	identityFromSessionID,
	getIncomingRequests
} from '$lib/db';
import { Role, type PersonData } from '$lib/types';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
	let sessionID = cookies.get('session');
	if (!sessionID) return redirect(303, '/auth');
	if (sessionID != 'guest') {
		const identity = await identityFromSessionID(sessionID);
		if (!(await isValidSession(sessionID, identity))) return redirect(303, '/logout');
	}
	let personUUID: string | null = await identityFromSessionID(sessionID);
	const dbTimings = await getCFG();
	const scheduleVisible =
		dbTimings.find((v) => v.key === 'scheduleVisible')?.value == '0' ? false : true;
	const scheduleRAW = await getSchedule();
	const slots = await getSlots();
	const people = await getPeople();

	const adminSession = cookies.get('adminSession') ?? '';
	const isAdmin = await isValidSession(adminSession, 'admin');

	let searchParams = url.searchParams;
	let view = searchParams.get('view') ?? 'person';

	let peopleLookUp: any = {};
	for (let person of people) {
		peopleLookUp[person.uuid] = person.displayName;
	}

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
	schedule.sort((a, b) => a.name.localeCompare(b.name));

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

	let currentSlot = await msToSlot(Date.now());
	if (!currentSlot) {
		currentSlot = {
			num: 0,
			label: 'None'
		};
	}
	let nextSlot = slots[currentSlot.num];
	if (!nextSlot) {
		let currentSlotDetailed = slots[currentSlot.num - 1];
		if (!currentSlotDetailed)
			nextSlot = {
				slotNumber: currentSlot.num + 1,
				startTimestamp: -1,
				endTimestamp: -1,
				startLabel: 'None',
				endLabel: '',
				allowUpdate: true,
				doScouting: true
			};
		else {
			nextSlot = {
				slotNumber: currentSlot.num + 1,
				startTimestamp: currentSlotDetailed.endTimestamp,
				endTimestamp: currentSlotDetailed.endTimestamp,
				startLabel: 'None',
				endLabel: '',
				allowUpdate: true,
				doScouting: true
			};
		}
	}

	let currentPerson: {
		data: PersonData | null;
		currentRole: Role | null;
		nextRole: Role | null;
	} = {
		data: null,
		currentRole: null,
		nextRole: null
	};
	if (personUUID) {
		let data = await getPerson(personUUID);
		if (!data) {
			cookies.delete('uuid', { path: '/' });
			return {
				scheduleVisible,
				view,
				schedule,
				slots,
				roles,
				currentSlot,
				nextSlot,
				currentPerson
			};
		}
		let personSchedule = schedule.find((v) => v.name == data.displayName);
		let currentRole = personSchedule?.slots[currentSlot.num - 1] ?? null;
		let nextRole = personSchedule?.slots[currentSlot.num] ?? null;
		currentPerson = { data, currentRole, nextRole };
	}

	let tradeRequestData = {
		uuid: null,
		person: null
	};
	if (personUUID) {
		const receivingRequests: any[] = await getIncomingRequests(personUUID);
		if (receivingRequests && receivingRequests.length > 0) {
			tradeRequestData = {
				uuid: receivingRequests[0].requestUUID,
				person: peopleLookUp[receivingRequests[0].personInit]
			};
		}
	}

	return {
		scheduleVisible,
		isAdmin,
		view,
		schedule,
		slots,
		roles,
		currentSlot,
		nextSlot,
		currentPerson,
		tradeRequestData
	};
};
