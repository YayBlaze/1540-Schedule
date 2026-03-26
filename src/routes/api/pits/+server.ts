import { getNamesInRole, msToSlot } from '$lib/db';
import { Role } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const slot = await msToSlot(Date.now());
	let pits = await getNamesInRole(Role.Pits, parseInt(slot.num.split('slot')[1]));
	let leads = await getNamesInRole(Role.PitLead, parseInt(slot.num.split('slot')[1]));
	return json({ pits, leads });
};
