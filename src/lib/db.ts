import { Database } from 'bun:sqlite';

const db = new Database('app.db');

db.run('PRAGMA journal_mode = WAL;');

db.run(`
	CREATE TABLE IF NOT EXISTS people (
			id INT AUTO_INCREMENT PRIMARY KEY,
			first_name TEXT,
            last_name TEXT,
            attending_event BOOLEAN,
            schedule JSON
	)
`);

export function getPeople() {
	return db.prepare('SELECT * FROM people WHERE attending_event = true').all();
}
