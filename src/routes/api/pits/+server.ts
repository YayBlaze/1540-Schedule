import { formatName, getCurrentSchedule } from '$lib/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const schedule = await getCurrentSchedule();
	let inPits = [];
	for (const person of schedule) {
		if (person.role == 'Pits') inPits.push(person.personID);
	}
	let names = [];
	for (const personID of inPits) {
		let name = await formatName(personID);
		names.push(name);
	}
	return json(names);
};
