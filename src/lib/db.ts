import { Database } from 'bun:sqlite';
import { Role, RolePool, type PersonData, type Preferences } from './types';

let db: any = null;

export async function initDB() {
	db = new Database('app.db');

	db.run('PRAGMA journal_mode = WAL;');

	db.run(`
		CREATE TABLE IF NOT EXISTS people (
			uuid TEXT PRIMARY KEY,
			firstName TEXT,
			lastName TEXT,
			displayName TEXT,
			attendingEvent BOOLEAN,
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
			endLabel TEXT
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
	const res = db.prepare('SELECT * FROM people').all() as PersonData[];
	return res.map((data) => {
		let value: unknown = data.rolePool;
		return { ...data, rolePool: RolePool[value as keyof typeof RolePool] };
	});
}

export async function addPerson(data: { firstName: string; lastName: string }) {
	await db
		.prepare('INSERT OR REPLACE INTO people VALUES (?, ?, ?, ?, ?, ?, ?)')
		.run(
			Bun.randomUUIDv7(),
			data.firstName,
			data.lastName,
			data.firstName,
			false,
			RolePool[RolePool.None],
			JSON.stringify({})
		);
	await formatName(data.firstName, data.lastName);
}

export async function removePerson(personID: string) {
	const data = await getPerson(personID);
	await db.prepare('DELETE FROM people WHERE uuid = ?').run(personID);
	await formatName(data.firstName, data.lastName);
}

export async function getPerson(personID: string): Promise<PersonData> {
	const res = db.prepare('SELECT * FROM people WHERE uuid = ?').get(personID) as PersonData;
	let value: unknown = res.rolePool;
	return { ...res, rolePool: RolePool[value as keyof typeof RolePool] };
}

export async function updatePreferences(personID: string, preferences: Preferences) {
	return db.prepare('UPDATE people SET preferences = ? WHERE uuid = ?').run(preferences, personID);
}

export async function updateRolePool(personID: string, rolePool: RolePool) {
	return db
		.prepare('UPDATE people SET rolePool = ? WHERE uuid = ?')
		.run(RolePool[rolePool], personID);
}

export async function changePersonStatus(personID: string) {
	const res = db.prepare('SELECT attendingEvent FROM people WHERE uuid = ?').get(personID);
	let attendingEvent: boolean = res.attendingEvent;
	return db
		.prepare('UPDATE people SET attendingEvent = ? WHERE uuid = ?')
		.run(!attendingEvent, personID);
}

export async function setPersonSchedule(personID: string, schedule: Role[]) {
	const roleStrings = schedule.map((role) => Role[role]);
	return db
		.prepare(`INSERT OR REPLACE INTO schedule VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		.run(personID, ...roleStrings);
}

export async function getSchedule() {
	const res = db.prepare(`SELECT * FROM schedule`).all() as Record<string, any>[];
	return res.map((row) => {
		const mapped: Record<string, any> = {};
		for (const key in row) {
			mapped[key] = key === 'personID' ? row[key] : toRole(row[key]);
		}
		return mapped;
	});
}

export async function getPersonSchedule(personID: string) {
	const res = db.prepare(`SELECT * FROM schedule where personID = ?`).get(personID) as Record<
		string,
		any
	>;
	const mapped: Record<string, any> = {};
	for (const key in res) {
		mapped[key] = key === 'personID' ? res[key] : toRole(res[key]);
	}
	return mapped;
}

export async function getCurrentSchedule() {
	const slot = await msToSlot(Date.now());
	const res = db.prepare(`SELECT * FROM schedule`).all();
	let final = [];
	for (let person of res) {
		let role: string = person[slot.num];
		final.push({ personID: person.personID, role: toRole(role) });
	}
	return final;
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
	const slots = await db.prepare('SELECT * FROM slots').all();
	let num;
	for (let slot of slots) {
		if (slot.startTimestamp < ms && slot.endTimestamp > ms) {
			num = slot.slotNumber;
		}
	}
	return { num: `slot${num}`, label: `${slots.startLabel}-${slots.endLabel}` };
}

function toRole(value: string): Role {
	return Role[value as keyof typeof Role];
}
