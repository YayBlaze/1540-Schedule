import {
	clearSchedule,
	clearSlots,
	getPeopleAtEvent,
	getSlots,
	msToRelative,
	setPersonSchedule,
	setSlot,
	setSlots
} from '$lib/db';
import {
	getLunchTimes,
	ourMatches,
	formatMatchLabel,
	fetchData,
	getEventTimes,
	lastMatch as getLastMatch
} from '$lib/nexus';
import { Role, RolePool, type slotData } from '$lib/types';

export async function generateSchedule() {
	await clearSchedule();
	const people = (await getPeopleAtEvent())
		.filter((p) => p.attendingEvent)
		.sort(() => Math.random() - 0.5);
	let slots = (await getSlots()).map((v) => {
		return {
			numPits: 0,
			numScouting: 0,
			numStrategy: 0,
			numJournalism: 0,
			numMedia: 0,
			...v
		};
	});

	const roleNumbers = {
		scouting: 6,
		pits: 3,
		strategy: 2,
		journalism: 1,
		media: 1
	};

	const totalTime = slots.reduce((sum, slot) => sum + slot.endTimestamp - slot.startTimestamp, 0);
	const averagePitTime =
		(totalTime * roleNumbers.pits) / people.filter((p) => p.preferences.doPits).length;
	const averageScoutingTime = (totalTime * roleNumbers.scouting) / people.length;
	const tolerance = 60 * 60 * 1000; // the amount of ms a person's pits/scouting time can be away from the average

	for (const person of people) {
		console.log('Doing', person.displayName);
		let schedule: Role[] = new Array(slots.length).fill(Role.Open);
		switch (person.rolePool) {
			case RolePool.Drive:
				schedule.fill(Role.Drive);
			case RolePool.PitLead:
				schedule.fill(Role.PitLead);
			case RolePool.ONLY_Strategy:
				schedule.fill(Role.Strategy);
			default: {
				// decide pits
				let attempts = 0;
				while (true) {
					if (!person.preferences.doPits) break;
					slots.sort(() => Math.random() - 0.5);
					let pitTime = 0;
					let selectedSlots = [];
					for (let i = 0; i < 3; i++) {
						if (slots[i].numPits >= roleNumbers.pits) continue;
						pitTime += slots[i].endTimestamp - slots[i].startTimestamp;
						selectedSlots.push(slots[i]);
					}
					if (Math.abs(averagePitTime - pitTime) <= tolerance || attempts > 10) {
						selectedSlots.forEach((slot) => {
							slot.numPits++;
							schedule[slot.slotNumber - 1] = Role.Pits;
						});
						break;
					}
					console.log(
						'Pit Time: ',
						msToRelative(pitTime),
						'Goal: ',
						msToRelative(averagePitTime),
						'Tolerance: ',
						msToRelative(tolerance),
						'Difference: ',
						msToRelative(pitTime - averagePitTime)
					);
					attempts++;
				}
			}
		}
		console.log('Setting Schedule');
		setPersonSchedule(person.uuid, schedule);
		console.log('Done');
	}
}

export async function updateSlotTiming() {
	await fetchData();
	const matches = await ourMatches();
	const slots = await getSlots();
	if (!matches || !slots) {
		console.error(
			`Failed to update slot timing at ${new Date().toLocaleTimeString('en-US', { hour12: false })}: Has matches ${!!matches}, has slots ${!!slots}`
		);
		return;
	}
	console.log(
		`Starting to update slot timing at ${new Date().toLocaleTimeString('en-US', { hour12: false })}`
	);
	for (let slot of slots) {
		if (!slot.allowUpdate) continue;
		let startMatchTime = matches.find((match) => formatMatchLabel(match.label) == slot.startLabel)
			?.times.estimatedStartTime;
		if (startMatchTime && startMatchTime != slot.startTimestamp) {
			console.log(
				`Updated slot ${slot.startLabel}-${slot.endLabel} to start at ${new Date(startMatchTime).toLocaleTimeString('en-US', { hour12: false })}`
			);
			slot.startTimestamp = startMatchTime;
		}
		let endMatchTime = matches.find((match) => formatMatchLabel(match.label) == slot.endLabel)
			?.times.estimatedStartTime;
		if (endMatchTime && endMatchTime != slot.endTimestamp) {
			console.log(
				`Updated slot ${slot.startLabel}-${slot.endLabel} to end at ${new Date(endMatchTime).toLocaleTimeString('en-US', { hour12: false })}`
			);
			slot.endTimestamp = endMatchTime;
		}
		await setSlot(slot);
	}
	console.log('Finished');
}

