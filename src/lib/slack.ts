import { slackBotToken } from '$env/static/private';
import { getPerson, getPersonSchedule, getSlots, msToSlot } from './db';

function msToRelative(ms: number): string {
	let seconds = ms / 1000;
	let days = Math.floor(seconds / (24 * 3600));
	seconds = seconds % (24 * 3600);
	let hour = Math.floor(seconds / 3600);
	seconds %= 3600;
	let minutes = Math.floor(seconds / 60);
	seconds %= 60;

	let string = Math.round(seconds) + 's';
	if (minutes != 0) string = Math.round(minutes) + 'mins';
	if (hour != 0) string = Math.round(hour) + 'hrs, ' + string;
	if (days != 0) string = '>24hrs';

	return string;
}

export async function sendSlackMessage(userID: string, message: string) {
	const response = await fetch('https://slack.com/api/chat.postMessage', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${slackBotToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			channel: userID,
			markdown_text: message
		})
	});

	return await response.json();
}

export async function getSlackUserFromEmail(email: string) {
	const response = await fetch(`https://slack.com/api/users.lookupByEmail?email=${email}`, {
		headers: {
			Authorization: `Bearer ${slackBotToken}`,
			'Content-Type': 'application/json'
		}
	});

	return await response.json();
}

export async function sendRoleUpdate(userUUID: string) {
	const personData = await getPerson(userUUID);
	if (!personData) throw new Error('invalid userUUID');
	const slackUSR = await getSlackUserFromEmail(personData?.email);
	const slots = await getSlots();
	const currentSlot = await msToSlot(Date.now());
	if (!currentSlot) return;
	const personSchedule = await getPersonSchedule(personData.uuid);
	const currentRole = personSchedule[`slot${currentSlot.num}`];
	const nextRole = personSchedule[`slot${currentSlot.num + 1}`];

	const msg = `Now switching to ${currentSlot?.label}: New Role ${currentRole}\n
    (${msToRelative(
			(slots[currentSlot?.num - 1].endTimestamp ?? slots[0].endTimestamp) -
				(slots[currentSlot?.num - 1].startTimestamp ?? slots[0].startTimestamp)
		)}) next role: `;
	await sendSlackMessage(slackUSR.user.id, msg);
}
