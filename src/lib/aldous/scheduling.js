const RL = ['Drive', 'Pits', 'Pit Lead', 'Journalist', 'Strategy', 'Media'];
const SCT = 'Scouting!';
const RL_STAFF = [...RL, SCT];

const CMUST = ['email', 'wantsPits', 'whichDays'];

const HP = 1000000;
const BW = {
	Drive: 5,
	'Pit Lead': 4,
	Pits: 3,
	Strategy: 2,
	Media: 2,
	Journalist: 2,
	'Scouting!': 1.5,
	Open: 0
};

const ROLE_ENUM = Object.freeze({
	Open: 0,
	PitLead: 1,
	Pits: 2,
	Drive: 3,
	Scouting: 4,
	Strategy: 5,
	Media: 6,
	Journalism: 7
});

const STR_TO_ROLE_ENUM = Object.freeze({
	Open: ROLE_ENUM.Open,
	'Pit Lead': ROLE_ENUM.PitLead,
	Pits: ROLE_ENUM.Pits,
	Drive: ROLE_ENUM.Drive,
	'Scouting!': ROLE_ENUM.Scouting,
	Strategy: ROLE_ENUM.Strategy,
	Media: ROLE_ENUM.Media,
	Journalist: ROLE_ENUM.Journalism
});

function idHit(lst, emLc, disp) {
	if (!lst || !lst.length) return false;
	const nm = (disp || '').trim().toLowerCase();
	return lst.some((raw) => {
		const x = String(raw).trim();
		if (!x) return false;
		const xl = x.toLowerCase();
		if (x.includes('@')) return xl === emLc;
		return xl === emLc || xl === nm;
	});
}

function pitLd(p, plIds) {
	if (!p || !plIds || !plIds.length) return false;
	return idHit(plIds, (p.email || '').toLowerCase(), p.name);
}

function valCfg(CF) {
	const die = (m) => {
		throw new Error(`config: ${m}`);
	};
	if (!CF || typeof CF !== 'object') die('cfg object required');
	const hasSubs = Array.isArray(CF.subs) && CF.subs.length > 0;
	if (!hasSubs) {
		if (!CF.csvPath) die('csvPath required');
		if (!CF.columnMap || typeof CF.columnMap !== 'object') die('columnMap required');
		for (const k of CMUST) {
			const v = CF.columnMap[k];
			if (v == null || String(v).trim() === '')
				die(`columnMap.${k} must be a non-empty header string`);
		}
	}
	if (!CF.roleStaffing) die('roleStaffing required');
	for (const r of RL_STAFF) {
		const rs = CF.roleStaffing[r];
		if (!rs || rs.min == null || rs.max == null) die(`roleStaffing.${r} with min and max required`);
		if (Number(rs.min) > Number(rs.max)) die(`roleStaffing.${r}: min cannot exceed max`);
	}
	if (CF.driveTeamExtra != null && !Array.isArray(CF.driveTeamExtra)) {
		die('driveTeamExtra must be an array when set');
	}
	if (!Array.isArray(CF.pitLeadIds)) die('pitLeadIds (array) required');
	if (!Array.isArray(CF.noScouting)) die('noScouting (array) required');
	if (!Array.isArray(CF.daySchedule) || CF.daySchedule.length < 1)
		die('daySchedule (non-empty array) required');
	CF.daySchedule.forEach((d, i) => {
		const c = d.clock;
		if (!c || c.start == null || c.lunchStart == null || c.lunchEnd == null || c.end == null) {
			die(`daySchedule[${i}].clock needs start, lunchStart, lunchEnd, end`);
		}
		if (typeof d.matchesBeforeLunch !== 'number' || typeof d.matchesAfterLunch !== 'number') {
			die(`daySchedule[${i}].matchesBeforeLunch and matchesAfterLunch (numbers) required`);
		}
		if (d.matchesBeforeLunch + d.matchesAfterLunch < 1) {
			die(`daySchedule[${i}] needs at least one match total`);
		}
	});
	if (CF.optimizationIterations == null) die('optimizationIterations required');
}

function genMatchBlocksFromDay(dc) {
	const c = dc.clock;
	const st0 = timeToMins(c.start);
	const lS = timeToMins(c.lunchStart);
	const lE = timeToMins(c.lunchEnd);
	const en0 = timeToMins(c.end);
	const nB = Math.max(0, dc.matchesBeforeLunch | 0);
	const nA = Math.max(0, dc.matchesAfterLunch | 0);
	const labels = [];
	const windows = [];
	let k = 0;
	const fmtBlk = (a, b) => {
		const h1 = Math.floor(a / 60);
		const m1 = Math.round(a % 60);
		const h2 = Math.floor(b / 60);
		const m2 = Math.round(b % 60);
		const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
		return `${pad(h1)}:${pad(m1)}-${pad(h2)}:${pad(m2)}`;
	};
	if (nB > 0) {
		const span = Math.max(1, lS - st0);
		const w = span / nB;
		for (let i = 0; i < nB; i++) {
			k += 1;
			labels.push(`Match ${k}`);
			windows.push(fmtBlk(st0 + i * w, st0 + (i + 1) * w));
		}
	}
	if (nA > 0) {
		const span = Math.max(1, en0 - lE);
		const w = span / nA;
		for (let i = 0; i < nA; i++) {
			k += 1;
			labels.push(`Match ${k}`);
			windows.push(fmtBlk(lE + i * w, lE + (i + 1) * w));
		}
	}
	return { labels, windows };
}

