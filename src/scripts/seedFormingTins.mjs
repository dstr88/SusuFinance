// seedFormingTins.mjs — two tins still being assembled, so the cards have somewhere to go.
//
//   npm run seed:forming                 → the demo programme
//   npm run seed:forming -- <tenant-id>  → a real one
//
// Run seed:beta first: this reuses those 26 women rather than inventing more. They
// are people in `members` (tenant-level); `contract_members` is only the join, so
// the same woman can stand in a live tin and a forming tin at once without either
// knowing about the other.
//
// ── Why these tins are `forming` ────────────────────────────────────────────
//
// `forming` is the schema's default and means "before round 1". It is the only
// state a card may be dragged in or out of: once round 1 opens, women have paid,
// and a rotation you can rearrange underneath a paid round is a rotation nobody can
// trust. So the drag surface needs tins in this state to act on, and the demo had
// none — both existing circles are live and mid-rotation.
//
// No rounds, no contributions, no turn dates. A forming tin is a list of names and
// an agreed order, and nothing else exists yet. That is the point: there is nothing
// to strand.
//
// ── The two tins are deliberately lopsided ─────────────────────────────────
//
// One nearly full, one nearly empty. A drag demo where both tins are balanced shows
// nothing; the interesting cases are the last slot and the empty tin.

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

const DAY = 24 * 60 * 60 * 1000;
const anchor = new Date();
anchor.setUTCHours(0, 0, 0, 0);
const iso = (days) => new Date(anchor.getTime() + days * DAY + 12 * 3600_000).toISOString();

// Two tins the operator is putting together right now.
const TINS = [
	{
		id: 'beta-forming-kejetia',
		name: 'Kejetia Cloth Sellers',
		amount: '75',
		cadence: 'weekly',
		// Nine of the 26, in the order the group agreed. Turn order is the group's
		// decision — the seed records one, it does not compute one.
		members: [0, 2, 4, 6, 8, 10, 12, 14, 16], // Antwanette, Candice, Esperanza, …
	},
	{
		id: 'beta-forming-tema',
		name: 'Tema Station Traders',
		amount: '30',
		cadence: 'monthly',
		// Three so far. He is still gathering — this is the tin with room.
		members: [1, 3, 5],                        // Beatrize, Delphine, Fatima
	},
];

const memberId = (i) => `beta-mem-${String(i + 1).padStart(2, '0')}`;

async function main() {
	await client.connect();
	console.log(`Seeding forming tins into tenant ${TENANT_ID}…`);

	const t = await client.query('SELECT name FROM tenants WHERE id = $1', [TENANT_ID]);
	if (!t.rows.length) {
		console.error(`  No such tenant: ${TENANT_ID}`);
		process.exit(1);
	}

	// The 26 must already exist — this script does not invent people. If seed:beta
	// has not run, say so rather than seeding two empty tins and calling it done.
	const have = await client.query(
		`SELECT count(*)::int AS n FROM members WHERE tenant_id = $1 AND id LIKE 'beta-mem-%'`,
		[TENANT_ID],
	);
	if (have.rows[0].n < 26) {
		console.error(`  Found ${have.rows[0].n} of 26 beta members. Run: npm run seed:beta`);
		process.exit(1);
	}

	for (const tin of TINS) {
		await client.query(`DELETE FROM contract_members WHERE tenant_id=$1 AND contract_id=$2`, [TENANT_ID, tin.id]);
		await client.query(`DELETE FROM contract_events  WHERE tenant_id=$1 AND contract_id=$2`, [TENANT_ID, tin.id]);
		await client.query(`DELETE FROM contracts        WHERE tenant_id=$1 AND id=$2`, [TENANT_ID, tin.id]);

		await client.query(
			`INSERT INTO contracts (id, tenant_id, type, name, currency, chain, expected_amount, cadence,
			                        grace_days, reminder_lead_days, status, created_at, updated_at)
			 VALUES ($1,$2,'circle',$3,'USDC',NULL,$4,$5,3,2,'forming',$6,$6)`,
			[tin.id, TENANT_ID, tin.name, tin.amount, tin.cadence, iso(-9)],
		);

		// turn_order is 1..n in the order listed. contract_members_active_turn_uniq
		// refuses two women on the same slot, which is what makes a drop have to land
		// somewhere real rather than silently double up.
		let turn = 0;
		for (const idx of tin.members) {
			turn += 1;
			await client.query(
				`INSERT INTO contract_members (tenant_id, contract_id, member_id, turn_order, joined_at, left_at)
				 VALUES ($1,$2,$3,$4,$5,NULL)`,
				[TENANT_ID, tin.id, memberId(idx), turn, iso(-9)],
			);
		}

		await client.query(
			`INSERT INTO contract_events (tenant_id, contract_id, actor, action, detail, at)
			 VALUES ($1,$2,'organizer','contract_created',$3,$4)`,
			[TENANT_ID, tin.id, JSON.stringify({ name: tin.name, members: tin.members.length }), iso(-9)],
		);

		console.log(`  ${tin.name.padEnd(24)} forming · ${String(tin.members.length).padStart(2)} members · ${tin.amount} USDC ${tin.cadence}`);
	}

	console.log('Done. Both tins are `forming` — cards can be dragged in and out until round 1 opens.');
}

try {
	await main();
} catch (e) {
	console.error('[seed:forming] FAILED:', e.message);
	process.exitCode = 1;
} finally {
	await client.end();
}
