import {
	clearSlots,
	getMilestones,
	getPeople,
	getSlots,
	randomizePreferences,
	setMilestone,
	setPersonSchedule,
	setSlot
} from '$lib/db';
import {
	getLunchTimes,
	getLastMatch,
	ourMatches,
	formatMatchLabel,
	getAllianceSelectionTimes
} from '$lib/nexus';
import { Role, RolePool } from '$lib/types';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const req = createRequire(import.meta.url);
const __d = dirname(fileURLToPath(import.meta.url));
const { makeSchedule } = req(join(__d, 'aldous', 'scheduling.js'));

export async function generateSchedule() {
	await randomizePreferences(); // REMOVE FOR PRODUCTION
	await generateSlotsNexus();
	const people = await getPeople();
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
			Pits: { min: 0, max: 4 },
			'Pit Lead': { min: pl ? Math.min(2, pl) : 0, max: pl ? Math.min(2, pl) : 0 },
			Journalist: { min: 0, max: 1 },
			Strategy: { min: 0, max: 3 },
			Media: { min: 0, max: 1 },
			'Scouting!': { min: 0, max: 7 }
		},

		daySchedule: [
			{
				label: 'Today',
				clock: { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '18:00' },
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
		7: Role.Journalism
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
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	const startOfDay = date.getTime();
	date.setHours(23, 59, 59, 999);
	const endOfDay = date.getTime();
	let milestoneTimes = await getMilestones();
	if (!milestoneTimes.find((v) => v.name == 'Lunch')) {
		let lunchTimes = getLunchTimes();
		let data = {
			name: 'Lunch',
			start: lunchTimes.startTimestamp,
			end: lunchTimes.endTimestamp
		};
		milestoneTimes.push(data);
	}
	if (!milestoneTimes.find((v) => v.name == 'Alliance Selection')) {
		let allianceSelectionTimes = getAllianceSelectionTimes();
		let data = {
			name: 'Alliance Selection',
			start: allianceSelectionTimes.startTimestamp,
			end: allianceSelectionTimes.endTimestamp
		};
		milestoneTimes.push(data);
	}
	let id = 1;
	for (let i = 0; i < matches.length; i++) {
		let match = matches[i];
		let nextMath = matches[i + 1];
		if (!nextMath || nextMath.times.estimatedStartTime > endOfDay) {
			const lastMatch = getLastMatch();
			let slotData = {
				id,
				startTimestamp: match.times.estimatedStartTime,
				endTimestamp: lastMatch.times.estimatedStartTime + 5 * 60 * 1000,
				startLabel: formatMatchLabel(match.label),
				endLabel: 'End of Day'
			};
			await setSlot(slotData);
			break;
		}
		if (match.times.estimatedStartTime < startOfDay || match.times.estimatedQueueTime > endOfDay)
			continue;
		let slotData = {
			id,
			startTimestamp: match.times.estimatedStartTime,
			endTimestamp: nextMath.times.estimatedStartTime,
			startLabel: formatMatchLabel(match.label),
			endLabel: formatMatchLabel(nextMath.label, true)
		};
		for (let milestone of milestoneTimes) {
			if (slotData.startTimestamp < milestone.start && slotData.endTimestamp > milestone.end) {
				console.log(slotData.startLabel, slotData.endLabel);
				console.log(
					`for ${milestone.name}`,
					slotData.startTimestamp,
					milestone.start,
					slotData.startTimestamp - milestone.start,
					slotData.endTimestamp,
					milestone.end,
					slotData.endTimestamp - milestone.end
				);
				slotData = {
					id,
					startTimestamp: match.times.estimatedStartTime,
					endTimestamp: milestone.start,
					startLabel: formatMatchLabel(match.label),
					endLabel: milestone.name
				};
			}
		}
		await setSlot(slotData);
		id++;
	}
}
export async function generateSlotsDummy() {
	await clearSlots();
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