function resolveScoutLastMatch(dc, CF) {
	const raw =
		dc.scoutLastMatch ??
		dc.scoutThroughMatch ??
		dc.scoutingStopsAfterMatch ??
		dc.noScoutingAfterMatch ??
		CF?.scoutLastMatch ??
		CF?.scoutThroughMatch ??
		CF?.scoutingStopsAfterMatch ??
		CF?.noScoutingAfterMatch;
	if (raw == null || !Number.isFinite(Number(raw))) return null;
	const n = Number(raw);
	return n < 1 ? null : n;
}

function dayScoutCtx(dc, blockWindows, CF) {
	const lim = resolveScoutLastMatch(dc, CF);
	if (lim != null) {
		return {
			scoutLastMatch: lim,
			sctEndMn: Infinity,
			blockWindows
		};
	}
	const sctEndMn = dc.scoutEnd != null ? timeToMins(dc.scoutEnd) : Infinity;
	return {
		scoutLastMatch: null,
		sctEndMn,
		blockWindows
	};
}

function scoutSlotOpen(bi, ctx) {
	const lab = ctx.blockLabels && ctx.blockLabels[bi];
	if (lab != null && labelIsElimination(lab)) return false;
	if (ctx.scoutLastMatch != null && Number.isFinite(ctx.scoutLastMatch)) {
		return bi + 1 <= ctx.scoutLastMatch;
	}
	const win = ctx.blockWindows && ctx.blockWindows[bi];
	if (win) return blkStartMins(win) < ctx.sctEndMn;
	if (ctx.sctEndMn === Infinity) return true;
	return false;
}

function ldReq(CF, nBlk) {
	const raw = CF.roleStaffing;
	const fill = (val, len) => {
		if (val == null) return new Array(len).fill(0);
		if (Array.isArray(val)) {
			return val.length >= len
				? val.slice(0, len)
				: val.concat(new Array(len - val.length).fill(val[val.length - 1] ?? 0));
		}
		return new Array(len).fill(val);
	};
	const req = {};
	RL_STAFF.forEach((r) => {
		const rr = raw[r];
		req[r] = { min: fill(rr?.min, nBlk), max: fill(rr?.max, nBlk) };
	});
	return req;
}

function shortName(n) {
	if (!n) return '';
	if (n.includes('@')) {
		const local = n.split('@')[0] || '';
		if (local.length === 0) return n;
		if (local.length === 1) return local.toUpperCase();
		const fi = local[local.length - 1].toUpperCase();
		const lRaw = local.slice(0, -1);
		const ln = lRaw.charAt(0).toUpperCase() + lRaw.slice(1);
		return `${fi} ${ln}`;
	}
	const p = n.trim().split(/\s+/);
	if (p.length < 2) return p[0] || n;
	return p[0] + ' ' + (p[1][0] || '').toUpperCase() + '.';
}

