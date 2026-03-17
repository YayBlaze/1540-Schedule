import { Database } from 'bun:sqlite';
import type { Preferences, Role } from './types';

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

export async function getPeople() {
	return db.prepare('SELECT * FROM people WHERE attending_event = true').all();
}

export async function addPerson(data: {
	first_name: string;
	last_name: string;
	attending_event: boolean;
	preferences: Preferences;
}) {
	return db
		.prepare('INSERT OR REPLACE INTO people VALUES (?, ?, ?, ?)')
		.run(data.first_name, data.last_name, data.attending_event, JSON.stringify(data.preferences));
}

export async function setPersonSchedule(personID: number, schedule: Role[]) {
	await db
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
