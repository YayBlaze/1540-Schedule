import { formatName, getCurrentSchedule } from '$lib/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const schedule = await getCurrentSchedule();
	let scouting = [];
	for (const person of schedule) {
		if (person.role == 'Scouting') scouting.push(person.personID);
	}
	let names = [];
	for (const personID of scouting) {
		let name = await formatName(personID);
		names.push(name);
	}
	return json(names);
};