function shuf(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function parseCSV(txt) {
	const rows = [];
	let row = [];
	let cur = '';
	let q = false;

	for (let i = 0; i < txt.length; i++) {
		const c = txt[i];
		if (c === '"') {
			if (q && txt[i + 1] === '"') {
				cur += '"';
				i++;
				continue;
			}
			q = !q;
			continue;
		}
		if (!q) {
			if (c === ',') {
				row.push(cur.trim());
				cur = '';
				continue;
			}
			if (c === '\n' || c === '\r') {
				if (c === '\r' && txt[i + 1] === '\n') i++;
				row.push(cur.trim());
				if (row.some((cell) => cell !== '')) rows.push(row);
				row = [];
				cur = '';
				continue;
			}
		}
		cur += c;
	}

	if (cur !== '' || row.length > 0) {
		row.push(cur.trim());
		if (row.some((cell) => cell !== '')) rows.push(row);
	}

	return rows;
}

function timeToMins(t) {
	const [h, m] = (t || '0:00').split(':').map(Number);
	return (h || 0) * 60 + (m || 0);
}

function blkStartMins(blkStr) {
	const start = blkStr.split('-')[0].trim();
	const [h, m] = start.split(':').map(Number);
	return (h || 0) * 60 + (m || 0);
}

function blkEndMins(blkStr) {
	const parts = String(blkStr || '').split('-');
	const end = (parts[1] || parts[0] || '').trim();
	const [h, m] = end.split(':').map(Number);
	return (h || 0) * 60 + (m || 0);
}

function blkDurationMins(winStr) {
	if (!winStr || typeof winStr !== 'string') return 1;
	const a = blkStartMins(winStr);
	const b = blkEndMins(winStr);
	const d = b - a;
	return Math.max(1, Number.isFinite(d) ? d : 1);
}

function slotMinutesFromWindows(windows, nBlk) {
	const out = [];
	for (let i = 0; i < nBlk; i++) {
		const w = windows && windows[i];
		out.push(w ? blkDurationMins(w) : 1);
	}
	return out;
}

function labelIsElimination(lab) {
	const s = String(lab || '').toLowerCase();
	if (!s) return false;
	if (/\bqm\d|\bqual/i.test(s)) return false;
	return (
		/\b(elim|playoff|playoffs|semis?|quarters?|einstein|championship)\b/i.test(s) ||
		/^sf\s*\d|^qf\s*\d|^f\s*\d|^\s*f\d+\s*$/i.test(s) ||
		/\bdivision\s*final/i.test(s)
	);
}

function labelIsFinalsPitCap(lab) {
	const s = String(lab || '').toLowerCase();
	if (!s) return false;
	if (/\bqm\d|\bqual/i.test(s)) return false;
	return (
		/\b(finals?|einstein|championship|division\s*final)\b/i.test(s) ||
		/^f\s*\d/i.test(s)
	);
}

function strategyOnlySub(sub) {
	if (!sub) return false;
	if (sub.onlyStrategy === true) return true;
	const rp = String(sub.rolePool || '').toLowerCase();
	return rp === 'strategy only' || rp.includes('only_strategy');
}

// tiara: need TJG in RL + mask fn + patch req by block, havent merged

function attendingSlotSet(sub, nBlk) {
	const raw = sub && sub.slotsAttending;
	if (!raw || !raw.length) return null;
	const nums = raw.map(Number).filter((x) => Number.isFinite(x));
	if (!nums.length) return null;
	const oneBased =
		nums.every((n) => n >= 1 && n <= nBlk) && !nums.includes(0);
	const set = new Set();
	for (const n of nums) {
		if (oneBased) set.add(n - 1);
		else if (n >= 0 && n < nBlk) set.add(Math.floor(n));
	}
	return set;
}

function isPresentAtSlot(sub, bi, nBlk) {
	const set = attendingSlotSet(sub, nBlk);
	if (!set) return true;
	return set.has(bi);
}

function parseSubs(rows, colMap, opts = {}) {
	const noScouting = opts.noScouting || [];
	const driveTeamExtra = opts.driveTeamExtra || [];
	if (rows.length < 2) return [];
	const hdrs = rows[0].map((h) => (h || '').trim());

	const k2i = {};
	for (const [k, htxt] of Object.entries(colMap)) {
		const idx = hdrs.findIndex((h) => h === htxt || h === k);
		if (idx >= 0) k2i[k] = idx;
	}

	const g = (row, k) => (k2i[k] != null ? (row[k2i[k]] || '').trim() : '');

	const out = [];
	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];
		const id = g(row, 'email');
		if (!id) continue;
		if (/^\d+$/.test(id)) continue;

		const email = (id || '').toLowerCase();
		const tag = (g(row, 'nametag') || '').trim();
		const name = tag || id;

		const wantsPits = /yes|true|1/i.test(g(row, 'wantsPits')) || /true|1/i.test(g(row, 'pit'));
		const otherRolesTxt = (g(row, 'otherRoles') || '').toLowerCase();
		const pitWorkTxt = (g(row, 'pitWorkType') || '').toLowerCase();
		const whichDaysTxt = (g(row, 'whichDays') || '').toLowerCase();

		const wantsMechPit =
			/true|1/i.test(g(row, 'mechPit')) || /mechanical|fab|design/i.test(pitWorkTxt);
		const wantsCtrlsPit = /true|1/i.test(g(row, 'ctrlsPit')) || /controls/i.test(pitWorkTxt);
		const wantsSwPit = /true|1/i.test(g(row, 'swPit')) || /software/i.test(pitWorkTxt);

		const wantsJournalism =
			/true|1/i.test(g(row, 'journalism')) || /journalism/i.test(otherRolesTxt);
		const wantsStrategy = /true|1/i.test(g(row, 'strategy')) || /strategy/i.test(otherRolesTxt);
		const wantsMedia = /true|1/i.test(g(row, 'media')) || /media/i.test(otherRolesTxt);

		const driveTeam = /yes|true|1/i.test(g(row, 'driveTeam')) || idHit(driveTeamExtra, email, name);

		let friday = /true|yes|1/i.test(g(row, 'friday'));
		let saturday = /true|yes|1/i.test(g(row, 'saturday'));
		if (!friday && !saturday && whichDaysTxt) {
			const day0Match = /friday|saturday|3\/6|3\/7|3\/14/i.test(whichDaysTxt);
			const day1Match = /sunday|3\/8|3\/15/i.test(whichDaysTxt);
			friday = day0Match;
			saturday = day1Match;
		}
		if (!friday && !saturday) continue;

		let cannotScout = /yes|true|1/i.test(g(row, 'cannotScout'));
		if (idHit(noScouting, email, name)) cannotScout = true;

		out.push({
			name: name || 'Unknown',
			email,
			wantsPits,
			wantsMechPit,
			wantsCtrlsPit,
			wantsSwPit,
			wantsJournalism,
			wantsStrategy,
			wantsMedia,
			driveTeam,
			cannotScout,
			unavailableTimes: g(row, 'unavailableTimes') || g(row, 'timesOfDay'),
			conventionTalks: g(row, 'conventionTalks'),
			friday,
			saturday
		});
	}

	return out;
}

function reqAt(req, role, blkIdx, k) {
	const r = req[role];
	if (!r) return 0;
	const v = r[k];
	return Array.isArray(v) ? (v[blkIdx] ?? 0) : (v ?? 0);
}

