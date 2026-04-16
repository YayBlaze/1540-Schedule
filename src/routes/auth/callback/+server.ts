import { veracross, TOKEN_URL, USR_INFO_URL } from '$lib/auth';
import { getPersonFromEmail, newSession } from '$lib/db';
import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code) {
		return new Response('Missing code', { status: 400 });
	}

	// Verify state matches what we set (CSRF check)
	if (state !== cookies.get('oauth_state')) {
		return new Response('Invalid state', { status: 400 });
	}

	const tokens = await veracross.validateAuthorizationCode(TOKEN_URL, code, null);

	const res = await fetch(USR_INFO_URL, {
		headers: {
			Authorization: `Bearer ${tokens.accessToken()}`
		}
	});

	const user = await res.json();
	const username = user.preferred_username;
	console.log(username);
	const person = await getPersonFromEmail(username);
	if (!person) return new Response('Invalid user', { status: 400 });

	const sessionID = await newSession(person.uuid);
	cookies.set('session', sessionID, { path: '/' });
	return redirect(303, '/');
};
