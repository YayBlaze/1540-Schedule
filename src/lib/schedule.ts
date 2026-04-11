import {
	clearSchedule,
	clearSlots,
	getPeopleAtEvent,
	getSlots,
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
import { Role, RolePool } from '$lib/types';
import { makeSchedule } from '$lib/aldous/scheduling.js';

export {
	addPersonToDaySchedule,
	defaultLightSchedule,
	removePersonFromDaySchedule
} from '$lib/aldous/scheduling.js';

function looksElim(s: { startLabel: string; endLabel: string }) {
	const t = `${s.startLabel} ${s.endLabel}`.toLowerCase();
	if (/prelim/.test(t)) return false;
	return /elimination|elims|playoff.*elim|quarter|\bqf\b|\bsf\b|semi.?final/i.test(t);
}

function looksFinals(s: { startLabel: string; endLabel: string }) {
	const t = `${s.startLabel} ${s.endLabel}`.toLowerCase();
	if (/semi/.test(t)) return false;
	return /championship|award|winner|final four|gold round|^\s*finals?\b/i.test(t);
}

export async function generateSchedule() {
	await clearSchedule();
	await generateSlotsNexus();
	const eventTimesMS = await getEventTimes();
	const eventTimesString = {
		dayStart: new Date(eventTimesMS.dayStart.time).toLocaleTimeString('en-US', { hour12: false }),
		dayEnd: new Date(eventTimesMS.dayEnd.time).toLocaleTimeString('en-US', { hour12: false })
	};
	const lunchTimesMS = await getLunchTimes();
	const lunchTimesString = {
		lunchStart: new Date(lunchTimesMS.lunchStart.time).toLocaleTimeString('en-US', {
			hour12: false
		}),
		lunchEnd: new Date(lunchTimesMS.lunchEnd.time).toLocaleTimeString('en-US', { hour12: false })
	};
	const people = await getPeopleAtEvent();
	const slots = [...((await getSlots()) || [])].sort((a, b) => a.slotNumber - b.slotNumber);
	const ppl = (people || []).filter((p) => p && p.attendingEvent);
	const nSlots = Math.min(11, slots.length);
	const row = slots.slice(0, nSlots);

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
		onlyStrategy: p.rolePool === RolePool.ONLY_Strategy,
		tiaraPool: p.rolePool === RolePool.TiaraJudge,
		slotsAttending: p.slotsAttending ?? [],
		cannotScout:
			p.rolePool === RolePool.NO_Scouting ||
			p.rolePool === RolePool.Drive ||
			p.rolePool === RolePool.PitLead ||
			p.rolePool === RolePool.ONLY_Strategy,
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
			'Scouting!': { min: 5, max: 7 },
			'Tiara Judge': { min: 0, max: 3 }
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
				...(row.length > 0
					? {
							elimBlock: row.map(looksElim),
							finalsBlock: row.map(looksFinals),
							tiaraMaxBlocks: 2,
							blockLabels: row.map((s) => `${s.startLabel}-${s.endLabel}`),
							blockWindows: row.map((s) => {
								const a = new Date(s.startTimestamp).toLocaleTimeString('en-US', {
									hour12: false
								});
								const b = new Date(s.endTimestamp).toLocaleTimeString('en-US', {
									hour12: false
								});
								const p0 = a.split(':').map(Number);
								const p1 = b.split(':').map(Number);
								return `${String(p0[0] ?? 0).padStart(2, '0')}:${String(p0[1] ?? 0).padStart(2, '0')}-${String(p1[0] ?? 0).padStart(2, '0')}:${String(p1[1] ?? 0).padStart(2, '0')}`;
							}),
							slotMinutes: row.map((s) =>
								Math.max(1, Math.round((s.endTimestamp - s.startTimestamp) / 60000))
							),
							slotNumbers: row.map((s) => s.slotNumber)
						}
					: {
							matchesBeforeLunch: Math.max(1, nSlots || 6),
							matchesAfterLunch: 0
						})
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
	console.log(
		`Starting to update slot timing at ${new Date().toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })}`
	);
	for (let slot of slots) {
		if (!slot.allowUpdate) continue;
		let startMatchTime = matches.find((match) => formatMatchLabel(match.label) == slot.startLabel)
			?.times.estimatedStartTime;
		if (startMatchTime && startMatchTime != slot.startTimestamp) {
			console.log(
				`Updated slot ${slot.startLabel}-${slot.endLabel} to start at ${new Date(startMatchTime).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })}`
			);
			slot.startTimestamp = startMatchTime;
		}
		let endMatchTime = matches.find((match) => formatMatchLabel(match.label) == slot.endLabel)
			?.times.estimatedStartTime;
		if (endMatchTime && endMatchTime != slot.endTimestamp) {
			console.log(
				`Updated slot ${slot.startLabel}-${slot.endLabel} to start at ${new Date(endMatchTime).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })}`
			);
			slot.endTimestamp = endMatchTime;
		}
	}
	await setSlots(slots);
}

export async function generateSlotsNexus() {
	await fetchData();
	await clearSlots();
	const matches = await ourMatches();
	const event = await getEventTimes();
	if (!matches || matches.length < 1) return await generateSlotsDummy();
	const lunchTimes = await getLunchTimes();
	const { dayStart, dayEnd } = await getEventTimes();
	const matchesToday = matches.filter(
		(m) =>
			(m.times.estimatedStartTime ?? m.times.scheduledStartTime) > dayStart.time &&
			(m.times.estimatedStartTime ?? m.times.scheduledStartTime) < dayEnd.time
	);
	let id = 1;
	let slotData = {
		slotNumber: id,
		startTimestamp: dayStart.time,
		endTimestamp:
			matchesToday[0].times.estimatedStartTime ?? matchesToday[0].times.scheduledStartTime,
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
			const lastMatch = await getLastMatch();
			let slotData = {
				slotNumber: id,
				startTimestamp: match.times.estimatedStartTime ?? match.times.scheduledStartTime,
				endTimestamp:
					event.dayEnd.time ??
					lastMatch.times.estimatedStartTime ??
					lastMatch.times.scheduledStartTime + 5 * 60 * 1000,
				startLabel: formatMatchLabel(match.label),
				endLabel: 'End of Day',
				allowUpdate: true
			};
			await setSlot(slotData);
			break;
		}
		let slotData = {
			slotNumber: id,
			startTimestamp: match.times.estimatedStartTime ?? match.times.scheduledStartTime,
			endTimestamp: nextMath.times.estimatedStartTime ?? nextMath.times.scheduledStartTime,
			startLabel: formatMatchLabel(match.label),
			endLabel: formatMatchLabel(nextMath.label, true),
			allowUpdate: true
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
				allowUpdate: true
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
		if (startTimestamp > eventTimes.dayEnd.time) break;
		else if (endTimestamp > eventTimes.dayEnd.time) endTimestamp = eventTimes.dayEnd.time;
		await setSlot({
			slotNumber: id,
			startTimestamp,
			endTimestamp,
			startLabel: '',
			endLabel: '',
			allowUpdate: false
		});
		startTimestamp = endTimestamp;
		endTimestamp += 60 * 60 * 1000;
	}
}
