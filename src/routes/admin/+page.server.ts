import {
	changePersonStatus,
	getPeople,
	getSlots,
	removePerson,
	setMilestone,
	updateRolePool
} from '$lib/db';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { RolePool } from '$lib/types';
import { addPerson } from '$lib/db';
import { generateSchedule } from '$lib/schedule';
import { getLunchTimes } from '$lib/nexus';

export const load: PageServerLoad = async () => {
	const people = await getPeople();
	let slots = await getSlots();
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	const startOfDay = date.getTime();
	date.setHours(23, 59, 59, 999);
	const endOfDay = date.getTime();

	slots = slots.filter((v) => {
		return v.startTimestamp > startOfDay && v.startTimestamp < endOfDay;
	});
	const lunch = await getLunchTimes();
	let times = {
		lunchStart: new Date(lunch.startTimestamp).toLocaleTimeString(),
		lunchEnd: new Date(lunch.endTimestamp).toLocaleTimeString(),
		dayStart: new Date(slots[0].startTimestamp).toLocaleTimeString(),
		dayEnd: new Date(slots[slots.length - 1].endTimestamp).toLocaleTimeString()
	};
	return { people, times };
};

export const actions = {
	generate: async () => await generateSchedule(),
	assign: async ({ request }) => {
		const data = await request.formData();
		const uuid = data.get('person')?.toString();
		const role = data.get('role')?.toString();
		if (!uuid || !role) return fail(400);
		const rolePool = role as RolePool;
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
	},
	saveCompSettings: async ({ request }) => {
		const data = await request.formData();
		const lunchStart = data.get('lunchStart')?.toString();
		const lunchEnd = data.get('lunchEnd')?.toString();
		if (!lunchStart || !lunchEnd) return fail(400);
		await setMilestone({ name: 'lunch', start: parseInt(lunchStart), end: parseInt(lunchEnd) });
	}
} satisfies Actions;
