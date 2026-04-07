import { getNamesInRole, msToSlot } from '$lib/db';
import { Role } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const slot = await msToSlot(Date.now());
	if (!slot) return json({ slot: null, pits: [], leads: [] });
	let pits = await getNamesInRole(Role.Pits, slot.num);
	let leads = await getNamesInRole(Role.PitLead, slot.num);
	return json({ slot: slot.label, pits, leads });
};
