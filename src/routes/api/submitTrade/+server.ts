import { createTradeRequest } from '$lib/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	await createTradeRequest(data.tradeInit, data.traderReceive, data.slot);
	return json({ status: 200 });
};