function roleAffinity(sub, role, pitLeadIds, noStrategy, blkIdx, sctCtx) {
	if (!sub) return -999;
	const ns = noStrategy || [];
	if (role === 'Drive') return sub.driveTeam ? 1000 : -1000;
	if (sub.driveTeam) return -500;

	if (strategyOnlySub(sub)) {
		if (role === 'Open') return 0;
		if (role === 'Strategy') return sub.wantsStrategy !== false ? 80 : 40;
		return -1000;
	}

	if (role === 'Pit Lead') return pitLd(sub, pitLeadIds) ? 120 : sub.wantsPits ? 12 : -5;
	if (role === 'Pits') return sub.wantsPits ? 30 : -6;
	if (role === 'Strategy')
		return sub.wantsStrategy ? 25 : idHit(ns, sub.email, sub.name) ? -1000 : -6;
	if (role === 'Media') return sub.wantsMedia ? 24 : -5;
	if (role === 'Journalist') return sub.wantsJournalism ? 24 : -5;
	if (role === SCT) return sub.cannotScout ? -1000 : 10;
	if (role === 'Open') return 0;
	return -1;
}

function isUnavailable(sub, blkLabel, blkIdx) {
	if (!sub || !sub.unavailableTimes) return false;
	const t = String(sub.unavailableTimes).toLowerCase();
	if (/^match\s*\d+/i.test(blkLabel)) {
		const n = blkIdx + 1;
		if (t.includes(`match ${n}`) || t.includes(`match${n}`)) return true;
	}
	const st = (blkLabel.split('-')[0] || '').replace(':', '');
	return !!st && t.includes(st);
}

function isEligible(sub, role, blkIdx, blkLabel, sctCtx, noScouting, pitLeadIds, nBlk) {
	if (!sub) return false;
	const nb = nBlk != null ? nBlk : (sctCtx && sctCtx.nBlk) || 0;
	if (nb > 0 && !isPresentAtSlot(sub, blkIdx, nb) && role !== 'Open') return false;
	if (isUnavailable(sub, blkLabel, blkIdx)) return false;

	if (role === 'Pit Lead' && !pitLd(sub, pitLeadIds || [])) return false;

	if (role === 'Drive') return !!sub.driveTeam;
	if (sub.driveTeam && role !== 'Open') return false;

	if (strategyOnlySub(sub) && role !== 'Open' && role !== 'Strategy') return false;

	if (role === SCT) {
		if (sub.cannotScout || idHit(noScouting || [], sub.email, sub.name)) return false;
		if (!scoutSlotOpen(blkIdx, sctCtx)) return false;
	}

	return true;
}

function buildSubMap(subs) {
	const m = new Map();
	for (const s of subs) m.set(s.email, s);
	return m;
}

function calcBurden(p) {
	return (p.schedule || []).reduce((sum, r) => sum + (BW[r] ?? 0), 0);
}

function meanSlotWeight(slotMins) {
	if (!slotMins || !slotMins.length) return 1;
	const s = slotMins.reduce((a, b) => a + b, 0);
	return Math.max(1, s / slotMins.length);
}

function calcBurdenWeighted(p, slotMins) {
	const sch = p.schedule || [];
	if (!slotMins || !slotMins.length) return calcBurden(p);
	const ref = meanSlotWeight(slotMins);
	let sum = 0;
	for (let bi = 0; bi < sch.length; bi++) {
		const r = sch[bi];
		const w = (slotMins[bi] ?? 1) / ref;
		sum += (BW[r] ?? 0) * w;
	}
	return sum;
}

function consecutiveStreakPenalty(sch, slotMins) {
	let pen = 0;
	const sm = slotMins && slotMins.length ? slotMins : null;
	const ref = sm ? meanSlotWeight(sm) : 1;
	for (let bi = 1; bi < (sch || []).length; bi++) {
		const r = sch[bi];
		const prev = sch[bi - 1];
		if (!r || r === 'Open' || r !== prev) continue;
		const m0 = sm ? (sm[bi - 1] ?? 1) / ref : 1;
		const m1 = sm ? (sm[bi] ?? 1) / ref : 1;
		const base = (m0 + m1) * (BW[r] ?? 0);
		const mult = r === SCT ? 2.4 : 1.5;
		pen += base * mult;
	}
	return pen;
}

function clonePeople(people) {
	return people.map((p) => ({ ...p, schedule: [...(p.schedule || [])] }));
}

function countRole(people, blkIdx, role) {
	let c = 0;
	for (const p of people) if ((p.schedule || [])[blkIdx] === role) c++;
	return c;
}

function countPitCrew(people, blkIdx) {
	let c = 0;
	for (const p of people) {
		const r = (p.schedule || [])[blkIdx];
		if (r === 'Pits' || r === 'Pit Lead') c++;
	}
	return c;
}

function patchReqWhereScoutClosed(req, sctCtx, nBlk) {
	const row = req[SCT];
	if (!row) return;
	for (let bi = 0; bi < nBlk; bi++) {
		if (scoutSlotOpen(bi, sctCtx)) continue;
		if (Array.isArray(row.min)) row.min[bi] = 0;
		else row.min = 0;
		if (Array.isArray(row.max)) row.max[bi] = 0;
		else row.max = 0;
	}
}

