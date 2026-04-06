import { clearSlots, getPeople, getSlots, setPersonSchedule, setSlot } from '$lib/db';
import {
	getLunchTimes as getLunch,
	lastMatch as getLastMatch,
	ourMatches,
	formatMatchLabel,
	fetchData,
	getEventTimes
} from '$lib/nexus';
import { Role, RolePool } from '$lib/types';
import {
	makeSchedule,
	addPersonToDaySchedule,
	removePersonFromDaySchedule
} from '$lib/aldous/scheduling.js';

const SCOUT_THROUGH_MATCH_SLOTS: number | null = null;

export async function generateSchedule() {
	await generateSlotsNexus();
	const people = await getPeople();
	const slots = await getSlots();
	const ppl = (people || []).filter((p) => p && p.attendingEvent);
	const nSlots = Math.min(11, (slots || []).length);

	const orderedSlots = [...(slots || [])].sort((a, b) => a.slotNumber - b.slotNumber);
	const blockLabels = orderedSlots.slice(0, nSlots).map((s) => `${s.startLabel}-${s.endLabel}`);
	const slotMinutes = orderedSlots
		.slice(0, nSlots)
		.map((s) => Math.max(1, Math.round((s.endTimestamp - s.startTimestamp) / 60000)));

	const drv = ppl.filter((p) => p.rolePool === RolePool.Drive).length;
	const pl = ppl.filter((p) => p.rolePool === RolePool.PitLead).length;

	// tiara scheduling still broken / not hooked up

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
			p.rolePool === RolePool.PitLead ||
			p.rolePool === RolePool.ONLY_Strategy,
		rolePool: p.rolePool,
		onlyStrategy: p.rolePool === RolePool.ONLY_Strategy,
		// tiaraPool: p.rolePool === RolePool.TiaraJudge, // later
		slotsAttending: Array.isArray(p.slotsAttending) ? p.slotsAttending : [],
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
			Pits: { min: 0, max: 4 },
			'Pit Lead': { min: pl ? Math.min(2, pl) : 0, max: pl ? Math.min(2, pl) : 0 },
			Journalist: { min: 0, max: 1 },
			Strategy: { min: 0, max: 3 },
			Media: { min: 0, max: 1 },
			'Scouting!': { min: 5, max: 6 },
			'Tiara Judge': { min: 0, max: 2 }
		},

		daySchedule: [
			{
				label: 'Today',
				clock: { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '18:00' },
				matchesBeforeLunch: nSlots,
				matchesAfterLunch: 0,
				...(blockLabels.length === nSlots && nSlots > 0 ? { blockLabels, slotMinutes } : {}),
				...(SCOUT_THROUGH_MATCH_SLOTS != null && SCOUT_THROUGH_MATCH_SLOTS > 0
					? { noScoutingAfterMatch: SCOUT_THROUGH_MATCH_SLOTS }
					: {})
				// tiara: which block?? idk yet
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
		7: Role.Journalism
		// 8 tiara enum when i fix the js side
	};

	const out = await makeSchedule(cfg);
	const day0 = (out.days || [])[0];
	const m = new Map<string, (Role | null)[]>();
	(day0 && day0.people ? day0.people : []).forEach((p: { email: any; schedule: number[] }) => {
		m.set(
			String(p.email),
			p.schedule.map((v) => enumConversion[v] ?? Role.Open)
		);
	});

	for (let person of ppl) {
		let sch = (m.get(person.uuid) || []).slice(0, nSlots);
		for (let i = sch.length; i < nSlots; i++) sch.push(Role.Open);
		for (let i = sch.length; i < 11; i++) sch.push(null);
		await setPersonSchedule(person.uuid, sch);
	}
}

export async function updateSlotTiming() {
	await fetchData();
	const matches = await ourMatches();
	const slots = await getSlots();
	for (let slot of slots) {
		if (!slot.allowUpdate) continue;
		let startMatch = matches.find((match) => formatMatchLabel(match.label) == slot.startLabel);
		slot.startTimestamp = startMatch?.times.estimatedStartTime ?? slot.startTimestamp;
		let endMatch = matches.find((match) => formatMatchLabel(match.label) == slot.endLabel);
		slot.endTimestamp = endMatch?.times.estimatedStartTime ?? slot.endTimestamp;
	}
	console.log(
		`Updated Nexus slot timing at ${new Date().toLocaleTimeString('en-US', { hour12: false })}`
	);
}

export async function generateSlotsNexus() {
	await fetchData();
	await clearSlots();
	const matches = await ourMatches();
	const lunchTimes = await getLunch();
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
		endLabel: formatMatchLabel(matchesToday[0].label, true),
		allowUpdate: true
	};
	await setSlot(slotData);
	id++;
	for (let i = 0; i < matchesToday.length; i++) {
		let match = matchesToday[i];
		let nextMath = matchesToday[i + 1];
		if (i + 1 >= matchesToday.length) {
			const lastMatch = getLastMatch();
			let slotData = {
				slotNumber: id,
				startTimestamp: match.times.estimatedStartTime,
				endTimestamp: lastMatch.times.estimatedStartTime + 5 * 60 * 1000,
				startLabel: formatMatchLabel(match.label),
				endLabel: 'End of Day',
				allowUpdate: true
			};
			await setSlot(slotData);
			break;
		}
		let slotData = {
			slotNumber: id,
			startTimestamp: match.times.estimatedStartTime,
			endTimestamp: nextMath.times.estimatedStartTime,
			startLabel: formatMatchLabel(match.label),
			endLabel: formatMatchLabel(nextMath.label, true),
			allowUpdate: true
		};
		if (
			match.times.estimatedStartTime < lunchTimes.startTimestamp &&
			nextMath.times.estimatedStartTime > lunchTimes.endTimestamp
		) {
			slotData = {
				slotNumber: id,
				startTimestamp: match.times.estimatedStartTime,
				endTimestamp: lunchTimes.startTimestamp,
				startLabel: formatMatchLabel(match.label),
				endLabel: 'Lunch',
				allowUpdate: true
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
			slotNumber: id,
			startTimestamp,
			endTimestamp: startTimestamp + 10 * 5 * 60 * 1000,
			startLabel: matchNum > 0 ? `QM${matchNum}` : `QM${matchNum + 1}`,
			endLabel: `QM${matchNum + 10}`,
			allowUpdate: true
		});
		matchNum += 10;
		startTimestamp += 10 * 5 * 60 * 1000;
	}
}

export { addPersonToDaySchedule, removePersonFromDaySchedule };
