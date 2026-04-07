import { getPeople } from '$lib/db';
import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const people = await getPeople();
	return { people };
};

export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const personUUID = data.get('personSelect')?.toString();
		if (!personUUID) {
			return fail(400);
		} else {
			cookies.set('uuid', personUUID, { path: '/' });
			redirect(303, '/');
		}
	}
} satisfies Actions;
