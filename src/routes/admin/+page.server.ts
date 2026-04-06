import {
	changePersonStatus,
	getPeople,
	getSlots,
	importPreferences,
	removeMilestone,
	removePerson,
	addPerson,
	setMilestone,
	setSlot,
	setSlots,
	updateRolePool,
	importPeople
} from '$lib/db';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { RolePool } from '$lib/types';
import { generateSchedule } from '$lib/schedule';
import { getLunchTimes, getEventTimes } from '$lib/nexus';

export const load: PageServerLoad = async () => {
	const people = await getPeople();
	let slots = await getSlots();
	const lunch = await getLunchTimes();
	const { dayStart, dayEnd } = await getEventTimes();
	let times;
	if (lunch) {
		times = {
			lunchStart: new Date(lunch.startTimestamp).toLocaleTimeString('en-US', { hour12: false }),
			lunchEnd: new Date(lunch.endTimestamp).toLocaleTimeString('en-US', { hour12: false }),
			dayStart: new Date(dayStart).toLocaleTimeString('en-US', { hour12: false }),
			dayEnd: new Date(dayEnd).toLocaleTimeString('en-US', { hour12: false })
		};
	} else {
		times = {};
	}
	return { people, times, date: new Date(dayStart).toLocaleDateString('en-US'), slots };
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
		const email = data.get('email')?.toString();
		if (!firstName || !lastName || !email) return fail(400);
		await addPerson({ firstName, lastName, email });
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
		const dayStart = data.get('dayStart')?.toString();
		const dayEnd = data.get('dayEnd')?.toString();
		const dateString = data.get('date')?.toString();

		const date = new Date();
		const dateStringSplit = dateString?.split('/') ?? null;
		if (dateStringSplit) {
			date.setFullYear(
				parseInt(dateStringSplit[2]),
				parseInt(dateStringSplit[0]) - 1,
				parseInt(dateStringSplit[1])
			);
		}
		if (lunchStart && lunchStart != '' && lunchEnd && lunchEnd != '') {
			const lunchStartSplit = lunchStart.split(':');
			const lunchEndSplit = lunchEnd.split(':');
			date.setHours(parseInt(lunchStartSplit[0]), parseInt(lunchStartSplit[1]), 0, 0);
			const lunchStartMS = date.getTime();
			date.setHours(parseInt(lunchEndSplit[0]), parseInt(lunchEndSplit[1]), 0, 0);
			const lunchEndMS = date.getTime();
			await setMilestone({ name: 'lunch', start: lunchStartMS, end: lunchEndMS });
		} else {
			await removeMilestone('lunch');
		}

		if (dayStart && dayStart != '' && dayEnd && dayEnd != '') {
			const dayStartSplit = dayStart.split(':');
			const dayEndSplit = dayEnd.split(':');
			date.setHours(parseInt(dayStartSplit[0]), parseInt(dayStartSplit[1]), 0, 0);
			const dayStartMS = date.getTime();
			date.setHours(parseInt(dayEndSplit[0]), parseInt(dayEndSplit[1]), 0, 0);
			const dayEndMS = date.getTime();
			await setMilestone({ name: 'event', start: dayStartMS, end: dayEndMS });
		} else {
			await removeMilestone('event');
		}
	},
	editSlot: async ({ request }) => {
		const data = await request.formData();
		const slotString = data.get('slotNum')?.toString();
		const startLabel = data.get('startLabel')?.toString();
		const startTimeString = data.get('startTimestamp')?.toString();
		const endLabel = data.get('endLabel')?.toString();
		const endTimeString = data.get('endTimestamp')?.toString();
		const allowUpdate = data.get('allowUpdate')?.toString() === 'on';
		if (!slotString || !startTimeString || !endTimeString) return fail(400);
		let slotNumber = parseInt(slotString);
		if (!startLabel || !endLabel) {
			let slots = await getSlots();
			slots.splice(slotNumber, 1);
			await setSlots(slots);
		} else {
			let startTimestamp = new Date(startTimeString).getTime();
			let endTimestamp = new Date(endTimeString).getTime();
			await setSlot({
				slotNumber,
				startLabel,
				startTimestamp,
				endLabel,
				endTimestamp,
				allowUpdate
			});
		}
	},
	importPrefs: async ({}) => await importPreferences(),
	importPeople: async ({}) => await importPeople()
} satisfies Actions;
