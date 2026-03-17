import { getSchedule } from '$lib/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const schedule = getSchedule();
	return { schedule };
};
