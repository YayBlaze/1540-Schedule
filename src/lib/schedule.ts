import {
	clearSchedule,
	clearSlots,
	getPeopleAtEvent,
	getPersonSchedule,
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

export async function generateSchedule(attempts?: number) {
	attempts ? (attempts = attempts) : (attempts = 0);
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
				pitTime: 0,
				...p
			};
		})
		.sort(() => Math.random() - 0.5);
	let slots = await getSlots();

	const roleNumbers = {
		scouting: 6,
		pits: 3,
		strategy: 2,
		journalism: 1,
		media: 1
	};

	const totalTime = slots.reduce((sum, slot) => sum + slot.endTimestamp - slot.startTimestamp, 0);
	const goalAveragePitTime =
		(totalTime * roleNumbers.pits) / people.filter((p) => p.preferences.doPits).length;
	const goalAverageScoutingTime = (totalTime * roleNumbers.scouting) / people.length;
	const toleranceMinMax = 60 * 60 * 1000; // the amount of ms a person's pits/scouting time can be away from the goal
	const toleranceAvg = 20 * 60 * 1000; // the amount of ms the average pits/scouting time can be away from the goal

	let realPitTimes: number[] = [];
	let realScoutingTimes: number[] = [];

	// init schedules
	people.forEach((person) => setPersonSchedule(person.uuid, new Array(slots.length).fill(null)));
	(await getPeopleAtEvent()).forEach((person) => {
		if (person.rolePool === RolePool.Drive) {
			setPersonSchedule(person.uuid, new Array(slots.length).fill(Role.Drive));
		} else if (person.rolePool === RolePool.PitLead) {
			setPersonSchedule(person.uuid, new Array(slots.length).fill(Role.PitLead));
		} else if (person.rolePool === RolePool.ONLY_Strategy) {
			setPersonSchedule(person.uuid, new Array(slots.length).fill(Role.Strategy));
		}
	});

	for (const slot of slots) {
		const i = slot.slotNumber - 1;
		people.sort(() => Math.random() - 0.5);

		//assign pits
		for (let j = 0; j < 3; j++) {
			const person = people[Math.floor(Math.random() * people.length)];
			let schedule = Object.values(await getPersonSchedule(person.uuid)).slice(1) as Role[];
			if (!person.preferences.doPits) {
				j--;
				continue;
			}
			schedule[i] = Role.Pits;
			setPersonSchedule(person.uuid, schedule);
			person.pitTime += slot.endTimestamp - slot.startTimestamp;
		}

		//finish by filling open
		for (const person of people) {
			let schedule = Object.values(await getPersonSchedule(person.uuid)).slice(1) as Role[];
			if (schedule[i] == null) schedule[i] = Role.Open;
			setPersonSchedule(person.uuid, schedule);
		}
	}

	people.forEach((person) => {
		if (person.preferences.doPits) realPitTimes.push(person.pitTime);
	});

	console.log(
		'average pit time',
		msToRelative(realPitTimes.reduce((a, b) => a + b, 0) / realPitTimes.length),
		'max pit time',
		msToRelative(Math.max(...realPitTimes)),
		'min pit time',
		msToRelative(Math.min(...realPitTimes))
	);
	if (
		Math.abs(Math.max(...realPitTimes) - goalAveragePitTime) > toleranceMinMax ||
		Math.abs(Math.min(...realPitTimes) - goalAveragePitTime) > toleranceMinMax ||
		Math.abs(realPitTimes.reduce((a, b) => a + b, 0) / realPitTimes.length - goalAveragePitTime) >
			toleranceAvg
	) {
		if (attempts >= 50) {
			console.log(`attempt ${attempts} failed, giving up`);
			return;
		}
		console.log(`attempt ${attempts} failed, retrying...`);
		await generateSchedule(attempts + 1);
	} else {
		console.log(`attempt ${attempts} succeeded!`);
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