function trimFinalsPitCrew(people, blkIdx, blocks) {
	if (!labelIsFinalsPitCap(blocks[blkIdx])) return;
	const finalsCap = 3;
	const pitters = people.filter((p) => {
		const r = (p.schedule || [])[blkIdx];
		return r === 'Pits' || r === 'Pit Lead';
	});
	if (pitters.length <= finalsCap) return;
	pitters.sort((a, b) => {
		const ra = (a.schedule || [])[blkIdx];
		const rb = (b.schedule || [])[blkIdx];
		const la = ra === 'Pit Lead' ? 2 : 1;
		const lb = rb === 'Pit Lead' ? 2 : 1;
		if (la !== lb) return lb - la;
		return 0;
	});
	for (let i = finalsCap; i < pitters.length; i++) {
		pitters[i].schedule[blkIdx] = 'Open';
	}
}

function buildValidInitialSchedule(subs, blocks, req, schedCtx) {
	const sMap = buildSubMap(subs);
	const { sctCtx, pitLeadIds, noStrategy, noScouting, slotMins } = schedCtx;
	const nBlk = blocks.length;
	const sm = slotMins && slotMins.length === nBlk ? slotMins : null;
	const people = subs.map((s) => ({
		name: shortName(s.name),
		email: s.email,
		schedule: new Array(nBlk).fill('Open')
	}));

	const pickCandidates = (blkIdx, role, onlyPreferred = false) => {
		const blk = blocks[blkIdx];
		let cands = people.filter((p) => {
			if ((p.schedule || [])[blkIdx] !== 'Open') return false;
			const sub = sMap.get(p.email);
			if (!isEligible(sub, role, blkIdx, blk, sctCtx, noScouting, pitLeadIds, nBlk))
				return false;
			if (onlyPreferred && roleAffinity(sub, role, pitLeadIds, noStrategy, blkIdx, sctCtx) <= 0)
				return false;
			return true;
		});

		cands = cands.sort((a, b) => {
			const ba = sm ? calcBurdenWeighted(a, sm) : calcBurden(a);
			const bb = sm ? calcBurdenWeighted(b, sm) : calcBurden(b);
			const sa =
				roleAffinity(sMap.get(a.email), role, pitLeadIds, noStrategy, blkIdx, sctCtx) -
				ba * 0.2 +
				Math.random() * 0.01;
			const sb =
				roleAffinity(sMap.get(b.email), role, pitLeadIds, noStrategy, blkIdx, sctCtx) -
				bb * 0.2 +
				Math.random() * 0.01;
			return sb - sa;
		});

		return cands;
	};

	const assign = (blkIdx, role, target, onlyPreferred = false) => {
		let n = 0;
		const cands = pickCandidates(blkIdx, role, onlyPreferred);
		for (const p of cands) {
			if (n >= target) break;
			if (labelIsFinalsPitCap(blocks[blkIdx]) && (role === 'Pits' || role === 'Pit Lead')) {
				if (countPitCrew(people, blkIdx) >= 3) break;
			}
			p.schedule[blkIdx] = role;
			n++;
		}
		return n;
	};

	for (let bi = 0; bi < nBlk; bi++) {
		const driveTarget = Math.max(
			reqAt(req, 'Drive', bi, 'min'),
			Math.min(reqAt(req, 'Drive', bi, 'max'), subs.filter((s) => s.driveTeam).length)
		);
		assign(bi, 'Drive', driveTarget, true);

		const orderedHard = ['Pit Lead', 'Pits', 'Strategy', 'Media', 'Journalist'];
		for (const role of orderedHard) {
			const mn = reqAt(req, role, bi, 'min');
			const mx = reqAt(req, role, bi, 'max');
			assign(bi, role, mn, false);
			const cur = countRole(people, bi, role);
			if (cur < mx) assign(bi, role, mx - cur, true);
		}

		trimFinalsPitCrew(people, bi, blocks);

		const canScout = scoutSlotOpen(bi, sctCtx);
		const scoutMn = reqAt(req, SCT, bi, 'min');
		const scoutMx = reqAt(req, SCT, bi, 'max');
		if (canScout) {
			const eligOpen = people.filter((p) => {
				const sub = sMap.get(p.email);
				return (
					p.schedule[bi] === 'Open' &&
					isEligible(sub, SCT, bi, blocks[bi], sctCtx, noScouting, pitLeadIds, nBlk)
				);
			}).length;
			const scoutTarget = Math.max(scoutMn, Math.min(scoutMx, eligOpen));
			assign(bi, SCT, scoutTarget, false);
		}
	}

	return people;
}

