import { getCurrentSchedule, getPerson } from '$lib/db';
import { Role } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const schedule = await getCurrentSchedule();
	let inPits = [];
	for (const person of schedule) {
		if (person.role == Role.Pits) inPits.push(person.personUUID);
	}
	let names = [];
	for (const personUUID of inPits) {
		const person = await getPerson(personUUID);
		names.push(person.displayName);
	}
	return json(names);
};
