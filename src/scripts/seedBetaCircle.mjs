// seedBetaCircle.mjs — 26 participants, A through Z, with a rotation behind them.
//
//   npm run seed:beta                 → seeds the demo programme
//   npm run seed:beta -- <tenant-id>  → seeds a real one (e.g. after you sign in)
//
// Re-run safe: deletes the Beta circle and its members first, then rebuilds. It
// touches nothing else in the programme — Makola Traders and the savings group are
// left alone.
//
// ── What "a scorecard with fake info" means here ─────────────────────────────
//
// A scorecard is not a stored thing. §4: "Schema cost: zero. Pure rendering —
// joined_at, contributions, completed cycles. The record we already keep, wearing
// its Sunday clothes." So seeding a scorecard means seeding the CONTRIBUTIONS the
// card is derived from, and the card falls out of them.
//
// Each of the 26 gets her own pattern, so the wall of cards shows a real spread
// rather than 26 identical rows: the diligent, the habitually-two-days-late, the
// one who went past grace and made it good, the one who is behind right now, the
// one who joined late, the one who left.
//
// ── The tenant ──────────────────────────────────────────────────────────────
//
// Defaults to the demo programme, which is what the demo cookie renders. A real
// Google login mints a DIFFERENT, empty programme — pass its id as an argument to
// put these 26 in front of a real admin session.

import pg from 'pg';

const DEMO_TENANT_ID = 'demo-00000000000000000000000000000001';
const TENANT_ID = process.argv[2] || DEMO_TENANT_ID;

const url =
	process.env.DATABASE_URL ??
	process.env.External_DATABASE_URL ??
	process.env.Internal_DATABASE_URL;
if (!url) {
	console.error('Missing DATABASE_URL.');
	process.exit(1);
}
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])/.test(url);
const client = new pg.Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });

// ── dates ───────────────────────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;
const anchor = new Date();
anchor.setUTCHours(0, 0, 0, 0);
const at = (days, hours = 12) => new Date(anchor.getTime() + days * DAY + hours * 3600_000);
const iso = (d) => d.toISOString();
const day = (d) => d.toISOString().slice(0, 10);

const CIRCLE_ID = 'beta-circle';
const MEMBER_COUNT = 26;
const CURRENT_ROUND = 14;          // mid-rotation: 13 closed, one open, 12 to come
const WEEKLY = 7;
const AMOUNT = '50';
const GRACE = 3;
// Round N is due this many days from today. Round 14 → +2, so the T-2 reminder
// window lands on today and nothing is late that shouldn't be.
const dueOffset = (n) => (n - CURRENT_ROUND) * WEEKLY + 2;

const addr = (seed) => '0x' + seed.toString(16).padStart(40, '0');
const txh  = (seed) => '0x' + seed.toString(16).padStart(64, '0');

// ── the cast: A through Z ───────────────────────────────────────────────────
// Names a market woman might actually choose as a handle, across the languages
// this product speaks. No legal names anywhere — that is the product, not an
// oversight.
const NAMES = [
	'Antwanette', 'Beatrize', 'Candice', 'Delphine', 'Esperanza', 'Fatima',
	'Gloria', 'Hannah', 'Imani', 'Josephine', 'Kadiatu', 'Lucia', 'Mariama',
	'Nadia', 'Olivia', 'Priscilla', 'Quiana', 'Rosalind', 'Sabina', 'Theresa',
	'Ursula', 'Valentina', 'Winifred', 'Ximena', 'Yvonne', 'Zainab',
];

// ── how each one pays ───────────────────────────────────────────────────────
// Offset in days from a round's due date. negative = early · 0 = on the day ·
// 1..3 = late but inside the grace the group agreed · >3 = past grace, made good
// (repaid) · null = no transfer seen.
//
// Deliberately varied so the card wall has a spread. The archetypes:
//   · most: early or on time, the ordinary case
//   · Delphine: habitually two days late, always within grace — poorer, not less
//     trustworthy, and the card must not imply otherwise
//   · Imani: went six days past grace once and made it good → one `repaid`
//   · Quiana: behind right now on round 11 — the only open debt
//   · Winifred: joined at round 9, so rounds 1–8 are absent, not missed
//   · Ximena: left after round 10
function payOffset(letterIdx, round) {
	const n = NAMES[letterIdx];
	// The open round is still open: about a third have not sent yet. It is due in two
	// days, so they read `pending` — which is not a verdict and must not look like
	// one. A demo where nobody is ever pending would never show the difference
	// between "has not paid yet" and "is behind", and that difference is the whole
	// reason `behind` waits for the grace to run out.
	if (round === CURRENT_ROUND && letterIdx % 3 === 1) return null;
	if (n === 'Delphine')  return round % 4 === 0 ? 0 : 2;            // late, in grace
	if (n === 'Imani')     return round === 5 ? 6 : (round % 3 ? 0 : -1); // one repaid
	if (n === 'Quiana')    return round === 11 ? null : (round % 2 ? 0 : -1); // behind
	if (n === 'Beatrize')  return round % 5 === 0 ? 1 : -2;            // early, occasionally a day late
	if (n === 'Theresa')   return round % 3 === 0 ? 3 : 0;             // brushes the grace edge
	if (n === 'Fatima')    return -3;                                  // always early
	return (letterIdx + round) % 7 === 0 ? 1 : (letterIdx % 3 === 0 ? -1 : 0);
}

