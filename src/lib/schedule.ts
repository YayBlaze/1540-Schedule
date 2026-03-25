import { getPeople, setPersonSchedule, setSlot } from './db';
import { lunch as getLunch, ourMatches } from './nexus';
import { Role } from './types';

export async function generateSchedule() {
	await generateSlotsDummy();
	let people = await getPeople();
	for (let person of people) {
		let schedule = [];
		let values = Object.values(Role).filter((v) => typeof v === 'number');
		values.push(Role.Open);
		for (let i = 0; i < 11; i++) {
			const random = values[Math.floor(Math.random() * values.length)];
			schedule.push(random);
		}
		await setPersonSchedule(person.uuid, schedule);
	}
}

export async function generateSlotsNexus() {
	const matches = ourMatches();
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	const startOfDay = date.getTime();
	date.setHours(23, 59, 59, 999);
	const endOfDay = date.getDate();
	const lunchTimes = getLunch();
	let id = 0;
	for (let i = 0; i < matches.length; i++) {
		let match = matches[i];
		let nextMath = matches[i + 1];
		if (match.times.estimatedStartTime < startOfDay || match.times.estimatedQueueTime > endOfDay)
			continue;
		let slotData = {
			id,
			startTimestamp: match.times.estimatedStartTime,
			endTimestamp: nextMath.times.estimatedStartTime,
			startLabel: match.label,
			endLabel: nextMath.label
		};
		if (
			match.times.estimatedStartTime < lunchTimes.starts &&
			nextMath.times.estimatedStartTime > lunchTimes.ends
		) {
			slotData = {
				id,
				startTimestamp: match.times.estimatedStartTime,
				endTimestamp: lunchTimes.starts,
				startLabel: match.label,
				endLabel: 'Lunch'
			};
		}
		await setSlot(slotData);
		id++;
	}
}
export async function generateSlotsDummy() {
	let matchNum = 0;
	let startTimestamp = Date.now();
	for (let id = 1; id <= 11; id++) {
		await setSlot({
			id,
			startTimestamp,
			endTimestamp: startTimestamp + 10 * 5 * 60 * 1000,
			startLabel: matchNum > 0 ? `QM${matchNum}` : `QM${matchNum + 1}`,
			endLabel: `QM${matchNum + 10}`
		});
		matchNum += 10;
		startTimestamp += 10 * 5 * 60 * 1000;
	}
}
