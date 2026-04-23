import { oAuthCallbackURL, oAuthClientID, oAuthClientSecret } from '$env/static/private';
import { OAuth2Client } from 'arctic';

export const veracross = new OAuth2Client(oAuthClientID, oAuthClientSecret, oAuthCallbackURL);

export const AUTH_URL = 'https://accounts.veracross.com/catlin/oauth/authorize';
export const TOKEN_URL = 'https://accounts.veracross.com/catlin/oauth/token';
export const USR_INFO_URL = 'https://accounts.veracross.com/catlin/oauth/userinfo';
