import type { Actions } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	let searchParams = url.searchParams;
	let msg = searchParams.get('msg') ?? '';
	let color = searchParams.get('color') ?? '#ee2c2c';
	return { msg, color };
};

export const actions = {
	guest: async ({ cookies }) => {
		cookies.set('session', 'guest', { path: '/' });
		redirect(303, '/');
	}
} satisfies Actions;
