import { Database } from 'bun:sqlite';
import type { PersonData, Preferences, Role } from './types';
import { msToSlot } from './schedule';

const db = new Database('app.db');

db.run('PRAGMA journal_mode = WAL;');

db.run(`
	CREATE TABLE IF NOT EXISTS people (
		id INT AUTO_INCREMENT PRIMARY KEY,
		first_name TEXT,
        last_name TEXT,
        attending_event BOOLEAN,
        preferences JSON
	)
`);

db.run(`
    CREATE TABLE IF NOT EXISTS schedule (
        personID INT PRIMARY KEY,
        "0800-0830" TEXT,
        "0830-0900" TEXT,
        "0900-0930" TEXT,
        "0930-1000" TEXT,
        "1000-1030" TEXT,
        "1030-1100" TEXT,
        "1100-1130" TEXT,
        "1130-1200" TEXT,
        "1200-1230" TEXT,
        "1230-1300" TEXT,
        "1300-1330" TEXT,
        "1330-1400" TEXT,
        "1400-1430" TEXT,
        "1430-1500" TEXT,
        "1500-1530" TEXT,
        "1530-1600" TEXT,
        "1600-1630" TEXT,
        "1630-1700" TEXT,
        "1700-1730" TEXT,
        "1730-1800" TEXT
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
        session_id CHAR(36),
        session_expire LONG
    )
`);

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

export async function setPersonSchedule(personID: number, schedule: Role[]) {
	return db
		.prepare(
			`INSERT OR REPLACE INTO schedule VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(personID, ...schedule);
}

export async function getSchedule() {
	return db.prepare(`SELECT * FROM schedule`).all();
}

export async function getPersonSchedule(personID: number) {
	return db.prepare(`SELECT * FROM schedule WHERE personID = ?`).get(personID);
}

export async function getCurrentSchedule() {
	const slot = msToSlot(Date.now());
	return db.prepare(`SELECT ? FROM schedule`).all(slot);
}

export async function isValidSession(sessionID: string): Promise<boolean> {
	const res = (await db
		.prepare('SELECT session_expire FROM sessions WHERE session_id = ?')
		.get(sessionID)) as { session_expire: number };
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
