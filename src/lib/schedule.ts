import { getPeople } from './db';

export async function generateSchedule() {
	let people = await getPeople();
}
