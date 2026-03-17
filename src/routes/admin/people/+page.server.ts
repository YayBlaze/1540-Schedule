import { getPeople } from '$lib/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const people = getPeople();
	return { people };
};
