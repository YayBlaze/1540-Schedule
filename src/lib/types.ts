export type Preferences = {
	doPits: 0 | 1 | 2 | 3 | 4 | 5; // 0 = doesn't want pits, 5 = wants as much pits as possible, -1 = pit lead
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

export type personSchedule = {
	personUUID: string;
	slot1: Role;
	slot2: Role;
	slot3: Role;
	slot4: Role;
	slot5: Role;
	slot6: Role;
	slot7: Role;
	slot8: Role;
	slot9: Role;
	slot10: Role;
	slot11: Role;
};

export enum Role {
	Open = 'Open',
	PitLead = 'Pit Lead',
	Pits = 'Pits',
	Drive = 'Drive',
	Scouting = 'Scouting',
	Strategy = 'Strategy',
	Media = 'Media',
	Journalism = 'Journalism'
}

export enum RolePool {
	None = 'None',
	PitLead = 'Pit Lead',
	Drive = 'Drive',
	NO_Scouting = 'No Scouting'
}

export type nexusData = {
	eventKey: string;
	dataAsOfTime: number;
	nowQueuing: string;
	matches: nexusMatch[];
};

export type nexusMatch = {
	label: string;
	status: string;
	redTeams: string[];
	blueTeams: string[];
	breakAfter: string;
	times: times;
};

export type times = {
	estimatedQueueTime: number;
	estimatedOnDeckTime: number;
	estimatedOnFieldTime: number;
	estimatedStartTime: number;
	scheduledStartTime: number;
};
