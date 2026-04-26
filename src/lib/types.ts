export type Preferences = {
	doPits: boolean;
	doMedia: boolean;
	doStrategy: boolean;
	doJournalism: boolean;
};

export type PersonData = {
	uuid: string;
	firstName: string;
	lastName: string;
	displayName: string;
	email: string;
	phone: number;
	attendingEvent: boolean;
	attendingLoadIn: boolean;
	slotsAttending: number[]; // the numbers of the slots they are attending; to be used if someone is arriving late or leaving early
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

export type slotData = {
	slotNumber: number;
	startTimestamp: number;
	endTimestamp: number;
	startLabel: string | null;
	endLabel: string | null;
	allowUpdate: boolean;
	doScouting: boolean;
};

export enum Role {
	Open = 'Open',
	PitLead = 'Pit Lead',
	Pits = 'Pits',
	Drive = 'Drive',
	Scouting = 'Scouting',
	Strategy = 'Strategy',
	Media = 'Media',
	Journalism = 'Journalism',
	TiaraJudge = 'Tiara Judge'
}

export enum RolePool {
	None = 'None',
	PitLead = 'Pit Lead',
	Drive = 'Drive',
	NO_Scouting = 'No Scouting',
	ONLY_Strategy = 'Strategy Only',
	TiaraJudge = 'Tiara Judge'
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
