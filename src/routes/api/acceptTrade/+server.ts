import { getPersonSchedule, getTradeRequest, removeTradeRequest, setPersonSchedule } from '$lib/db';
import type { personSchedule, Role } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	const requestData = await getTradeRequest(data.uuid);
	let personInitSchedule = await getPersonSchedule(requestData.personInit);
	let personReceiveSchedule = await getPersonSchedule(requestData.personReceive);
	const slotID = requestData.slotID;

	let personInitTradingRole = personInitSchedule[`slot${slotID}`];
	personInitSchedule[`slot${slotID}`] = personReceiveSchedule[`slot${slotID}`];
	personReceiveSchedule[`slot${slotID}`] = personInitTradingRole;

	await setPersonSchedule(
		requestData.personInit,
		Object.keys(personInitSchedule)
			.filter((key) => key.startsWith('slot'))
			.map((key) => personInitSchedule[key as keyof typeof personInitSchedule] as Role)
	);
	await setPersonSchedule(
		requestData.personReceive,
		Object.keys(personReceiveSchedule)
			.filter((key) => key.startsWith('slot'))
			.map((key) => personReceiveSchedule[key as keyof typeof personReceiveSchedule] as Role)
	);

	await removeTradeRequest(data.uuid);
	return json({ status: 200 });
};
