import { deleteSession } from '$lib/db';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
	const sessionID = cookies.get('session');
	if (sessionID) await deleteSession(sessionID);
	cookies.delete('session', { path: '/' });

	const adminSessionID = cookies.get('adminSession');
	if (adminSessionID) await deleteSession(adminSessionID);
	cookies.delete('adminSession', { path: '/' });
	redirect(303, '/login');
};