function scoreDay(people, subs, blocks, req, schedCtx) {
	const sMap = buildSubMap(subs);
	const { sctCtx, pitLeadIds, noStrategy, noScouting, slotMins } = schedCtx;
	const nBlk = blocks.length;
	const sm = slotMins && slotMins.length === nBlk ? slotMins : null;
	const ref = sm ? meanSlotWeight(sm) : 1;
	let score = 0;
	let hardViol = 0;

	for (let bi = 0; bi < blocks.length; bi++) {
		const roleCounts = {};

		for (const p of people) {
			const r = (p.schedule || [])[bi] || 'Open';
			roleCounts[r] = (roleCounts[r] || 0) + 1;
			const sub = sMap.get(p.email);

			if (!isEligible(sub, r, bi, blocks[bi], sctCtx, noScouting, pitLeadIds, nBlk)) hardViol++;
			if (sub && sub.driveTeam && r !== 'Drive' && r !== 'Open') hardViol++;
			if (r === SCT && !scoutSlotOpen(bi, sctCtx)) hardViol++;
		}

		if (labelIsFinalsPitCap(blocks[bi])) {
			const pitN = (roleCounts['Pits'] || 0) + (roleCounts['Pit Lead'] || 0);
			if (pitN > 3) hardViol += pitN - 3;
		}

		for (const role of RL_STAFF) {
			const mn = reqAt(req, role, bi, 'min');
			const mx = reqAt(req, role, bi, 'max');
			const got = roleCounts[role] || 0;
			if (got < mn) hardViol += mn - got;
			if (got > mx) hardViol += got - mx;
		}
	}

	if (hardViol > 0) return -hardViol * HP;

	const burdens = people.map((p) => (sm ? calcBurdenWeighted(p, sm) : calcBurden(p)));
	const avgB = burdens.length ? burdens.reduce((a, b) => a + b, 0) / burdens.length : 0;

	for (const p of people) {
		const sub = sMap.get(p.email);
		const sch = p.schedule || [];
		const b = sm ? calcBurdenWeighted(p, sm) : calcBurden(p);
		let scoutW = 0;
		let pitW = 0;
		for (let bi = 0; bi < sch.length; bi++) {
			const r = sch[bi];
			const w = sm ? (sm[bi] ?? 1) / ref : 1;
			if (r === SCT) scoutW += w;
			if (r === 'Pits' || r === 'Pit Lead') pitW += w;
		}

		score -= Math.abs(b - avgB) * 28;
		score -= scoutW * scoutW * 1.5;
		score -= pitW * pitW * 1.2;
		score -= consecutiveStreakPenalty(sch, sm || null) * 22;

		for (let bj = 0; bj < sch.length; bj++) {
			const r = sch[bj];
			const aff = roleAffinity(sub, r, pitLeadIds, noStrategy, bj, sctCtx);
			if (aff > 0) score += 16;
			if (aff < 0 && r !== 'Open') score -= 14;
		}
	}

	return score;
}

function mutateDaySchedule(people, subs, blocks, schedCtx) {
	if (!people.length || !blocks.length) return null;

	const sMap = buildSubMap(subs);
	const { sctCtx, noScouting, pitLeadIds } = schedCtx;
	const nBlk = blocks.length;
	const next = clonePeople(people);
	const bi = Math.floor(Math.random() * blocks.length);
	const blk = blocks[bi];

	const aIdx = Math.floor(Math.random() * next.length);
	const bIdx = Math.floor(Math.random() * next.length);
	if (aIdx === bIdx) return null;

	const a = next[aIdx];
	const b = next[bIdx];
	const ra = (a.schedule || [])[bi] || 'Open';
	const rb = (b.schedule || [])[bi] || 'Open';

	if (!isEligible(sMap.get(a.email), rb, bi, blk, sctCtx, noScouting, pitLeadIds, nBlk))
		return null;
	if (!isEligible(sMap.get(b.email), ra, bi, blk, sctCtx, noScouting, pitLeadIds, nBlk))
		return null;

	if (labelIsFinalsPitCap(blk)) {
		const sim = next.map((p) => ({ ...p, schedule: [...(p.schedule || [])] }));
		sim[aIdx].schedule[bi] = rb;
		sim[bIdx].schedule[bi] = ra;
		if (countPitCrew(sim, bi) > 3) return null;
	}

	a.schedule[bi] = rb;
	b.schedule[bi] = ra;
	return next;
}

function mutateDayScheduleCrossSlot(people, subs, blocks, schedCtx) {
	if (!people.length || blocks.length < 2) return null;
	const sMap = buildSubMap(subs);
	const { sctCtx, noScouting, pitLeadIds } = schedCtx;
	const nBlk = blocks.length;
	const next = clonePeople(people);
	const pi = Math.floor(Math.random() * next.length);
	const p = next[pi];
	const bi = Math.floor(Math.random() * nBlk);
	let bj = Math.floor(Math.random() * nBlk);
	if (bj === bi) bj = (bi + 1) % nBlk;
	const ri = (p.schedule || [])[bi] || 'Open';
	const rj = (p.schedule || [])[bj] || 'Open';
	if (ri === rj) return null;
	const sub = sMap.get(p.email);
	if (!isEligible(sub, rj, bi, blocks[bi], sctCtx, noScouting, pitLeadIds, nBlk)) return null;
	if (!isEligible(sub, ri, bj, blocks[bj], sctCtx, noScouting, pitLeadIds, nBlk)) return null;

	if (labelIsFinalsPitCap(blocks[bi]) || labelIsFinalsPitCap(blocks[bj])) {
		const sim = next.map((q) => ({ ...q, schedule: [...(q.schedule || [])] }));
		sim[pi].schedule[bi] = rj;
		sim[pi].schedule[bj] = ri;
		if (labelIsFinalsPitCap(blocks[bi]) && countPitCrew(sim, bi) > 3) return null;
		if (labelIsFinalsPitCap(blocks[bj]) && countPitCrew(sim, bj) > 3) return null;
	}

	p.schedule[bi] = rj;
	p.schedule[bj] = ri;
	return next;
}

