import {
	changePersonStatus,
	getPeople,
	getSlots,
	importPreferences,
	removeCFG,
	removePerson,
	addPerson,
	setCFG,
	setSlot,
	setSlots,
	updateRolePool,
	importPeople,
	getCFG
} from '$lib/db';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { RolePool } from '$lib/types';
import { generateSchedule } from '$lib/schedule';
import { getLunchTimes, getEventTimes } from '$lib/nexus';

export const load: PageServerLoad = async () => {
	const dbTimings = await getCFG();
	const scheduleVisible =
		dbTimings.find((v) => v.key === 'scheduleVisible')?.value == '0' ? false : true;
	const people = await getPeople();
	let slots = await getSlots();
	const lunch = await getLunchTimes();
	const event = await getEventTimes();
	const dateString = (await getCFG()).find((v) => v.key === 'date')?.value;
	let times;
	if (lunch) {
		times = {
			lunchStart: new Date(lunch.lunchStart.time).toLocaleTimeString('en-US', { hour12: false }),
			lunchEnd: new Date(lunch.lunchEnd.time).toLocaleTimeString('en-US', { hour12: false }),
			dayStart: new Date(event.dayStart.time).toLocaleTimeString('en-US', { hour12: false }),
			dayEnd: new Date(event.dayEnd.time).toLocaleTimeString('en-US', { hour12: false })
		};
	} else {
		times = {};
	}
	return {
		scheduleVisible,
		people,
		times,
		fromDB: {
			eventStart: event.dayStart.fromDB,
			eventEnd: event.dayEnd.fromDB,
			lunchStart: lunch.lunchStart.fromDB,
			lunchEnd: lunch.lunchEnd.fromDB,
			date: dateString ? true : false
		},
		dateString: dateString ?? new Date().toLocaleDateString('en-US'),
		slots
	};
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
			await setCFG({ key: 'date', value: dateString });
		} else {
			await removeCFG('date');
		}

		if (lunchStart && lunchStart != '') {
			const lunchStartSplit = lunchStart.split(':');
			date.setHours(parseInt(lunchStartSplit[0]), parseInt(lunchStartSplit[1]), 0, 0);
			const lunchStartMS = date.getTime();
			await setCFG({ key: 'lunchStart', value: lunchStartMS });
		} else {
			await removeCFG('lunchStart');
		}

		if (lunchEnd && lunchEnd != '') {
			const lunchEndSplit = lunchEnd.split(':');
			date.setHours(parseInt(lunchEndSplit[0]), parseInt(lunchEndSplit[1]), 0, 0);
			const lunchEndMS = date.getTime();
			await setCFG({ key: 'lunchEnd', value: lunchEndMS });
		} else {
			await removeCFG('lunchEnd');
		}

		if (dayStart && dayStart != '') {
			const dayStartSplit = dayStart.split(':');
			date.setHours(parseInt(dayStartSplit[0]), parseInt(dayStartSplit[1]), 0, 0);
			const dayStartMS = date.getTime();
			await setCFG({ key: 'dayStart', value: dayStartMS });
		} else {
			await removeCFG('dayStart');
		}

		if (dayEnd && dayEnd != '') {
			const dayEndSplit = dayEnd.split(':');
			date.setHours(parseInt(dayEndSplit[0]), parseInt(dayEndSplit[1]), 0, 0);
			const dayEndMS = date.getTime();
			await setCFG({ key: 'dayEnd', value: dayEndMS });
		} else {
			await removeCFG('dayEnd');
		}
	},
	editSlot: async ({ request }) => {
		const data = await request.formData();
		const slotString = data.get('slotNum')?.toString();
		const startLabel = data.get('startLabel')?.toString();
		const startTimeString = data.get('startTimestamp')?.toString();
		const endLabel = data.get('endLabel')?.toString();
		const endTimeString = data.get('endTimestamp')?.toString();
		const allowUpdate = data.get('allowUpdates')?.toString() === 'on';
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
	importPeople: async ({}) => await importPeople(),
	toggleVisibility: async ({}) => {
		const dbTimings = await getCFG();
		const scheduleVisible =
			dbTimings.find((v) => v.key === 'scheduleVisible')?.value == '0' ? false : true;
		await setCFG({ key: 'scheduleVisible', value: !scheduleVisible });
	}
} satisfies Actions;
