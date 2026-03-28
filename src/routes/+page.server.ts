import { getPeople, getNamesInRole, getSchedule, getSlots, msToSlot } from '$lib/db';
import { Role } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const scheduleRAW = await getSchedule();
	const slots = await getSlots();
	const people = await getPeople();

	let searchParams = url.searchParams;
	let view = searchParams.get('view') ?? 'person';

	let peopleLookUp: any = {};
	for (let person of people) {
		peopleLookUp[person.uuid] = person.displayName;
	}

	let schedule = scheduleRAW.map((row) => ({
		name: peopleLookUp[row.personUUID],
		slots: Object.keys(row)
			.filter((key) => key.startsWith('slot'))
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
			Journalism: await getNamesInRole(Role.Journalism, sn)
		});
	}

	let currentSlot = await msToSlot(Date.now());
	if (!currentSlot) {
		currentSlot = {
			num: -1,
			label: 'None'
		};
		let nextSlot = null;
		return { view, schedule, slots, roles, currentSlot, nextSlot };
	}
	let nextSlot = await slots[currentSlot.num];
	if (!nextSlot) {
		let currentSlotDetailed = slots[currentSlot.num - 1];
		nextSlot = {
			slotNumber: currentSlot.num + 1,
			startTimestamp: currentSlotDetailed.endTimestamp,
			endTimestamp: currentSlotDetailed.endTimestamp,
			startLabel: 'End of Day',
			endLabel: ''
		};
	}

	return { view, schedule, slots, roles, currentSlot, nextSlot };
};
