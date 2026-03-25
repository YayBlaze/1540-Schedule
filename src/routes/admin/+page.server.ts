import { changePersonStatus, getPeople, removePerson, updateRolePool } from '$lib/db';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { RolePool } from '$lib/types';
import { addPerson } from '$lib/db';
import { generateSchedule } from '$lib/schedule';

export const load: PageServerLoad = async () => {
	const people = await getPeople();
	return { people };
};

export const actions = {
	generate: async () => await generateSchedule(),
	assign: async ({ request }) => {
		const data = await request.formData();
		const uuid = data.get('person')?.toString();
		const role = data.get('role')?.toString();
		if (!uuid || !role) return fail(400);
		const rolePool = RolePool[role as keyof typeof RolePool];
		await updateRolePool(uuid, rolePool);
	},
	deleteAssignment: async ({ request }) => {
		const data = await request.formData();
		const uuid = data.get('id')?.toString();
		if (!uuid) return fail(400);
		await updateRolePool(uuid, RolePool.None);
	},
	newPerson: async ({ request }) => {
		const data = await request.formData();
		const firstName = data.get('firstName')?.toString();
		const lastName = data.get('lastName')?.toString();
		if (!firstName || !lastName) return fail(400);
		await addPerson({ firstName, lastName });
	},
	deletePerson: async ({ request }) => {
		const data = await request.formData();
		const uuid = data.get('id')?.toString();
		if (!uuid) return fail(400);
		await removePerson(uuid);
	},
	updateStatus: async ({ request }) => {
		const data = await request.formData();
		const uuid = data.get('id')?.toString();
		if (!uuid) return fail(400);
		await changePersonStatus(uuid);
	},
	addException: async ({ request }) => {
		const data = await request.formData();
		const uuid = data.get('id')?.toString();
		if (!uuid) return fail(400);
	}
} satisfies Actions;
