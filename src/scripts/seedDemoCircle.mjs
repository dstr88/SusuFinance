// seedDemoCircle.mjs — the demo program: one 10-member circle mid-rotation, one
// target group. Re-run safe (deletes the demo tenant first; FKs cascade).
//
//   DATABASE_URL=<susufinancedata url> node src/scripts/seedDemoCircle.mjs
//
// This dataset is deliberately messy. Every operator stat needs something real to
// show, so the mix is the point: contributions early / on-time / late-within-grace /
// behind, one member departed before her turn with a replacement inheriting the
// slot, one early withdrawal, and payout addresses in mixed Verify states.
//
// It is also the demo the operator sees. Seeded contributions stand in for observed
// ones until the watcher exists; because every stat is derived, the dashboard cannot
// tell the difference — the watcher just starts writing rows this shape.
//
// Dates are anchored to today so the circle is always "mid-rotation": round 6 of 10
// falls due in 2 days, which also puts the T-2 reminder window on today.

import pg from 'pg';

// Matches DEMO_TENANT_ID in src/lib/demo.ts — the demo cookie renders this tenant.
const DEMO_TENANT_ID = 'demo-00000000000000000000000000000001';

const url =
	process.env.DATABASE_URL ??
	process.env.External_DATABASE_URL ??
	process.env.Internal_DATABASE_URL;

if (!url) {
	console.error('Missing DATABASE_URL (or External_DATABASE_URL / Internal_DATABASE_URL).');
	process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])/.test(url);
const client = new pg.Client({
	connectionString: url,
	ssl: isLocal ? false : { rejectUnauthorized: false },
});

// ── date helpers ─────────────────────────────────────────────────────────────
// Midnight UTC today is the anchor. Round 6 is due +2d; rounds run weekly backwards
// from there, so rounds 1-5 are past, 6 is open, 7-10 are scheduled.
const DAY = 24 * 60 * 60 * 1000;
const anchor = new Date();
anchor.setUTCHours(0, 0, 0, 0);

const at = (days, hours = 12) => new Date(anchor.getTime() + days * DAY + hours * 3600_000);
const iso = (d) => d.toISOString();
const day = (d) => d.toISOString().slice(0, 10);

const CURRENT_ROUND = 6;
const TOTAL_ROUNDS = 10;
const WEEKLY = 7;
// Round N due date, in days from the anchor. Round 6 → +2.
const roundDueOffset = (n) => (n - CURRENT_ROUND) * WEEKLY + 2;

// Fake-but-shaped EVM addresses. Chain is undecided (post-call), so these are
// placeholders with the right shape, not real addresses on any network.
const addr = (seed) => '0x' + seed.toString(16).padStart(40, '0');
const txh = (seed) => '0x' + seed.toString(16).padStart(64, '0');

// ── the cast ─────────────────────────────────────────────────────────────────
// Display names are handles the members chose. No legal names anywhere — that is
// the product, not an oversight. m10 is UUID-only (no display name, no email): the
// maximally private configuration, which must get full service everywhere.
const MEMBERS = [
	{ id: 'demo-mem-01', name: 'ama.k',      email: 'ama.k@example.test',   verified: true  },
	{ id: 'demo-mem-02', name: 'akosua',     email: 'akosua@example.test',  verified: true  },
	{ id: 'demo-mem-03', name: 'yaa.m',      email: null,                   verified: true  },
	{ id: 'demo-mem-04', name: 'abena',      email: 'abena@example.test',   verified: true  },
	{ id: 'demo-mem-05', name: 'efua',       email: 'efua@example.test',    verified: true  },
	{ id: 'demo-mem-06', name: 'adwoa',      email: null,                   verified: true  },
	{ id: 'demo-mem-07', name: 'kwabena',    email: 'kwabena@example.test', verified: false }, // pending verification
	{ id: 'demo-mem-08', name: 'esi',        email: 'esi@example.test',     verified: true  },
	{ id: 'demo-mem-09', name: 'nana.a',     email: null,                   verified: true  },
	{ id: 'demo-mem-10', name: null,         email: null,                   verified: true  }, // UUID-only
	{ id: 'demo-mem-11', name: 'mansa',      email: 'mansa@example.test',   verified: false }, // departed, before her turn
];

