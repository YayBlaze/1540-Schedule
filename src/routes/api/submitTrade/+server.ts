import { createTradeRequest, getPerson } from '$lib/db';
import { getSlackUserFromEmail, sendSlackText } from '$lib/slack';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	const personReceive = await getPerson(data.traderReceive);
	const personInit = await getPerson(data.traderInit);
	if (!personReceive || !personInit) throw new Error('invalid user UUID');
	await createTradeRequest(data.tradeInit, data.traderReceive, data.slot);
	const receiveSlackUserID = await getSlackUserFromEmail(personReceive.email);
	await sendSlackText(
		receiveSlackUserID.user.id,
		`New Trade Request from ${personInit?.displayName}! [View it here](https://schedule.team1540.org/user/${personReceive?.uuid}#trade)`
	);
	return json({ status: 200 });
};
