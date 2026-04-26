import type { Actions } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const actions = {
	guest: async ({ cookies }) => {
		cookies.set('session', 'guest', { path: '/' });
		redirect(303, '/');
	}
} satisfies Actions;
