export type Preferences = {
	isDriveTeam: boolean;
	doPits: -1 | 0 | 1 | 2 | 3 | 4 | 5; // 0 = doesn't want pits, 5 = wants as much pits as possible, -1 = pit lead
	doMedia: boolean;
	doStrategy: boolean;
	doJournalism: boolean;
};

export type PersonData = {
	uuid: string;
	firstName: string;
	lastName: string;
	displayName: string;
	attendingEvent: boolean;
	rolePool: RolePool;
	preferences: Preferences;
};

export enum Role {
	PitLead,
	Pits,
	Drive,
	Scouting,
	Strategy,
	Media,
	Journalism
}

export enum RolePool {
	None,
	PitLead,
	Drive,
	Scouting_ONLY,
	Strategy_ONLY
}
