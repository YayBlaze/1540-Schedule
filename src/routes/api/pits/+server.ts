import { getCurrentSchedule, getPerson } from '$lib/db';
import { Role } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const schedule = await getCurrentSchedule();
	let inPits = [];
	let pitLead = [];
	for (const person of schedule) {
		if (person.role == Role.Pits) inPits.push(person.personUUID);
		else if (person.role == Role.PitLead) pitLead.push(person.personUUID);
	}
	let pitsNames = [];
	let leadsNames = [];
	for (const personUUID of inPits) {
		const person = await getPerson(personUUID);
		pitsNames.push(person.displayName);
	}
	for (const personUUID of pitLead) {
		const person = await getPerson(personUUID);
		leadsNames.push(person.displayName);
	}
	return json({ pits: pitsNames, leads: leadsNames });
};