function optimizeDaySchedule(initialPeople, subs, blocks, req, schedCtx, iterCount) {
	let cur = clonePeople(initialPeople);
	let best = clonePeople(initialPeople);
	let curScore = scoreDay(cur, subs, blocks, req, schedCtx);
	let bestScore = curScore;

	let temp = 10.0;
	const nIter = Math.max(100, iterCount || 200);

	for (let i = 0; i < nIter; i++) {
		const cand =
			Math.random() < 0.42
				? mutateDayScheduleCrossSlot(cur, subs, blocks, schedCtx)
				: mutateDaySchedule(cur, subs, blocks, schedCtx);
		if (!cand) continue;

		const candScore = scoreDay(cand, subs, blocks, req, schedCtx);
		const delta = candScore - curScore;

		if (delta > 0 || Math.random() < Math.exp(delta / Math.max(0.001, temp))) {
			cur = cand;
			curScore = candScore;
			if (candScore > bestScore) {
				best = cand;
				bestScore = candScore;
			}
		}

		temp *= 0.996;
	}

	return best;
}

async function bldSch(CF) {
	valCfg(CF);

	const { csvPath, columnMap, optimizationIterations = 1, daySchedule } = CF;

	const plIds = CF.pitLeadIds;
	const noSct = CF.noScouting;
	const noStrat = CF.noStrategy || [];
	const skPpl = CF.skipPeople || [];

	const nDays = daySchedule.length;

	const dayFilt = [(s) => s.friday === true, (s) => s.saturday === true];

	const dayLbl = daySchedule.map((d) => d.label);

	const showIx = CF.showOnlyDay != null ? CF.showOnlyDay : 0;

	let subs = [];
	if (Array.isArray(CF.subs) && CF.subs.length > 0) {
		subs = CF.subs.slice();
	} else {
		try {
			const csv = await fs.readFile(csvPath, 'utf8');
			subs = parseSubs(parseCSV(csv), columnMap, {
				noScouting: noSct,
				driveTeamExtra: CF.driveTeamExtra || []
			});
			subs = subs.filter((s) => !idHit(skPpl, s.email, s.name));
		} catch (e) {
			console.warn('no csv', csvPath, e.message);
		}
	}

	const nSeeds = Math.max(
		2,
		Math.min(10, Math.floor((Number(optimizationIterations) || 1) / 150) + 2)
	);

	const days = [];
	// console.log(nDays);
	for (let di = 0; di < nDays; di++) {
		const filt = dayFilt[di];
		const baseSubs = filt ? subs.filter(filt) : subs;
		// console.log(baseSubs);

		const dc = daySchedule[di];
		const { labels: matchLabels, windows: matchWindows } = genMatchBlocksFromDay(dc);
		let blocks = matchLabels;
		let blockWindows = matchWindows;
		if (Array.isArray(dc.blockLabels) && dc.blockLabels.length === blocks.length) {
			blocks = dc.blockLabels.map((x) => String(x));
		}
		if (Array.isArray(dc.blockWindows) && dc.blockWindows.length === blocks.length) {
			blockWindows = dc.blockWindows.map((x) => String(x));
		}

		let slotMins = slotMinutesFromWindows(blockWindows, blocks.length);
		if (Array.isArray(dc.slotMinutes) && dc.slotMinutes.length === blocks.length) {
			slotMins = dc.slotMinutes.map((x) => Math.max(1, Number(x) || 1));
		}

		const req = ldReq(CF, blocks.length);

		const sctCtxBase = dayScoutCtx(dc, blockWindows, CF);
		const sctCtx = { ...sctCtxBase, blockLabels: blocks, nBlk: blocks.length };
		// tiaraMask + patchReq here eventually

		patchReqWhereScoutClosed(req, sctCtx, blocks.length);

		const sx = {
			sctCtx,
			pitLeadIds: plIds,
			noStrategy: noStrat,
			noScouting: noSct,
			slotMins
		};
		// console.log(sx);

		let bestPpl = null;
		let bestScr = -Infinity;

		for (let si = 0; si < nSeeds; si++) {
			const subsTry = shuf(baseSubs);

			let ppl = buildValidInitialSchedule(subsTry, blocks, req, sx);
			ppl = optimizeDaySchedule(ppl, subsTry, blocks, req, sx, optimizationIterations);

			const sc = scoreDay(ppl, subsTry, blocks, req, sx);
			if (sc > bestScr) {
				bestScr = sc;
				bestPpl = ppl;
			}
		}

		const drvEm = new Set((baseSubs || []).filter((s) => s.driveTeam).map((s) => s.email));
		const bot = (p) => pitLd(p, plIds) || drvEm.has(p.email);

		const sorted = [...(bestPpl || [])].sort((a, b) => {
			const ab = bot(a) ? 1 : 0;
			const bb = bot(b) ? 1 : 0;
			if (ab !== bb) return ab - bb;
			return (a.name || '').localeCompare(b.name || '');
		});

		const scoutChk = sorted.map((p) => {
			const s = baseSubs.find((x) => x.email === p.email);
			const shouldScout = !s || !s.cannotScout;
			const scoutingBlocks = (p.schedule || []).filter((x) => x === SCT).length;
			let st = 'ok';
			if (!shouldScout) st = 'exempt';
			else if (scoutingBlocks === 0) st = 'none';
			else if (scoutingBlocks < 2) st = 'low';
			return { name: p.name, scoutingBlocks, shouldScout, status: st };
		});

		days.push({
			day: di + 1,
			label: dayLbl[di] || `Day ${di + 1}`,
			timeBlocks: blocks,
			blockWindows,
			people: sorted,
			scoutCheck: scoutChk
		});
	}

	return { days, scheduleMode: 'matches' };
}

