import {
	clearSchedule,
	clearSlots,
	getPeopleAtEvent,
	getSlots,
	setPersonSchedule,
	setSlot
} from '$lib/db';
import { getLunchTimes, ourMatches, formatMatchLabel, lastMatch, getEventTimes } from '$lib/nexus';
import { Role, RolePool } from '$lib/types';
import { makeSchedule } from '$lib/aldous/scheduling.js';

export async function generateSchedule() {
	await clearSchedule();
	await generateSlotsNexus();
	const eventTimesMS = await getEventTimes();
	const eventTimesString = {
		dayStart: new Date(eventTimesMS.dayStart).toLocaleTimeString('en-US', { hour12: false }),
		dayEnd: new Date(eventTimesMS.dayEnd).toLocaleTimeString('en-US', { hour12: false })
	};
	const lunchTimesMS = await getLunchTimes();
	const lunchTimesString = {
		lunchStart: new Date(lunchTimesMS.startTimestamp).toLocaleTimeString('en-US', {
			hour12: false
		}),
		lunchEnd: new Date(lunchTimesMS.endTimestamp).toLocaleTimeString('en-US', { hour12: false })
	};
	const people = await getPeopleAtEvent();
	const slots = await getSlots();
	const ppl = (people || []).filter((p) => p && p.attendingEvent);
	const nSlots = Math.min(11, (slots || []).length);

	const drv = ppl.filter((p) => p.rolePool === RolePool.Drive).length;
	const pl = ppl.filter((p) => p.rolePool === RolePool.PitLead).length;

	const subs = ppl.map((p) => ({
		name: p.displayName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.uuid,
		email: p.uuid,
		wantsPits: (p.preferences && p.preferences.doPits ? p.preferences.doPits : 0) > 0,
		wantsMechPit: false,
		wantsCtrlsPit: false,
		wantsSwPit: false,
		wantsJournalism: !!(p.preferences && p.preferences.doJournalism),
		wantsStrategy: !!(p.preferences && p.preferences.doStrategy),
		wantsMedia: !!(p.preferences && p.preferences.doMedia),
		driveTeam: p.rolePool === RolePool.Drive,
		cannotScout:
			p.rolePool === RolePool.NO_Scouting ||
			p.rolePool === RolePool.Drive ||
			p.rolePool === RolePool.PitLead,
		unavailableTimes: '',
		conventionTalks: '',
		friday: true,
		saturday: false
	}));

	const cfg = {
		subs,
		exportRoleEnums: true,
		useNexusMatchLabels: false,
		nexusEventKey: null,
		nexusApiKey: null,
		showOnlyDay: 0,
		optimizationIterations: 2000,

		pitLeadIds: subs
			.filter((s) => ppl.find((p) => p.uuid === s.email)?.rolePool === RolePool.PitLead)
			.map((s) => s.email),
		noScouting: subs
			.filter((s) => ppl.find((p) => p.uuid === s.email)?.rolePool === RolePool.NO_Scouting)
			.map((s) => s.email),
		noStrategy: [],
		driveTeamExtra: [],
		skipPeople: [],

		roleStaffing: {
			Drive: { min: drv, max: drv },
			Pits: { min: 2, max: 3 },
			'Pit Lead': { min: pl ? Math.min(2, pl) : 0, max: pl ? Math.min(2, pl) : 0 },
			Journalist: { min: 0, max: 1 },
			Strategy: { min: 0, max: 3 },
			Media: { min: 0, max: 1 },
			'Scouting!': { min: 5, max: 7 }
		},

		daySchedule: [
			{
				label: 'Today',
				clock: {
					start: eventTimesString.dayStart,
					lunchStart: lunchTimesString.lunchStart,
					lunchEnd: lunchTimesString.lunchEnd,
					end: eventTimesString.dayEnd
				},
				matchesBeforeLunch: nSlots,
				matchesAfterLunch: 0
			}
		],

		columnMap: { email: 'x', wantsPits: 'x', whichDays: 'x' }
	};

	const enumConversion: Record<number, Role> = {
		0: Role.Open,
		1: Role.PitLead,
		2: Role.Pits,
		3: Role.Drive,
		4: Role.Scouting,
		5: Role.Strategy,
		6: Role.Media,
		7: Role.Journalism,
		8: Role.TiaraJudge
	};

	const out = await makeSchedule(cfg);
	const day0 = (out.days || [])[0];
	const m = new Map<string, (Role | null)[]>();
	(day0 && day0.people ? day0.people : []).forEach((p: { email: any; schedule: number[] }) => {
		m.set(
			String(p.email),
			p.schedule.map((v) => enumConversion[v])
		);
	});

	for (let person of ppl) {
		let sch = (m.get(person.uuid) || []).slice(0, nSlots);
		for (let i = sch.length; i < nSlots; i++) sch.push(Role.Open);
		for (let i = sch.length; i < 11; i++) sch.push(null);
		await setPersonSchedule(person.uuid, sch);
	}
}

