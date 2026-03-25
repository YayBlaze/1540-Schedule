import { nexusKey } from '$env/static/private';
import { eventKey, team } from '$lib/config';
import type { nexusData } from './types';

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

export function lunch() {
	let matchBefore = null;
	let matchAfter = null;
	for (let match of data.matches) {
		if (matchBefore != null) {
			matchAfter = match;
			break;
		}
		if (match.breakAfter == 'Lunch' || match.breakAfter == 'Alliance Selection')
			matchBefore = match;
	}
	if (!matchBefore || !matchAfter) {
		const date = new Date();
		date.setHours(11, 0, 0, 0);
		const starts = date.getTime();
		date.setHours(12, 0, 0, 0);
		const ends = date.getTime();
		return { starts, ends };
	}
	return {
		starts: matchBefore?.times.estimatedStartTime + 3 * 60 * 1000,
		ends: matchAfter.times.estimatedStartTime
	};
}

export function ourMatches() {
	let matches = data.matches;
	matches = matches.filter((match) => {
		match.blueTeams.includes(team) || match.redTeams.includes(team);
	});
	return matches.sort((a, b) => a.times.estimatedStartTime - b.times.estimatedStartTime);
}
