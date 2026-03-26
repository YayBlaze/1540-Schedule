import { getNamesInRole } from '$lib/db';
import { Role } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return json(getNamesInRole(Role.Scouting));
};
