import { Role, RolePool, type PersonData, type personSchedule, type Preferences } from './types';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

let db: any = null;

export async function initDB() {
	const { Database } = await import('bun:sqlite');
	db = new Database('app.db');

	db.run('PRAGMA journal_mode = WAL;');

	db.run(`
		CREATE TABLE IF NOT EXISTS people (
			uuid TEXT PRIMARY KEY,
			firstName TEXT,
			lastName TEXT,
			displayName TEXT,
			email TEXT,
			attendingEvent BOOLEAN,
			attendingLoadIn BOOLEAN,
			rolePool TEXT,
			preferences JSON
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS schedule (
			personUUID TEXT PRIMARY KEY,
			slot1 TEXT,
			slot2 TEXT,
			slot3 TEXT,
			slot4 TEXT,
			slot5 TEXT,
			slot6 TEXT,
			slot7 TEXT,
			slot8 TEXT,
			slot9 TEXT,
			slot10 TEXT,
			slot11 TEXT
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS slots (
			slotNumber INTEGER PRIMARY KEY,
			startTimestamp LONG,
			endTimestamp LONG,
			startLabel TEXT,
			endLabel TEXT,
			allowUpdate BOOLEAN
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS timingCfg (
			key TEXT PRIMARY KEY,
			value TEXT
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS sessions (
			session_id CHAR(36),
			session_expire LONG
		)
	`);
}

export async function getPeople(): Promise<PersonData[]> {
	const res = db.prepare('SELECT * FROM people ORDER BY firstName').all() as PersonData[];
	return res.map((data) => {
		return {
			...data,
			rolePool: data.rolePool as RolePool,
			preferences: JSON.parse(data.preferences as unknown as string)
		};
	});
}

export async function getPeopleAtEvent(): Promise<PersonData[]> {
	const res = db
		.prepare('SELECT * FROM people WHERE attendingEvent = true ORDER BY firstName')
		.all() as PersonData[];
	return res.map((data) => {
		return {
			...data,
			rolePool: data.rolePool as RolePool,
			preferences: JSON.parse(data.preferences as unknown as string)
		};
	});
}

