import { getPerson, getTradeRequest, removeTradeRequest } from '$lib/db';
import { getSlackUserFromEmail, sendSlackText } from '$lib/slack';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	if (!data) return json({ status: 400, msg: 'invalid data' });
	const tradeDetails = await getTradeRequest(data.uuid);
	const personReceive = await getPerson(tradeDetails.personReceive);
	const personInit = await getPerson(tradeDetails.personInit);
	if (!personInit || !personReceive) return json({ status: 400, msg: 'invalid person uuids' });
	await removeTradeRequest(data.uuid);
	const personInitSlackUser = await getSlackUserFromEmail(personInit?.email);
	await sendSlackText(
		personInitSlackUser.user.id,
		`${personReceive.displayName} denied your trade request`
	);
	return json({ status: 200 });
};
