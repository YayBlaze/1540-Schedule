import { nexusKey } from '$env/static/private';
import { eventKey, team } from '$lib/config';
import type { nexusData, nexusMatch } from './types';

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
}

export function getLunchTimes() {
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

export function getLastMatch() {
	const todaysDate = new Date().toLocaleDateString();
	const todaysMatches = data.matches.filter(
		(m: nexusMatch) => new Date(m.times.estimatedStartTime).toLocaleDateString() == todaysDate
	);
	todaysMatches.sort((a, b) => b.times.estimatedStartTime - a.times.estimatedStartTime);
	return todaysMatches[0];
}

export function formatMatchLabel(label: string, negativeOffset: boolean = false) {
	let number = parseInt(label.split(' ')[1]);
	if (negativeOffset) number -= 1;
	return label.includes('Qualification')
		? `QM${number}`
		: label.includes('Practice')
			? `PM${number}`
			: label;
}
