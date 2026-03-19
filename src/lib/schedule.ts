import { getPeople } from './db';

export async function generateSchedule() {
	let people = await getPeople();
}

export function msToSlot(ms: number): string {
	const date = new Date(ms);
	const hours = date.getHours();
	const minutes = date.getMinutes() < 30 ? 0 : 30;

	const start = `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
	const endMinutes = minutes + 30;
	const end =
		endMinutes === 60
			? `${String(hours + 1).padStart(2, '0')}00`
			: `${String(hours).padStart(2, '0')}${String(endMinutes).padStart(2, '0')}`;

	return `${start}-${end}`;
}
