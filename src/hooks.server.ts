import { isValidSession } from '$lib/db';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname != '/admin') return await resolve(event);
	const sessionID = event.cookies.get('session');
	if (!sessionID) return redirect(303, '/admin/login');
	event.locals.sessionID = sessionID;
	const isValid = await isValidSession(sessionID);
	if (!isValid) return redirect(303, '/admin/login');
	return await resolve(event);
};
