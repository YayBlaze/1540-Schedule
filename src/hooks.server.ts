import { clearSessions, getPeople, initDB, isValidSession, msToSlot } from '$lib/db';
import { fetchData } from '$lib/nexus';
import { updateSlotTiming } from '$lib/schedule';
import { sendRoleUpdate } from '$lib/slack';
import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';

export const init: ServerInit = async () => {
	await initDB();
	await fetchData();
	let ticks = 0;
	let lastTick = Date.now();
	setInterval(async () => {
		if (ticks % (5 * 60 * 1000) == 0) updateSlotTiming();
		if (ticks % (5 * 60 * 60 * 1000) == 0) clearSessions();
		if ((await msToSlot(Date.now()))?.num != (await msToSlot(lastTick))?.num) {
			(await getPeople()).forEach((person) => sendRoleUpdate(person.uuid));
		}
		lastTick = Date.now();
		ticks++;
	}, 10 * 1000);
};

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname != '/admin') return await resolve(event);
	const sessionID = event.cookies.get('adminSession');
	if (!sessionID) return redirect(303, '/admin/login');
	event.locals.sessionID = sessionID;
	const isValid = await isValidSession(sessionID, 'admin');
	if (!isValid) return redirect(303, '/admin/login');
	return await resolve(event);
};
