import { redirect, type RequestHandler } from '@sveltejs/kit';
import { generateState, OAuth2Client } from 'arctic';
import { oAuthCallbackURL, oAuthClientID, oAuthClientSecret } from '$env/static/private';

export const GET: RequestHandler = async ({ cookies }) => {
	const veracross = new OAuth2Client(oAuthClientID, oAuthClientSecret, oAuthCallbackURL);
	const AUTH_URL = 'https://accounts.veracross.com/catlin/oauth/authorize';
	const state = generateState();

	const url = veracross.createAuthorizationURL(AUTH_URL, state, ['sso']);
	cookies.set('oauth_state', state, { path: '/', maxAge: 10 * 60 });

	throw redirect(302, url);
};