export async function addPerson(data: { firstName: string; lastName: string; email: string }) {
	const personUUID = Bun.randomUUIDv7();
	await db
		.prepare('INSERT OR REPLACE INTO people VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
		.run(
			personUUID,
			data.firstName,
			data.lastName,
			data.firstName,
			data.email,
			false,
			false,
			RolePool.None,
			JSON.stringify({})
		);
	await formatName(data.firstName, data.lastName);
	return personUUID;
}

export async function removePerson(personUUID: string) {
	const data = await getPerson(personUUID);
	if (!data) return;
	await db.prepare('DELETE FROM people WHERE uuid = ?').run(personUUID);
	await db.prepare('DELETE FROM schedule WHERE personUUID = ?').run(personUUID);
	await formatName(data.firstName, data.lastName);
}

export async function importPeople() {
	await db.prepare('DELETE FROM people').run();
	const csvContent = fs.readFileSync('static/people.csv', 'utf-8');
	const records: Record<string, string>[] = parse(csvContent, {
		columns: true,
		skip_empty_lines: true
	});

	for (let entry of records) {
		let fullName = entry.full_name;
		let data = {
			firstName: fullName.split(' ')[0],
			lastName: fullName.split(' ')[1],
			email: entry.email
		};
		await addPerson(data);
	}
}

export async function getPerson(personUUID: string): Promise<PersonData | null> {
	const res = db.prepare('SELECT * FROM people WHERE uuid = ?').get(personUUID) as PersonData;
	if (!res) return null;
	return {
		...res,
		rolePool: res.rolePool as RolePool,
		preferences: JSON.parse(res.preferences as unknown as string)
	};
}

export async function updatePreferences(personUUID: string, preferences: Preferences) {
	await setPersonStats(personUUID, true);
	return db
		.prepare('UPDATE people SET preferences = ? WHERE uuid = ?')
		.run(JSON.stringify(preferences), personUUID);
}

export async function randomizePreferences() {
	// for testing only
	const people = await getPeople();
	for (let person of people) {
		updatePreferences(person.uuid, {
			doPits: Math.floor(Math.random() * 6) as 0 | 1 | 2 | 3 | 4 | 5,
			doMedia: Math.random() > 0.5,
			doStrategy: Math.random() > 0.5,
			doJournalism: Math.random() > 0.5
		});
	}
}

export async function importPreferences() {
	const csvContent = fs.readFileSync('static/prefs.csv', 'utf-8');
	const records: Record<string, string>[] = parse(csvContent, {
		columns: true,
		skip_empty_lines: true
	});
	const people = await getPeople();
	people.forEach(async (person) => await setPersonStats(person.uuid, false));
	for (let entry of records) {
		let personData = people.find((v) => v.email === entry['Email Address']);
		if (!personData) continue;
		let preferences: Preferences = {
			doPits: entry['Are you interested in being on pit crew?'] == 'Yes' ? 1 : 0,
			doMedia: entry['What other roles are you interested in?'].includes('Media') ? true : false,
			doJournalism: entry['What other roles are you interested in?'].includes('Journalism')
				? true
				: false,
			doStrategy: entry['What other roles are you interested in?'].includes('Strategy')
				? true
				: false
		};
		await updatePreferences(personData.uuid, preferences);
	}
}

export async function updateRolePool(personUUID: string, rolePool: RolePool) {
	return db.prepare('UPDATE people SET rolePool = ? WHERE uuid = ?').run(rolePool, personUUID);
}

export async function setPersonStats(personUUID: string, attendingEvent: boolean) {
	return db
		.prepare('UPDATE people SET attendingEvent = ? WHERE uuid = ?')
		.run(attendingEvent, personUUID);
}

export async function changePersonStatus(personUUID: string) {
	const res = db.prepare('SELECT attendingEvent FROM people WHERE uuid = ?').get(personUUID);
	let attendingEvent: boolean = res.attendingEvent;
	setPersonStats(personUUID, !attendingEvent);
}

export async function setPersonSchedule(personUUID: string, schedule: (Role | null)[]) {
	return db
		.prepare(`INSERT OR REPLACE INTO schedule VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		.run(personUUID, ...schedule);
}

export async function getSchedule() {
	const res = db.prepare(`SELECT * FROM schedule`).all() as Record<string, string>[];
	return res.map((row) => ({ ...row })) as unknown as personSchedule[];
}

export async function getPersonSchedule(personUUID: string) {
	return db
		.prepare(`SELECT * FROM schedule WHERE personUUID = ?`)
		.get(personUUID) as personSchedule;
}

export async function getCurrentSchedule() {
	const slot = await msToSlot(Date.now());
	if (!slot) return [];
	return await getScheduleAtSlot(slot.num);
}

export async function getScheduleAtSlot(slotNum: number) {
	const res: personSchedule[] = db.prepare(`SELECT * FROM schedule`).all();
	let final = [];
	for (let person of res) {
		let role = (person as Record<string, string>)[`slot${slotNum}`];
		final.push({ personUUID: person.personUUID, role: role as Role });
	}
	return final;
}

export async function clearSchedule() {
	return db.prepare('DELETE FROM schedule').run();
}

export async function getNamesInRole(role: Role, slotNum: number): Promise<string[]> {
	const schedule = await getScheduleAtSlot(slotNum);
	let correct = schedule.filter((v) => {
		return (v.role as string) === role;
	});
	let names = correct.map(async (v) => {
		let person = await getPerson(v.personUUID);
		if (!person) throw new Error('invalid person uuid');
		return person.displayName;
	});
	return Promise.all(names);
}

export async function setSlot(data: {
	slotNumber: number;
	startTimestamp: number;
	endTimestamp: number;
	startLabel: string;
	endLabel: string;
	allowUpdate: boolean;
}) {
	db.prepare('INSERT OR REPLACE INTO slots VALUES (?, ?, ?, ?, ?, ?)').run(
		data.slotNumber,
		data.startTimestamp,
		data.endTimestamp,
		data.startLabel,
		data.endLabel,
		data.allowUpdate
	);
}

export async function setSlots(
	data: {
		slotNumber: number;
		startTimestamp: number;
		endTimestamp: number;
		startLabel: string;
		endLabel: string;
		allowUpdate: boolean;
	}[]
) {
	await clearSlots();
	data.forEach((v) => {
		setSlot(v);
	});
}

export async function getSlots() {
	return db.prepare('SELECT * FROM slots').all() as {
		slotNumber: number;
		startTimestamp: number;
		endTimestamp: number;
		startLabel: string;
		endLabel: string;
		allowUpdate: boolean;
	}[];
}

export async function clearSlots() {
	return db.prepare('DELETE FROM slots').run();
}

export async function getCFG(): Promise<{ key: string; value: string }[]> {
	return db.prepare('SELECT * FROM timingCfg').all();
}

export async function setCFG(data: { key: string; value: any }) {
	return db.prepare('INSERT OR REPLACE INTO timingCfg VALUES (?, ?)').run(data.key, data.value);
}

export async function removeCFG(key: string) {
	return db.prepare('DELETE FROM timingCfg WHERE key = ?').run(key);
}

export async function isValidSession(sessionID: string): Promise<boolean> {
	const res =
		((await db
			.prepare('SELECT session_expire FROM sessions WHERE session_id = ?')
			.get(sessionID)) as { session_expire: number }) || null;
	if (!res) return false;
	const expires = res.session_expire ?? null;
	if (expires) {
		if (expires > Date.now()) return true;
		else {
			console.log('removing session');
			await db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionID);
			return false;
		}
	} else return false;
}

export async function newSession(): Promise<string> {
	const sessionID = Bun.randomUUIDv7();
	const sessionExpire = Date.now() + 60 * 60 * 1000; // expires 1hr after creation
	await db.prepare('INSERT INTO sessions VALUES (?, ?)').run(sessionID, sessionExpire);
	return sessionID;
}

export async function clearSessions() {
	return db.prepare('DELETE FROM sessions').run();
}

async function formatName(firstName: string, lastName: string) {
	const res: PersonData[] = await db
		.prepare('SELECT * FROM people WHERE firstName = ?')
		.all(firstName);
	for (let person of res) {
		let displayName = person.firstName;
		if (res.length > 1) displayName = `${person.firstName} ${person.lastName[0]}.`;
		await db
			.prepare('UPDATE people SET displayName = ? WHERE uuid = ?')
			.run(displayName, person.uuid);
	}
}

export async function msToSlot(ms: number) {
	const slots = await getSlots();
	let slot;
	for (let current of slots) {
		if (current.startTimestamp < ms && current.endTimestamp > ms) {
			slot = current;
		}
	}
	if (!slot) return null;
	const msToTime = (ms: number) => {
		return new Date(ms).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' });
	};
	let label =
		slot.startLabel != ''
			? `${slot.startLabel}-${slot.endLabel}`
			: `${msToTime(slot.startTimestamp)}-${msToTime(slot.endTimestamp)}`;
	return { num: slot.slotNumber, label };
}
