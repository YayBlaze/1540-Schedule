import { oAuthCallbackURL, oAuthClientID, oAuthClientSecret } from '$env/static/private';
import { TOKEN_URL, USR_INFO_URL } from '$lib/oauth';
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

	let body = new URLSearchParams({
		grant_type: 'authorization_code',
		client_id: oAuthClientID,
		client_secret: oAuthClientSecret,
		code,
		redirect_uri: oAuthCallbackURL
	});

	let res = await fetch(TOKEN_URL, {
		method: 'POST',
		body,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	});
	let tokens = await res.json();

	res = await fetch(USR_INFO_URL, {
		headers: {
			Authorization: `Bearer ${tokens.access_token}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	});

	const user = await res.json();
	const username = user.preferred_username;
	if (username === 'forbesk@catlin.edu') redirect(303, '/auth?/guest');
	const person = await getPersonFromEmail(username);
	if (!person) return new Response('Invalid user', { status: 400 });

	const sessionID = await newSession(person.uuid);
	cookies.set('session', sessionID, { path: '/', maxAge: 60 * 60 * 1000 });
	return redirect(303, '/');
};
