import { redirect, type RequestHandler } from '@sveltejs/kit';
import { veracross, AUTH_URL } from '$lib/oauth';
import { generateState } from 'arctic';

export const GET: RequestHandler = async ({ cookies }) => {
	const state = generateState();

	const url = veracross.createAuthorizationURL(AUTH_URL, state, ['sso']);
	cookies.set('oauth_state', state, { path: '/', maxAge: 10 * 60 });

	throw redirect(302, url);
};
