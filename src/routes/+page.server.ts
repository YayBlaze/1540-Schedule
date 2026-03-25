import { getPeople, getSchedule, getSlots } from '$lib/db';
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

	return { view, schedule, slots };
};
