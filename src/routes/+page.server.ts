import {
	getPeople,
	getNamesInRole,
	getSchedule,
	getSlots,
	msToSlot,
	getPerson,
	getCFG,
	isValidSession
} from '$lib/db';
import { Role } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const dbTimings = await getCFG();
	const scheduleVisible =
		dbTimings.find((v) => v.key === 'scheduleVisible')?.value == '0' ? false : true;
	const scheduleRAW = await getSchedule();
	const slots = await getSlots();
	const people = await getPeople();

	const sessionID = cookies.get('session') ?? '';

	const isValid = await isValidSession(sessionID);

	let searchParams = url.searchParams;
	let view = searchParams.get('view') ?? 'person';

	let peopleLookUp: any = {};
	for (let person of people) {
		peopleLookUp[person.uuid] = person.displayName;
	}

	let schedule = scheduleRAW.map((row) => ({
		name: peopleLookUp[row.personUUID],
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
				allowUpdate: true
			};
		else {
			nextSlot = {
				slotNumber: currentSlot.num + 1,
				startTimestamp: currentSlotDetailed.endTimestamp,
				endTimestamp: currentSlotDetailed.endTimestamp,
				startLabel: 'End of Day',
				endLabel: '',
				allowUpdate: true
			};
		}
	}

	let personUUID = cookies.get('uuid');
	let currentPerson: {
		personName: string | null;
		currentRole: Role | null;
		nextRole: Role | null;
	} = {
		personName: null,
		currentRole: null,
		nextRole: null
	};
	if (personUUID) {
		let personName = (await getPerson(personUUID))?.displayName;
		if (!personName) {
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
		let personSchedule = schedule.find((v) => v.name == personName);
		let currentRole = personSchedule?.slots[currentSlot.num - 1] ?? null;
		let nextRole = personSchedule?.slots[currentSlot.num] ?? null;
		currentPerson = { personName, currentRole, nextRole };
	}

	return {
		scheduleVisible,
		isAdmin: isValid,
		view,
		schedule,
		slots,
		roles,
		currentSlot,
		nextSlot,
		currentPerson
	};
};
