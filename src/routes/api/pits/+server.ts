import { getNamesInRole } from '$lib/db';
import { Role } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	let pits = getNamesInRole(Role.Pits);
	let leads = getNamesInRole(Role.PitLead);
	return json({ pits, leads });
};
