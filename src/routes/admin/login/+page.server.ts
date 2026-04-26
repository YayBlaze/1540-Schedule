import { isValidSession, newSession } from '$lib/db';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { admin_password } from '$env/static/private';

export const load: PageServerLoad = async ({ locals, url }) => {
	const sessionID = locals.sessionID;
	if (sessionID && (await isValidSession(sessionID, 'admin'))) redirect(303, '/admin');
	let searchParams = url.searchParams;
	let msg = searchParams.get('msg') ?? '';
	let color = searchParams.get('color') ?? '#ee2c2c';
	let usr = searchParams.get('usr') ?? '';
	return { msg, color, usr, pass: '' };
};

export const actions = {
	default: async ({ cookies, request }) => {
		const data = await request.formData();
		let pass = data.get('pass')?.toString();
		if (!pass) return fail(400, { auth: false, msg: 'Please provide a password' });
		if (pass != admin_password) return fail(401, { auth: false, msg: 'Incorrect Password' });
		const sessionID = await newSession('admin');
		cookies.set('adminSession', sessionID, { path: '/' });
		redirect(303, '/admin');
	}
} satisfies Actions;
