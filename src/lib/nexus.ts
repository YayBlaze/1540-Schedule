import { nexusKey } from '$env/static/private';
import { eventKey, team } from '$lib/config';
import { getMilestones } from '$lib/db';
import type { nexusData, nexusMatch } from '$lib/types';

var data: nexusData;

export async function fetchData() {
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
	const milestoneTimes = await getMilestones();
	const dbEventTimes = milestoneTimes.find((v) => v.name == 'event');
	let dayStart;
	let dayEnd;
	if (dbEventTimes) {
		dayStart = dbEventTimes.startTimestamp;
		dayEnd = dbEventTimes.endTimestamp;
	} else {
		dayStart = firstMatch().times.estimatedStartTime;
		dayEnd = lastMatch().times.estimatedStartTime + 5 * 60 * 1000;
	}
	return { dayStart, dayEnd };
}

export async function getLunchTimes() {
	const dbMilestones = await getMilestones();
	const dbLunch = dbMilestones.find((v) => v.name == 'lunch');
	if (dbLunch)
		return { startTimestamp: dbLunch.startTimestamp, endTimestamp: dbLunch.endTimestamp };
	let matchBefore = null;
	let matchAfter = null;
	for (let match of data.matches) {
		if (matchBefore != null) {
			matchAfter = match;
			break;
		}
		if (match.breakAfter == 'Lunch') matchBefore = match;
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
	return data.matches.filter(
		(m: nexusMatch) => m.redTeams?.includes(team) || m.blueTeams?.includes(team)
	);
}

export function lastMatch() {
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	const startOfDay = date.getTime();
	date.setHours(23, 59, 59, 999);
	const endOfDay = date.getTime();
	let matches = data.matches;
	matches = matches.filter(
		(v) => v.times.estimatedStartTime < endOfDay && v.times.estimatedStartTime > startOfDay
	);
	return matches[matches.length - 1];
}

export function firstMatch() {
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	const startOfDay = date.getTime();
	date.setHours(23, 59, 59, 999);
	const endOfDay = date.getTime();
	let matches = data.matches;
	matches = matches.filter(
		(v) => v.times.estimatedStartTime < endOfDay && v.times.estimatedStartTime > startOfDay
	);
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
