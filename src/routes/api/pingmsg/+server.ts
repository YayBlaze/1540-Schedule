import type { RequestHandler } from '@sveltejs/kit';
import { text } from '@sveltejs/kit';
import { getPeopleAtEvent } from '$lib/db';

export const GET: RequestHandler = async () => {
	let msg =
		'Below is the list of people I have scheduled to attend the event. If you are attending the event but are not in the list, or you are int he list but are not attending, please let me know ASAP.\n';
	const people = await getPeopleAtEvent();
	people.forEach((person) => (msg += `${person.displayName}, `));
	return text(msg);
};