const JOINED_LATE = 'Winifred';   // joins at round 9
const JOINED_LATE_ROUND = 9;
const LEFT = 'Ximena';            // leaves after round 10
const LEFT_AFTER_ROUND = 10;

const memberId = (i) => `beta-mem-${String(i + 1).padStart(2, '0')}`;
const displayName = (i) => `Beta_${NAMES[i]}`;

async function main() {
	await client.connect();
	console.log(`Seeding 26 participants into tenant ${TENANT_ID}…`);

	const t = await client.query('SELECT name FROM tenants WHERE id = $1', [TENANT_ID]);
	if (!t.rows.length) {
		console.error(`  No such tenant: ${TENANT_ID}`);
		console.error('  Pass a real tenant id, or omit the argument to seed the demo programme.');
		process.exit(1);
	}
	console.log(`  programme: ${t.rows[0].name}`);

	// ── clear just this circle ────────────────────────────────────────────────
	// Not the tenant: Makola Traders and the savings group are somebody else's
	// seed and must survive a re-run of this one.
	await client.query(`DELETE FROM contributions    WHERE tenant_id=$1 AND contract_id=$2`, [TENANT_ID, CIRCLE_ID]);
	await client.query(`DELETE FROM rounds           WHERE tenant_id=$1 AND contract_id=$2`, [TENANT_ID, CIRCLE_ID]);
	await client.query(`DELETE FROM contract_events  WHERE tenant_id=$1 AND contract_id=$2`, [TENANT_ID, CIRCLE_ID]);
	await client.query(`DELETE FROM contract_members WHERE tenant_id=$1 AND contract_id=$2`, [TENANT_ID, CIRCLE_ID]);
	await client.query(`DELETE FROM contracts        WHERE tenant_id=$1 AND id=$2`, [TENANT_ID, CIRCLE_ID]);
	await client.query(`DELETE FROM members WHERE tenant_id=$1 AND id LIKE 'beta-mem-%'`, [TENANT_ID]);

	// ── members ───────────────────────────────────────────────────────────────
	for (let i = 0; i < MEMBER_COUNT; i++) {
		const seed = 0xbe7a0 + i;
		await client.query(
			`INSERT INTO members (id, tenant_id, display_name, email, wallet_address, payout_address,
			                      address_verified_at, locale, notify_pref, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
			[
				memberId(i),
				TENANT_ID,
				displayName(i),
				`beta.${NAMES[i].toLowerCase()}@example.test`,
				addr(seed),
				addr(seed + 0x900),
				// Two unverified, so the safety figure is not a flat 100% and the
				// "round should not open unverified" alarm has something to catch.
				i === 16 || i === 23 ? null : iso(at(-120)),
				i % 5 === 0 ? 'fr' : i % 7 === 0 ? 'es' : 'en',
				JSON.stringify({ reminders: true, due_day_nudge: false, discreet: i % 9 === 0, email_opt_in: true }),
				iso(at(-7 * CURRENT_ROUND - 10)),
			],
		);
	}

	// ── the circle ────────────────────────────────────────────────────────────
	// 26 × 50 weekly. Above §5a's "gentle warning above ~25" on purpose — mutual
	// knowledge dilutes past ~20–25 faces, and this is what that looks like.
	await client.query(
		`INSERT INTO contracts (id, tenant_id, type, name, currency, chain, expected_amount, cadence,
		                        grace_days, reminder_lead_days, status, created_at, updated_at)
		 VALUES ($1,$2,'circle',$3,'USDC',NULL,$4,'weekly',$5,2,'active',$6,$6)`,
		[CIRCLE_ID, TENANT_ID, 'Beta Circle', AMOUNT, GRACE, iso(at(-7 * CURRENT_ROUND - 5))],
	);

	// ── memberships ───────────────────────────────────────────────────────────
	for (let i = 0; i < MEMBER_COUNT; i++) {
		const name = NAMES[i];
		const joined = name === JOINED_LATE ? at(dueOffset(JOINED_LATE_ROUND) - 3) : at(-7 * CURRENT_ROUND - 3);
		const left   = name === LEFT ? at(dueOffset(LEFT_AFTER_ROUND) + 1) : null;
		await client.query(
			`INSERT INTO contract_members (tenant_id, contract_id, member_id, turn_order, joined_at, left_at)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			[TENANT_ID, CIRCLE_ID, memberId(i), i + 1, iso(joined), left ? iso(left) : null],
		);
	}

	// ── rounds ────────────────────────────────────────────────────────────────
	for (let n = 1; n <= MEMBER_COUNT; n++) {
		const recipient = memberId(n - 1);
		const status = n < CURRENT_ROUND ? 'completed' : n === CURRENT_ROUND ? 'open' : 'scheduled';
		await client.query(
			`INSERT INTO rounds (id, tenant_id, contract_id, round_index, recipient_member_id,
			                     payout_address_snapshot, due_date, status, payout_tx_hash, payout_observed_at, created_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			[
				`beta-round-${String(n).padStart(2, '0')}`,
				TENANT_ID, CIRCLE_ID, n, recipient,
				// Frozen only once a round has opened — there is nothing to freeze before.
				n <= CURRENT_ROUND ? addr(0xbe7a0 + (n - 1) + 0x900) : null,
				day(at(dueOffset(n))),
				status,
				n < CURRENT_ROUND ? txh(0xbe70000 + n) : null,
				n < CURRENT_ROUND ? iso(at(dueOffset(n), 18)) : null,
				iso(at(-7 * CURRENT_ROUND - 3)),
			],
		);
	}

	// ── contributions ─────────────────────────────────────────────────────────
	// The recipient does not pay in her own round: 25 wallets pay the 26th, and
	// her own share nets against the pot. The chain only ever sees the 25.
	let tx = 0xc0000;
	let count = 0;
	for (let n = 1; n <= CURRENT_ROUND; n++) {
		const due = dueOffset(n);
		for (let i = 0; i < MEMBER_COUNT; i++) {
			const name = NAMES[i];
			if (i === n - 1) continue;                                       // her turn — netted
			if (name === JOINED_LATE && n < JOINED_LATE_ROUND) continue;     // not in the circle yet
			if (name === LEFT && n > LEFT_AFTER_ROUND) continue;             // gone

			const off = payOffset(i, n);
			const paid = off !== null;
			// Not yet due and unpaid → pending, which is not a verdict. Only past the
			// grace the group agreed is it anything at all.
			const pastGrace = due + GRACE < 0;
			const status = paid ? 'paid' : pastGrace ? 'late' : 'pending';
			tx += 1;

			await client.query(
				`INSERT INTO contributions (tenant_id, contract_id, round_id, period, member_id, expected_amount,
				                            due_date, observed_tx_hash, observed_amount, observed_at, status, created_at, updated_at)
				 VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
				[
					TENANT_ID, CIRCLE_ID, `beta-round-${String(n).padStart(2, '0')}`,
					memberId(i), AMOUNT, day(at(due)),
					paid ? txh(tx) : null,
					paid ? AMOUNT : null,
					// Never observe a payment in the future: an early payer on a round
					// that is not due yet paid at some point before now.
					paid ? iso(at(Math.min(due + off, -1), 9)) : null,
					status,
					iso(at(due - 7)),
				],
			);
			count += 1;
		}
	}

	// ── events ────────────────────────────────────────────────────────────────
	const EVENTS = [
		['organizer', 'contract_created', { name: 'Beta Circle', members: 26, amount: AMOUNT, cadence: 'weekly' }, at(-7 * CURRENT_ROUND - 5)],
		['organizer', 'turn_order_recorded', { source: 'group agreement' }, at(-7 * CURRENT_ROUND - 5)],
		['system', 'round_opened', { round: 1 }, at(dueOffset(1) - 7)],
		[memberId(NAMES.indexOf(JOINED_LATE)), 'member_admitted', { round: JOINED_LATE_ROUND }, at(dueOffset(JOINED_LATE_ROUND) - 3)],
		[memberId(NAMES.indexOf(LEFT)), 'member_departed', { before_receiving: false }, at(dueOffset(LEFT_AFTER_ROUND) + 1)],
		['system', 'round_opened', { round: CURRENT_ROUND }, at(dueOffset(CURRENT_ROUND) - 7)],
	];
	for (const [actor, action, detail, when] of EVENTS) {
		await client.query(
			`INSERT INTO contract_events (tenant_id, contract_id, actor, action, detail, at)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			[TENANT_ID, CIRCLE_ID, actor, action, JSON.stringify(detail), iso(when)],
		);
	}

	console.log(`  members       ${MEMBER_COUNT}  (Beta_${NAMES[0]} … Beta_${NAMES[25]})`);
	console.log(`  circle        Beta Circle — round ${CURRENT_ROUND} of ${MEMBER_COUNT}, ${AMOUNT} USDC weekly`);
	console.log(`  rounds        ${MEMBER_COUNT}`);
	console.log(`  contributions ${count}`);
	console.log(`  events        ${EVENTS.length}`);
	console.log('Done.');
}

try {
	await main();
} catch (e) {
	console.error('[seed:beta] FAILED:', e.message);
	process.exitCode = 1;
} finally {
	await client.end();
}
