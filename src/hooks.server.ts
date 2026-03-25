import { initDB, isValidSession } from '$lib/db';
import { fetchData } from '$lib/nexus';
import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';

export const init: ServerInit = async () => {
	await initDB();
	await fetchData();
};

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname != '/admin') return await resolve(event);
	const sessionID = event.cookies.get('session');
	if (!sessionID) return redirect(303, '/admin/login');
	event.locals.sessionID = sessionID;
	const isValid = await isValidSession(sessionID);
	if (!isValid) return redirect(303, '/admin/login');
	return await resolve(event);
};