const CIRCLE_ID = 'demo-contract-makola';
const TARGET_ID = 'demo-contract-school-fees';

// Turn order: the departed member (m11) held slot 7 and left before receiving.
// Her replacement (m10) inherited the slot — a new row, never an overwrite.
const TURNS = {
	'demo-mem-01': 1,
	'demo-mem-02': 2,
	'demo-mem-03': 3,
	'demo-mem-04': 4,
	'demo-mem-05': 5,
	'demo-mem-06': 6,
	'demo-mem-08': 8,
	'demo-mem-09': 9,
	'demo-mem-07': 10,
};
const DEPARTED = 'demo-mem-11';   // held turn 7, left after round 5
const REPLACEMENT = 'demo-mem-10'; // inherits turn 7, joined at round 6
const LEFT_AT_ROUND = 5;

// Who receives which round.
const recipientOf = (n) => {
	if (n === 7) return REPLACEMENT; // the inherited slot
	const found = Object.entries(TURNS).find(([, t]) => t === n);
	return found ? found[0] : null;
};

// Is this member an active contributor during round n?
const activeInRound = (memberId, n) => {
	if (memberId === DEPARTED) return n <= LEFT_AT_ROUND;
	if (memberId === REPLACEMENT) return n >= CURRENT_ROUND;
	return true;
};

// ── the discipline mix ───────────────────────────────────────────────────────
// Offset in days from the round's due date at which she was observed paying.
// negative = early · 0 = on the day · positive but <= grace_days(3) = late within
// grace · null = never observed (behind, once past grace).
//
// m07 is behind in round 5 — past grace, unpaid. That is what puts a real arrears
// case in front of the forgiveness rule when her turn (round 10) comes up.
const PAY_OFFSET = {
	'demo-mem-01': [-3, -2, -3, -2, -3, -2],
	'demo-mem-02': [0, 0, -1, 0, 0, 0],
	'demo-mem-03': [-1, 0, 0, -1, 0, null],   // round 6 not yet paid (not due for 2 days)
	'demo-mem-04': [2, 1, 0, 2, 1, null],     // habitually late, always within grace
	'demo-mem-05': [-2, -2, -2, -2, -2, -2],
	'demo-mem-06': [0, -1, 0, 0, 3, null],
	'demo-mem-07': [0, 0, 1, 0, null, null],  // round 5: behind
	'demo-mem-08': [-1, -1, 0, 0, -1, -1],
	'demo-mem-09': [0, 1, 0, 0, 0, null],
	'demo-mem-10': [null, null, null, null, null, -1], // joined at round 6, paid early
	'demo-mem-11': [0, 0, 0, -1, 0, null],    // departed after round 5
};

// The interpreted status of a contribution, given when (or whether) it was observed.
// Mirrors what the watcher will write; the finer early/on-time/late/behind reading
// is derived at query time, never stored.
const statusFor = (offset, dueOffsetDays, graceDays) => {
	if (offset === null) {
		// Unpaid. Only "late" once the grace window has actually closed; before that
		// it is simply pending — she is not late until the group's rule says so.
		const pastGrace = dueOffsetDays + graceDays < 0;
		return pastGrace ? 'late' : 'pending';
	}
	return 'paid';
};

