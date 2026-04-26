import { slackBotToken } from '$env/static/private';
import { getCFG, getPerson, getPersonSchedule, getSlots, msToRelative, msToSlot } from './db';

export async function sendSlackText(channelID: string, message: string) {
	const appCFG = await getCFG();
	const sendSlackUpdates = appCFG.find((v) => v.key == 'slackUpdates')?.value == '0' ? false : true;
	if (!sendSlackUpdates) return 'slack turned off';
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
	const appCFG = await getCFG();
	const sendSlackUpdates = appCFG.find((v) => v.key == 'slackUpdates')?.value == '0' ? false : true;
	if (!sendSlackUpdates) return 'slack turned off';
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
	const appCFG = await getCFG();
	const scheduleVisible =
		appCFG.find((v) => v.key === 'scheduleVisible')?.value == '0' ? false : true;
	const sendSlackUpdates = appCFG.find((v) => v.key == 'slackUpdates')?.value == '0' ? false : true;
	if (!scheduleVisible || !sendSlackUpdates) return;
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
