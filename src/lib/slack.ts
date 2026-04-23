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

export async function sendSlackText(channelID: string, message: string) {
	const response = await fetch('https://slack.com/api/chat.postMessage', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${slackBotToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			channel: channelID,
			markdown_text: message
		})
	});

	return await response.json();
}

export async function sendSlackBlocks(channelID: string, blocks: any[]) {
	const response = await fetch('https://slack.com/api/chat.postMessage', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${slackBotToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			channel: channelID,
			blocks: blocks
		})
	});

	if (!response.ok) console.error(await response.text());
	return await response.json();
}

export async function getSlackUserFromEmail(email: string) {
	const response = await fetch(`https://slack.com/api/users.lookupByEmail?email=${email}`, {
		headers: {
			Authorization: `Bearer ${slackBotToken}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) console.error(await response.text());
	return await response.json();
}

export async function sendRoleUpdate(userUUID: string) {
	const personData = await getPerson(userUUID);
	if (!personData) throw new Error('invalid userUUID');
	const slackUSR = await getSlackUserFromEmail(personData?.email);
	if (!slackUSR.ok) console.error(slackUSR);
	const slots = await getSlots();
	const currentSlot = await msToSlot(Date.now());
	if (!currentSlot) return;
	const personSchedule = await getPersonSchedule(personData.uuid);
	const currentRole = personSchedule[`slot${currentSlot.num}`];
	const msToTime = (ms: number) => {
		return new Date(ms).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' });
	};

	const blocks = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `Hi ${personData.displayName} :wave:`
			}
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `:clock1: Now switching to slot ${currentSlot?.label}`
			}
		},
		{
			type: 'rich_text',
			elements: [
				{
					type: 'rich_text_section',
					elements: [
						{
							type: 'emoji',
							name: 'briefcase'
						},
						{
							type: 'text',
							text: ' Your new role: '
						},
						{
							type: 'text',
							text: `${currentRole}`,
							style: {
								bold: true
							}
						}
					]
				}
			]
		},
		{
			type: 'section',
			text: {
				type: 'plain_text',
				text: `This slot lasts from ${msToTime(slots[currentSlot?.num - 1].startTimestamp)}-${msToTime(slots[currentSlot?.num - 1].endTimestamp)} and is ${msToRelative((slots[currentSlot?.num - 1].endTimestamp ?? slots[0].endTimestamp) - (slots[currentSlot?.num - 1].startTimestamp ?? slots[0].startTimestamp))} long`,
				emoji: true
			}
		},
		{
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: {
						type: 'plain_text',
						text: 'Open Schedule',
						emoji: false
					},
					url: 'https://schedule.team1540.org'
				}
			]
		}
	];

	const res = await sendSlackBlocks(slackUSR.user.id, blocks);
	if (!res.ok) console.error(slackUSR);
}