export async function generateSlotsNexus() {
	await clearSlots();
	const matches = await ourMatches();
	if (!matches || matches.length < 1) return await generateSlotsDummy();
	const event = await getEventTimes();
	const lunchTimes = await getLunchTimes();
	const { dayStart, dayEnd } = await getEventTimes();
	const matchesToday = matches.filter(
		(m) =>
			(m.times.estimatedStartTime ?? m.times.scheduledStartTime) > dayStart.time &&
			(m.times.estimatedStartTime ?? m.times.scheduledStartTime) < dayEnd.time
	);
	let id = 1;
	let slotData: slotData = {
		slotNumber: id,
		startTimestamp: dayStart.time,
		endTimestamp:
			matchesToday[0].times.estimatedStartTime ?? matchesToday[0].times.scheduledStartTime,
		startLabel: 'Start of Day',
		endLabel: formatMatchLabel(matchesToday[0].label, true),
		allowUpdate: true,
		doScouting: true
	};
	await setSlot(slotData);
	id++;
	for (let i = 0; i < matchesToday.length; i++) {
		let match = matchesToday[i];
		let nextMath = matchesToday[i + 1];
		if (i + 1 >= matchesToday.length) {
			const lastMatch = await getLastMatch();
			let slotData: slotData = {
				slotNumber: id,
				startTimestamp: match.times.estimatedStartTime ?? match.times.scheduledStartTime,
				endTimestamp:
					event.dayEnd.time ??
					lastMatch.times.estimatedStartTime ??
					lastMatch.times.scheduledStartTime + 5 * 60 * 1000,
				startLabel: formatMatchLabel(match.label),
				endLabel: 'End of Day',
				allowUpdate: true,
				doScouting: true
			};
			await setSlot(slotData);
			break;
		}
		let slotData: slotData = {
			slotNumber: id,
			startTimestamp: match.times.estimatedStartTime ?? match.times.scheduledStartTime,
			endTimestamp: nextMath.times.estimatedStartTime ?? nextMath.times.scheduledStartTime,
			startLabel: formatMatchLabel(match.label),
			endLabel: formatMatchLabel(nextMath.label, true),
			allowUpdate: true,
			doScouting: true
		};
		if (
			match.times.estimatedStartTime < lunchTimes.lunchStart.time &&
			nextMath.times.estimatedStartTime > lunchTimes.lunchEnd.time
		) {
			slotData = {
				slotNumber: id,
				startTimestamp: match.times.estimatedStartTime,
				endTimestamp: lunchTimes.lunchStart.time,
				startLabel: formatMatchLabel(match.label),
				endLabel: 'Lunch',
				allowUpdate: true,
				doScouting: true
			};
		}
		await setSlot(slotData);
		id++;
	}
}
export async function generateSlotsDummy() {
	await clearSlots();
	const eventTimes = await getEventTimes();
	let startTimestamp = eventTimes.dayStart.time;
	let endTimestamp = startTimestamp + 60 * 60 * 1000;
	for (let id = 1; id <= 11; id++) {
		if (startTimestamp >= eventTimes.dayEnd.time) break;
		else if (endTimestamp > eventTimes.dayEnd.time) endTimestamp = eventTimes.dayEnd.time;
		await setSlot({
			slotNumber: id,
			startTimestamp,
			endTimestamp,
			startLabel: '',
			endLabel: '',
			allowUpdate: false,
			doScouting: true
		});
		startTimestamp = endTimestamp;
		endTimestamp += 60 * 60 * 1000;
	}
}
