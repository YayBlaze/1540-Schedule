import { nexusKey } from '$env/static/private';
import { eventKey, team } from '$lib/config';
import { getCFG } from '$lib/db';
import type { nexusData, nexusMatch } from '$lib/types';

var data: nexusData;

export async function fetchData() {
	if (data?.dataAsOfTime > Date.now() - 5 * 60 * 1000) return;
	const response = await fetch(`https://frc.nexus/api/v1/event/${eventKey}`, {
		method: 'GET',
		headers: {
			'Nexus-Api-Key': nexusKey
		}
	});

	if (!response.ok) {
		const errorMessage = await response.text();
		console.log('Error getting live event status:', errorMessage);
		return false;
	}
	data = await response.json();
	console.log(
		`Pulled new Nexus data at ${new Date(data.dataAsOfTime).toLocaleTimeString('en-US', { hour12: false })}`
	);
}

export async function getEventTimes() {
	const milestoneTimes = await getCFG();
	const dbEventStart = milestoneTimes.find((v) => v.key == 'dayStart');
	const dbEventEnd = milestoneTimes.find((v) => v.key == 'dayEnd');
	const dateString = milestoneTimes.find((v) => v.key == 'date')?.value;
	const date = new Date();
	const dateStringSplit = dateString?.split('/') ?? null;
	if (dateStringSplit && dateStringSplit.length == 3) {
		date.setFullYear(
			parseInt(dateStringSplit[2]),
			parseInt(dateStringSplit[0]) - 1,
			parseInt(dateStringSplit[1])
		);
	}
	let dayStart: { time: number; fromDB: boolean };
	let dayEnd: { time: number; fromDB: boolean };

	if (dbEventStart) dayStart = { time: parseInt(dbEventStart.value), fromDB: true };
	else {
		date.setHours(8, 0, 0, 0);
		dayStart = {
			time:
				(await firstMatch())?.times.estimatedStartTime ??
				(await firstMatch())?.times.scheduledStartTime ??
				date.getTime(),
			fromDB: false
		};
	}

	if (dbEventEnd) dayEnd = { time: parseInt(dbEventEnd.value), fromDB: true };
	else {
		date.setHours(18, 0, 0, 0);
		dayEnd = {
			time:
				(await lastMatch())?.times.estimatedStartTime ??
				(await lastMatch())?.times.scheduledStartTime ??
				date.getTime(),
			fromDB: false
		};
	}

	return { dayStart, dayEnd };
}

export async function getLunchTimes() {
	const dbMilestones = await getCFG();
	const dbLunchStart = dbMilestones.find((v) => v.key == 'lunchStart');
	const dbLunchEnd = dbMilestones.find((v) => v.key == 'lunchEnd');
	const dateString = dbMilestones.find((v) => v.key == 'date')?.value;
	const date = new Date();
	const dateStringSplit = dateString?.split('/') ?? null;
	if (dateStringSplit) {
		date.setFullYear(
			parseInt(dateStringSplit[2]),
			parseInt(dateStringSplit[0]) - 1,
			parseInt(dateStringSplit[1])
		);
	}
	let lunchStart: { time: number; fromDB: boolean };
	let lunchEnd: { time: number; fromDB: boolean };

	let matchBefore = null;
	let matchAfter = null;
	if (data?.matches) {
		for (let match of data.matches) {
			if (matchBefore != null) {
				matchAfter = match;
				break;
			}
			if (match.breakAfter == 'Lunch') matchBefore = match;
		}
	}

	if (dbLunchStart) lunchStart = { time: parseInt(dbLunchStart.value), fromDB: true };
	else {
		date.setHours(12, 25, 0, 0);
		lunchStart = {
			time:
				matchBefore?.times.estimatedStartTime ??
				matchBefore?.times.estimatedQueueTime ??
				date.getTime() + 5 * 60 * 1000,
			fromDB: false
		};
	}

	if (dbLunchEnd) lunchEnd = { time: parseInt(dbLunchEnd.value), fromDB: true };
	else {
		date.setHours(13, 25, 0, 0);
		lunchEnd = {
			time:
				matchAfter?.times.estimatedStartTime ??
				matchAfter?.times.estimatedQueueTime ??
				date.getTime() + 5 * 60 * 1000,
			fromDB: false
		};
	}

	return { lunchStart, lunchEnd };
}

export function getAllianceSelectionTimes() {
	let matchBefore = null;
	let matchAfter = null;
	for (let match of data.matches) {
		if (matchBefore != null) {
			matchAfter = match;
			break;
		}
		if (match.breakAfter == 'Alliance Selection') matchBefore = match;
	}
	if (!matchBefore || !matchAfter) {
		const date = new Date();
		date.setHours(11, 0, 0, 0);
		const startTimestamp = date.getTime();
		date.setHours(12, 0, 0, 0);
		const endTimestamp = date.getTime();
		return { startTimestamp, endTimestamp };
	}
	return {
		startTimestamp: matchBefore.times.estimatedStartTime + 3 * 60 * 1000,
		endTimestamp: matchAfter.times.estimatedStartTime
	};
}

export async function ourMatches() {
	await fetchData();
	return data?.matches.filter(
		(m: nexusMatch) =>
			m.redTeams?.includes(team) ||
			m.blueTeams?.includes(team) ||
			m.label?.includes('Playoff') ||
			m.label?.includes('Final')
	);
}

export async function lastMatch() {
	const milestoneTimes = await getCFG();
	const dateString = milestoneTimes.find((v) => v.key == 'date')?.value;
	const date = new Date();
	const dateStringSplit = dateString?.split('/') ?? null;
	if (dateStringSplit) {
		date.setFullYear(
			parseInt(dateStringSplit[2]),
			parseInt(dateStringSplit[0]) - 1,
			parseInt(dateStringSplit[1])
		);
	}
	date.setHours(0, 0, 0, 0);
	const startOfDay = date.getTime();
	date.setHours(23, 59, 59, 999);
	const endOfDay = date.getTime();
	let matches = data?.matches;
	matches =
		matches?.filter(
			(v) => v.times.estimatedStartTime < endOfDay && v.times.estimatedStartTime > startOfDay
		) ?? [];
	return matches[matches.length - 1];
}

export async function firstMatch() {
	const milestoneTimes = await getCFG();
	const dateString = milestoneTimes.find((v) => v.key == 'date')?.value;
	const date = new Date();
	const dateStringSplit = dateString?.split('/') ?? null;
	if (dateStringSplit) {
		date.setFullYear(
			parseInt(dateStringSplit[2]),
			parseInt(dateStringSplit[0]) - 1,
			parseInt(dateStringSplit[1])
		);
	}
	date.setHours(0, 0, 0, 0);
	const startOfDay = date.getTime();
	date.setHours(23, 59, 59, 999);
	const endOfDay = date.getTime();
	let matches = data?.matches;
	matches =
		matches?.filter(
			(v) =>
				(v.times.estimatedStartTime ?? v.times.scheduledStartTime) < endOfDay &&
				(v.times.estimatedStartTime ?? v.times.scheduledStartTime) > startOfDay
		) ?? [];
	return matches[0];
}

export function formatMatchLabel(label: string, negativeOffset: boolean = false) {
	let number = parseInt(label.split(' ')[1]);
	if (negativeOffset) number -= number > 1 ? 1 : 0;

	const prefixes: [string, string][] = [
		['Qualification', 'QM'],
		['Practice', 'PM'],
		['Playoff', 'SFM'],
		['Final', 'FM']
	];

	const match = prefixes.find(([key]) => label.includes(key));
	return match ? `${match[1]}${number}` : label;
}