export async function generateSlotsNexus() {
	await clearSlots();
	const matches = await ourMatches();
	const lunchTimes = await getLunchTimes();
	const { dayStart, dayEnd } = await getEventTimes();
	const matchesToday = matches.filter(
		(m) => m.times.estimatedStartTime > dayStart && m.times.estimatedQueueTime < dayEnd
	);
	let id = 1;
	let slotData = {
		slotNumber: id,
		startTimestamp: dayStart,
		endTimestamp: matchesToday[0].times.estimatedStartTime,
		startLabel: 'Start of Day',
		endLabel: formatMatchLabel(matchesToday[0].label, true)
	};
	await setSlot(slotData);
	id++;
	for (let i = 0; i < matchesToday.length; i++) {
		let match = matchesToday[i];
		let nextMath = matchesToday[i + 1];
		if (!nextMath || nextMath.times.estimatedStartTime > dayEnd) {
			let slotData = {
				slotNumber: id,
				startTimestamp: match.times.estimatedStartTime,
				endTimestamp: dayEnd,
				startLabel: formatMatchLabel(match.label),
				endLabel: 'End of Day'
			};
			await setSlot(slotData);
			break;
		}
		if (match.times.estimatedStartTime < dayStart || match.times.estimatedQueueTime > dayEnd)
			continue;
		let slotData = {
			slotNumber: id,
			startTimestamp: match.times.estimatedStartTime ?? match.times.scheduledStartTime,
			endTimestamp: nextMath.times.estimatedStartTime,
			startLabel: formatMatchLabel(match.label),
			endLabel: formatMatchLabel(nextMath.label, true)
		};
		if (
			slotData.startTimestamp <= lunchTimes.startTimestamp &&
			slotData.endTimestamp >= lunchTimes.endTimestamp
		) {
			slotData = {
				slotNumber: id,
				startTimestamp: match.times.estimatedStartTime,
				endTimestamp: lunchTimes.startTimestamp,
				startLabel: formatMatchLabel(match.label),
				endLabel: 'Lunch'
			};
			await setSlot(slotData);
			id++;
			i++;
			nextMath = matchesToday[i + 1];
			slotData = {
				slotNumber: id,
				startTimestamp: lunchTimes.endTimestamp,
				endTimestamp: nextMath.times.estimatedStartTime,
				startLabel: 'Lunch',
				endLabel: formatMatchLabel(nextMath.label)
			};
		}
		await setSlot(slotData);
		id++;
	}
}
export async function generateSlotsDummy() {
	await clearSlots();
	let matchNum = 0;
	const { dayStart, dayEnd } = await getEventTimes();
	let startTimestamp = dayStart;
	for (let id = 1; id <= 11; id++) {
		if (startTimestamp > dayEnd) break;
		await setSlot({
			slotNumber: id,
			startTimestamp,
			endTimestamp: startTimestamp + 10 * 5 * 60 * 1000,
			startLabel: matchNum > 0 ? `QM${matchNum}` : `QM${matchNum + 1}`,
			endLabel: `QM${matchNum + 10}`
		});
		matchNum += 10;
		startTimestamp += 10 * 5 * 60 * 1000;
	}
}
