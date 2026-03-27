import { getNamesInRole, msToSlot } from '$lib/db';
import { Role } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const slot = await msToSlot(Date.now());
	return json(await getNamesInRole(Role.Scouting, slot.num));
};
