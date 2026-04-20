import { removeTradeRequest } from '$lib/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	await removeTradeRequest(data.uuid);
	return json({ status: 200 });
};
