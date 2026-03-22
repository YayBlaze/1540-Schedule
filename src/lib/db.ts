import { Database } from 'bun:sqlite';
import type { PersonData, Preferences } from './types';

let db: any = null;

export async function initDB() {
	db = new Database('app.db');

	db.run('PRAGMA journal_mode = WAL;');

	db.run(`
		CREATE TABLE IF NOT EXISTS people (
			id INT AUTO_INCREMENT PRIMARY KEY,
			firstName TEXT,
			lastName TEXT,
			attendingEvent BOOLEAN,
			preferences JSON
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS schedule (
			personID INT PRIMARY KEY,
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
			slot11 TEXT,
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS slots (
			slotNumber INT PRIMARY KEY,
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
	return db.prepare('SELECT * FROM people WHERE attending_event = true').all() as PersonData[];
}

export async function addPerson(data: PersonData) {
	return db
		.prepare('INSERT OR REPLACE INTO people VALUES (?, ?, ?, ?)')
		.run(data.firstName, data.lastName, data.attendingEvent, JSON.stringify(data.preferences));
}

export async function getPerson(personID: number): Promise<PersonData> {
	return db.prepare('SELECT * FROM people WHERE id = ?').get(personID) as PersonData;
}

export async function updatePreferences(personID: number, preferences: Preferences) {
	return db.prepare('UPDATE people SET preferences = ? WHERE id = ?').run(preferences, personID);
}

export async function setPersonSchedule(personID: number, schedule: string[]) {
	return db
		.prepare(`INSERT OR REPLACE INTO schedule VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		.run(personID, ...schedule);
}

export async function getSchedule() {
	return db.prepare(`SELECT * FROM schedule`).all();
}

export async function getPersonSchedule(personID: number) {
	return db.prepare(`SELECT * FROM schedule WHERE personID = ?`).get(personID);
}

export async function getCurrentSchedule() {
	const slot = await msToSlot(Date.now());
	const res = db.prepare(`SELECT * FROM schedule`).all();
	let final = [];
	for (let person of res) {
		let role = person[slot.num];
		final.push({ personID: person.personID, role });
	}
	return final;
}

export async function isValidSession(sessionID: string): Promise<boolean> {
	const res = (await db
		.prepare('SELECT session_expire FROM sessions WHERE session_id = ?')
		.get(sessionID)) as { session_expire: number };
	const expires = res.session_expire;
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

export async function formatName(personID: number) {
	const data = await getPerson(personID);
	const res = await db.prepare('SELECT * FROM people WHERE firstName = ?').all(data.firstName);
	if (res.length > 1) {
		return `${data.firstName} ${data.lastName[0]}.`;
	} else {
		return data.firstName;
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