async function main() {
	await client.connect();
	console.log('Seeding demo program…');

	// ── 0. clear ─────────────────────────────────────────────────────────────
	// Everything FKs to tenants with ON DELETE CASCADE, so one delete is the reset.
	await client.query('DELETE FROM tenants WHERE id = $1', [DEMO_TENANT_ID]);

	// ── 1. tenant ────────────────────────────────────────────────────────────
	await client.query(
		`INSERT INTO tenants (id, name, settings, created_at) VALUES ($1, $2, $3, $4)`,
		[
			DEMO_TENANT_ID,
			'Makola Market Programme',
			JSON.stringify({ demo: true, locale_default: 'en' }),
			iso(at(-120)),
		],
	);

	// ── 2. members ───────────────────────────────────────────────────────────
	let seed = 0x1000;
	for (const m of MEMBERS) {
		seed += 1;
		await client.query(
			`INSERT INTO members
			   (id, tenant_id, display_name, email, wallet_address, payout_address,
			    address_verified_at, locale, notify_pref, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
			[
				m.id,
				DEMO_TENANT_ID,
				m.name,
				m.email,
				addr(seed),
				addr(seed + 0x900),
				m.verified ? iso(at(-60)) : null,
				m.name === 'yaa.m' ? 'fr' : 'en', // FR is first-class, not an afterthought
				JSON.stringify({
					reminders: true,
					due_day_nudge: false,
					// Discreet mode strips the emoji grammar and softens the wording —
					// her inbox may not be only hers.
					discreet: m.id === 'demo-mem-04',
					email_opt_in: Boolean(m.email),
				}),
				iso(at(-90)),
			],
		);
	}

	// ── 3. contracts ─────────────────────────────────────────────────────────
	// 10 members × 25 USDC weekly = a 10-week cycle. The pot is derived, never stored.
	await client.query(
		`INSERT INTO contracts
		   (id, tenant_id, type, name, currency, chain, expected_amount, cadence,
		    grace_days, reminder_lead_days, status, created_at, updated_at)
		 VALUES ($1,$2,'circle',$3,'USDC',NULL,$4,'weekly',3,2,'active',$5,$5)`,
		[CIRCLE_ID, DEMO_TENANT_ID, 'Makola Traders', '25', iso(at(-7 * (CURRENT_ROUND - 1) - 5))],
	);

	await client.query(
		`INSERT INTO contracts
		   (id, tenant_id, type, name, currency, chain, expected_amount, cadence,
		    target_amount, target_date, grace_days, reminder_lead_days, status, created_at, updated_at)
		 VALUES ($1,$2,'target_group',$3,'USDC',NULL,$4,'monthly',$5,$6,5,2,'active',$7,$7)`,
		[
			TARGET_ID,
			DEMO_TENANT_ID,
			'School fees — January term',
			'40',
			'480',
			day(at(150)),
			iso(at(-100)),
		],
	);

	// ── 4. circle membership ─────────────────────────────────────────────────
	for (const [memberId, turn] of Object.entries(TURNS)) {
		const joined = memberId === REPLACEMENT ? at(roundDueOffset(CURRENT_ROUND) - 7) : at(-7 * CURRENT_ROUND - 3);
		await client.query(
			`INSERT INTO contract_members (tenant_id, contract_id, member_id, turn_order, joined_at)
			 VALUES ($1,$2,$3,$4,$5)`,
			[DEMO_TENANT_ID, CIRCLE_ID, memberId, turn, iso(joined)],
		);
	}
	// The replacement holds slot 7 now…
	await client.query(
		`INSERT INTO contract_members (tenant_id, contract_id, member_id, turn_order, joined_at)
		 VALUES ($1,$2,$3,7,$4)`,
		[DEMO_TENANT_ID, CIRCLE_ID, REPLACEMENT, iso(at(roundDueOffset(CURRENT_ROUND) - 7))],
	);
	// …and the row for the member who left keeps her turn_order forever. The partial
	// unique index allows both because only one of them has left_at IS NULL.
	await client.query(
		`INSERT INTO contract_members (tenant_id, contract_id, member_id, turn_order, joined_at, left_at)
		 VALUES ($1,$2,$3,7,$4,$5)`,
		[
			DEMO_TENANT_ID,
			CIRCLE_ID,
			DEPARTED,
			iso(at(-7 * CURRENT_ROUND - 3)),
			iso(at(roundDueOffset(LEFT_AT_ROUND) + 1)),
		],
	);

	// ── 5. target-group membership ───────────────────────────────────────────
	// No turn_order: nobody waits a turn to reach her own money.
	const TARGET_MEMBERS = ['demo-mem-02', 'demo-mem-04', 'demo-mem-06', 'demo-mem-08', 'demo-mem-09'];
	for (const memberId of TARGET_MEMBERS) {
		await client.query(
			`INSERT INTO contract_members (tenant_id, contract_id, member_id, turn_order, joined_at)
			 VALUES ($1,$2,$3,NULL,$4)`,
			[DEMO_TENANT_ID, TARGET_ID, memberId, iso(at(-95))],
		);
	}

	// ── 6. rounds ────────────────────────────────────────────────────────────
	for (let n = 1; n <= TOTAL_ROUNDS; n++) {
		const dueOffset = roundDueOffset(n);
		const recipient = recipientOf(n);
		const status = n < CURRENT_ROUND ? 'completed' : n === CURRENT_ROUND ? 'open' : 'scheduled';

		// The snapshot freezes at open. Future rounds have no snapshot yet — there is
		// nothing to freeze until the round opens, and pretending otherwise would be
		// the swap risk the freeze exists to close.
		const frozen = n <= CURRENT_ROUND && recipient ? addr(0x1000 + MEMBERS.findIndex((m) => m.id === recipient) + 1 + 0x900) : null;

		await client.query(
			`INSERT INTO rounds
			   (id, tenant_id, contract_id, round_index, recipient_member_id,
			    payout_address_snapshot, due_date, status, payout_tx_hash, payout_observed_at, created_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			[
				`demo-round-${String(n).padStart(2, '0')}`,
				DEMO_TENANT_ID,
				CIRCLE_ID,
				n,
				recipient,
				frozen,
				day(at(dueOffset)),
				status,
				n < CURRENT_ROUND ? txh(0xda1d0000 + n) : null,
				n < CURRENT_ROUND ? iso(at(dueOffset, 18)) : null,
				iso(at(-7 * CURRENT_ROUND - 3)),
			],
		);
	}

	// ── 7. circle contributions ──────────────────────────────────────────────
	// The recipient does not pay herself: nine wallets pay the tenth, so nine
	// contributions exist per round. Her own 25 nets against the pot she receives.
	// (See the note in the summary — §5a words this as "pot of 250", §5c as "nine
	// wallets paying the tenth"; the chain only ever sees the nine.)
	let txSeed = 0x5000;
	let contributionCount = 0;
	for (let n = 1; n <= CURRENT_ROUND; n++) {
		const dueOffset = roundDueOffset(n);
		const recipient = recipientOf(n);

		for (const m of MEMBERS) {
			if (m.id === recipient) continue;          // netted, never sent
			if (!activeInRound(m.id, n)) continue;     // not in the circle this round

			const offset = PAY_OFFSET[m.id]?.[n - 1] ?? null;
			const status = statusFor(offset, dueOffset, 3);
			const paid = offset !== null;
			txSeed += 1;

			await client.query(
				`INSERT INTO contributions
				   (tenant_id, contract_id, round_id, period, member_id, expected_amount,
				    due_date, observed_tx_hash, observed_amount, observed_at, status, created_at, updated_at)
				 VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
				[
					DEMO_TENANT_ID,
					CIRCLE_ID,
					`demo-round-${String(n).padStart(2, '0')}`,
					m.id,
					'25',
					day(at(dueOffset)),
					paid ? txh(txSeed) : null,
					paid ? '25' : null,
					paid ? iso(at(dueOffset + offset, 9)) : null,
					status,
					iso(at(dueOffset - 7)),
				],
			);
			contributionCount += 1;
		}
	}

	// ── 8. target-group contributions ────────────────────────────────────────
	// Four monthly periods, 40 USDC each — three closed and the current one still
	// open, so the operator card has a live "this period" to show rather than a
	// dead one. m04 withdrew early in one of them: her right, exercised. Nothing
	// about that row is flagged, ranked, or penalised.
	const PERIODS = [-3, -2, -1, 0].map((k) => ({
		period: new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + k, 1)),
		offsetMonths: k,
	}));
	// Paid already in the current, still-open period. The rest are simply not due
	// yet — pending, which is not a verdict about anyone.
	const PAID_THIS_PERIOD = ['demo-mem-02', 'demo-mem-06', 'demo-mem-08'];

	for (const { period, offsetMonths } of PERIODS) {
		const periodKey = period.toISOString().slice(0, 7);
		const dueOffset = offsetMonths * 30 + 5;

		for (const memberId of TARGET_MEMBERS) {
			let offset;
			if (offsetMonths === 0) {
				// Due in 5 days. Payers sent 2 days ago (offset −7 from a +5 due date),
				// so nothing is observed in the future.
				offset = PAID_THIS_PERIOD.includes(memberId) ? -7 : null;
			} else {
				// m09 skipped the most recent closed month; everyone else paid.
				const skipped = memberId === 'demo-mem-09' && offsetMonths === -1;
				offset = skipped ? null : memberId === 'demo-mem-04' ? 1 : -1;
			}
			txSeed += 1;

			await client.query(
				`INSERT INTO contributions
				   (tenant_id, contract_id, round_id, period, member_id, expected_amount,
				    due_date, observed_tx_hash, observed_amount, observed_at, status, created_at, updated_at)
				 VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
				[
					DEMO_TENANT_ID,
					TARGET_ID,
					periodKey,
					memberId,
					'40',
					day(at(dueOffset)),
					// offset === null is the one meaning of "no transfer observed",
					// whether she skipped a closed month or simply isn't due yet.
					offset === null ? null : txh(txSeed),
					offset === null ? null : '40',
					offset === null ? null : iso(at(dueOffset + offset, 10)),
					statusFor(offset, dueOffset, 5),
					iso(at(dueOffset - 30)),
				],
			);
			contributionCount += 1;
		}
	}

	// ── 9. events ────────────────────────────────────────────────────────────
	// The accountability log. Members read this too — it is how they check the
	// organizer, not only how he checks the program.
	//
	// The early withdrawal is recorded as a neutral fact: member, group, amount,
	// date. It is not a flag, it does not feed a score, and there is no wall of
	// "problem members" for it to appear on. 30% early withdrawal would be program
	// intelligence (emergencies, or a product mismatch) — something to learn from,
	// never to sanction.
	const EVENTS = [
		[CIRCLE_ID, 'organizer', 'contract_created',
			{ name: 'Makola Traders', members: 10, amount: '25', cadence: 'weekly' }, at(-7 * CURRENT_ROUND - 3)],
		[CIRCLE_ID, 'organizer', 'turn_order_recorded',
			{ source: 'group agreement' }, at(-7 * CURRENT_ROUND - 3)],
		[CIRCLE_ID, 'system', 'round_opened', { round: 1 }, at(roundDueOffset(1) - 7)],
		[CIRCLE_ID, 'system', 'payout_observed',
			{ round: 1, recipient: 'demo-mem-01', amount: '225' }, at(roundDueOffset(1), 18)],
		[CIRCLE_ID, 'system', 'payout_observed',
			{ round: 5, recipient: 'demo-mem-05', amount: '225' }, at(roundDueOffset(5), 18)],
		[CIRCLE_ID, DEPARTED, 'member_departed',
			{ member_id: DEPARTED, before_receiving: true, contributions_made: '125', pot_received: '0' },
			at(roundDueOffset(LEFT_AT_ROUND) + 1)],
		[CIRCLE_ID, 'organizer', 'member_replaced',
			{ left: DEPARTED, joined: REPLACEMENT, turn_order: 7 }, at(roundDueOffset(LEFT_AT_ROUND) + 2)],
		[CIRCLE_ID, 'system', 'round_opened', { round: CURRENT_ROUND }, at(roundDueOffset(CURRENT_ROUND) - 7)],
		[TARGET_ID, 'organizer', 'contract_created',
			{ name: 'School fees — January term', target: '480' }, at(-100)],
		[TARGET_ID, 'demo-mem-04', 'early_withdrawal',
			{ member_id: 'demo-mem-04', amount: '40', reason_given: null }, at(-40)],
	];

	for (const [contractId, actor, action, detail, when] of EVENTS) {
		await client.query(
			`INSERT INTO contract_events (tenant_id, contract_id, actor, action, detail, at)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			[DEMO_TENANT_ID, contractId, actor, action, JSON.stringify(detail), iso(when)],
		);
	}

	console.log(`  tenant        1`);
	console.log(`  members       ${MEMBERS.length} (1 UUID-only, 2 pending Verify, 1 departed)`);
	console.log(`  contracts     2 (circle round ${CURRENT_ROUND}/${TOTAL_ROUNDS}, one target group)`);
	console.log(`  rounds        ${TOTAL_ROUNDS}`);
	console.log(`  contributions ${contributionCount}`);
	console.log(`  events        ${EVENTS.length}`);
	console.log('Done.');
}

try {
	await main();
} catch (e) {
	console.error('[seed] FAILED:', e.message);
	process.exitCode = 1;
} finally {
	await client.end();
}
