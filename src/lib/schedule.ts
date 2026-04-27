import {
	clearSchedule,
	clearSlots,
	getPeople,
	getPeopleAtEvent,
	getPersonSchedule,
	getSlots,
	msToRelative,
	setPersonSchedule,
	setSlot
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
		.filter(
			(p) =>
				p.rolePool != RolePool.Drive &&
				p.rolePool !== RolePool.PitLead &&
				p.rolePool != RolePool.ONLY_Strategy
		)
		.map((p) => {
			return {
				timeInRole: 0,
				...p
			};
		})
		.sort(() => Math.random() - 0.5);
	let slots = (await getSlots()).sort(
		(a, b) => a.endTimestamp - a.startTimestamp - (b.endTimestamp - b.startTimestamp)
	);

	const roleNumbers = {
		scouting: 6,
		pits: 3,
		strategy: 2,
		journalism: 1,
		media: 1
	};

	//add constants
	(await getPeople()).forEach(async (person) => {
		if (person.rolePool === RolePool.Drive)
			await setPersonSchedule(person.uuid, new Array(slots.length).fill(Role.Drive));
		else if (person.rolePool === RolePool.PitLead)
			await setPersonSchedule(person.uuid, new Array(slots.length).fill(Role.PitLead));
		else if (person.rolePool === RolePool.ONLY_Strategy)
			await setPersonSchedule(person.uuid, new Array(slots.length).fill(Role.Strategy));
	});

	//init schedules
	people.forEach(
		async (person) => await setPersonSchedule(person.uuid, new Array(slots.length).fill(Role.Open))
	);

	await generateRole(
		people.filter((p) => p.preferences.doPits),
		slots,
		roleNumbers.pits,
		Role.Pits
	);

	await generateRole(
		people.filter((p) => p.rolePool != RolePool.NO_Scouting),
		slots,
		roleNumbers.scouting,
		Role.Scouting
	);
}

async function generateRole(
	people: any[],
	slotsRaw: slotData[],
	numPeoplePerSlot: number,
	role: Role
) {
	console.log(`doing ${role}`);
	const slots = slotsRaw.map((slot) => {
		return {
			peopleInRole: 0,
			...slot
		};
	});
	const avgBlocks = Math.floor((slots.length * numPeoplePerSlot) / people.length);

	const secSize = Math.ceil(slots.length / avgBlocks);
	const sections = Array.from({ length: avgBlocks }, (_, i) =>
		slots.slice(i * secSize, (i + 1) * secSize)
	);

	people.forEach((p) => (p.timeInRole = 0));
	console.log(avgBlocks, sections.length, secSize);

	let excessBlocks = [];
	for (const section of sections) {
		people.sort(() => Math.random() - 0.5);
		people.sort((a, b) => a.timeInRole - b.timeInRole);
		let i = 0;
		for (const slot of section) {
			const schedules = await Promise.all(people.map((p) => getPersonSchedule(p.uuid)));
			const availablePeople = people.filter(
				(p, i) => schedules[i][`slot${slot.slotNumber}`] === Role.Open
			);
			for (let j = i; j < i + numPeoplePerSlot; j++) {
				if (j >= availablePeople.length) {
					excessBlocks.push(slot);
					break;
				}
				let schedule = Object.values(await getPersonSchedule(availablePeople[j].uuid)).slice(
					1
				) as Role[];
				schedule[slot.slotNumber - 1] = role;
				setPersonSchedule(availablePeople[j].uuid, schedule);
				availablePeople[j].timeInRole += slot.endTimestamp - slot.startTimestamp;
				slot.peopleInRole++;
			}
			i += numPeoplePerSlot;
		}
	}

	let i = 0;
	people.sort((a, b) => a.timeInRole - b.timeInRole);
	for (const slot of excessBlocks) {
		const schedules = await Promise.all(people.map((p) => getPersonSchedule(p.uuid)));
		let availablePeople = people.filter(
			(p, i) => schedules[i][`slot${slot.slotNumber}`] === Role.Open
		);
		for (let j = i; j < i + numPeoplePerSlot - slot.peopleInRole; j++) {
			if (j >= availablePeople.length) {
				availablePeople.sort((a, b) => a.timeInRole - b.timeInRole);
				i = Math.max(0, j - i - slot.peopleInRole);
				j = i;
				continue;
			}
			let schedule = Object.values(await getPersonSchedule(availablePeople[j].uuid)).slice(
				1
			) as Role[];
			schedule[slot.slotNumber - 1] = role;
			setPersonSchedule(availablePeople[j].uuid, schedule);
			availablePeople[j].timeInRole += slot.endTimestamp - slot.startTimestamp;
		}
		i += numPeoplePerSlot;
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
