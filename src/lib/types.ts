export enum Role {
	Scouting,
	Pits,
	PitLead,
	Strategy,
	Media,
	Journalism
}

export type Preferences = {
	doPits: -1 | 0 | 1 | 2 | 3 | 4 | 5; // 0 = doesn't want pits, 5 = wants as much pits as possible, -1 = pit lead
	doMedia: boolean;
	doStrategy: boolean;
	doJournalism: boolean;
};

export type PersonData = {
	id: number;
	firstName: string;
	lastName: string;
	attendingEvent: boolean;
	preferences: Preferences;
};