function daysWithRoleEnums(days) {
	const sctN = STR_TO_ROLE_ENUM[SCT];
	return (days || []).map((day) => {
		const people = (day.people || []).map((p) => ({
			...p,
			schedule: (p.schedule || []).map((r) =>
				STR_TO_ROLE_ENUM[r] !== undefined ? STR_TO_ROLE_ENUM[r] : ROLE_ENUM.Open
			)
		}));
		const scoutChk = people.map((p, idx) => {
			const prev = (day.scoutCheck || [])[idx] || {};
			const scoutingBlocks = (p.schedule || []).filter((x) => x === sctN).length;
			let st = 'ok';
			if (!prev.shouldScout) st = 'exempt';
			else if (scoutingBlocks === 0) st = 'none';
			else if (scoutingBlocks < 2) st = 'low';
			return {
				name: p.name,
				scoutingBlocks,
				shouldScout: prev.shouldScout !== false,
				status: st
			};
		});
		return { ...day, people, scoutCheck: scoutChk };
	});
}

async function makeSchedule(CF) {
	const out = await bldSch(CF);
	const builtAt = new Date().toISOString();
	if (CF.exportRoleEnums) {
		return {
			...out,
			days: daysWithRoleEnums(out.days),
			builtAt,
			roleEncoding: 'Role'
		};
	}
	return { ...out, builtAt };
}

function coerceScheduleRole(val) {
	if (val === undefined) return null;
	if (val === null || val === '') return null;
	if (typeof val === 'number' && Number.isFinite(val)) {
		for (const [name, num] of Object.entries(STR_TO_ROLE_ENUM)) {
			if (num === val) return name;
		}
		return 'Open';
	}
	return String(val);
}

function addPersonToDaySchedule(day, person) {
	const people = day && day.people ? day.people.slice() : [];
	const nBlk =
		(day && day.timeBlocks && day.timeBlocks.length) ||
		(people[0] && people[0].schedule && people[0].schedule.length) ||
		0;
	const em = String((person && person.email) || '').toLowerCase();
	if (!em) return { ...day, people };

	const providedSchedule = person && person.schedule;
	const hasScheduleInput = Array.isArray(providedSchedule);
	const wantName = (person && (person.name || person.displayName) || '').trim();

	const idx = people.findIndex((p) => (p.email || '').toLowerCase() === em);

	if (idx < 0) {
		let sch;
		if (!hasScheduleInput || providedSchedule.length === 0) sch = new Array(nBlk).fill('Open');
		else {
			sch = [];
			for (let i = 0; i < nBlk; i++) {
				const raw = providedSchedule[i];
				const c = raw !== undefined && raw !== null && raw !== '' ? coerceScheduleRole(raw) : null;
				sch.push(c != null ? c : 'Open');
			}
		}
		while (sch.length < nBlk) sch.push('Open');
		if (sch.length > nBlk) sch = sch.slice(0, nBlk);
		const row = {
			name: shortName((person && person.name) || (person && person.displayName) || em),
			email: em,
			schedule: sch
		};
		return { ...day, people: [...people, row] };
	}

	const prev = people[idx];
	const prevSch = [...(prev.schedule || [])];
	const nextSch = [];
	for (let i = 0; i < nBlk; i++) {
		let raw = hasScheduleInput && i < providedSchedule.length ? providedSchedule[i] : undefined;
		let cell;
		if (raw !== undefined && raw !== null && raw !== '') {
			const c = coerceScheduleRole(raw);
			cell = c != null ? c : prevSch[i];
		} else {
			cell = i < prevSch.length ? prevSch[i] : 'Open';
		}
		nextSch.push(cell != null && cell !== '' ? cell : 'Open');
	}

	const nextRow = {
		...prev,
		name: wantName ? shortName(person.name || person.displayName) : prev.name,
		email: em,
		schedule: nextSch
	};
	const out = people.slice();
	out[idx] = nextRow;
	return { ...day, people: out };
}

function removePersonFromDaySchedule(day, email) {
	const em = String(email || '').toLowerCase();
	const people = (day && day.people ? day.people : []).filter((p) => (p.email || '').toLowerCase() !== em);
	return { ...day, people };
}

export {
	makeSchedule,
	ROLE_ENUM,
	STR_TO_ROLE_ENUM,
	addPersonToDaySchedule,
	removePersonFromDaySchedule
};
