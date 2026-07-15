// pgMigrate.mjs — the Postgres migration runner for SusuFinance.
//
//   DATABASE_URL=<susufinancedata url> npm run db:migrate          # apply pending
//   DATABASE_URL=<...> npm run db:migrate -- --dry-run             # show, apply nothing
//   DATABASE_URL=<...> npm run db:migrate -- --mark 0021_x.sql     # record as applied without running
//
// Replaces the Turso runner (src/scripts/dbMigrate.mjs), which points at
// TURSO_DATABASE_URL — a database that no longer exists. Postgres is the sole engine.
//
// ── Why this has a denylist ──────────────────────────────────────────────────
//
// migrations-pg/ is a carve-out folder: 0001–0020 are ALMSTINS' schema, inherited
// with the repo. Aave tax treatment, PetroTins receipts, import tables, price
// provenance — every one of them is a feature this product deliberately does not
// have. A runner that applied the folder in order would install the corpse of the
// old product into susufinancedata and blow the standing rule ("nothing pre-created;
// schema lands deliberately, table by table") in a single command.
//
// So the legacy set is named and held back explicitly. It is a CLOSED list — it
// describes history and will never gain a member — which is why this is a denylist
// and not an allowlist: a new SusuFinance migration needs no ceremony, it just runs.
// Nothing is skipped silently; every held file is printed with its reason.
//
// The Verify family (0002–0010) is held back but NOT dead: Verify is in scope
// (SusuData §3), and §6 names these files as the plan. When that build starts,
// delete those lines from LEGACY — deliberately, one at a time.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

// Almstins-era. Held back from susufinancedata. Reason per file so that removing
// one is an informed decision rather than a guess.
const LEGACY = new Map([
	['0001_review_device_identity.sql', 'Almstins — review device identity'],
	['0002_verify_proof.sql',           'Verify — in scope (§3); apply at the Verify build'],
	['0003_verified_entities.sql',      'Verify — in scope (§3); apply at the Verify build'],
	['0004_record_proofs.sql',          'Record-proofs engine — in scope (§3); apply at the exports build'],
	['0005_verify_claim_once.sql',      'Verify — in scope (§3); apply at the Verify build'],
	['0006_verify_deposit.sql',         'Verify — in scope (§3); apply at the Verify build'],
	['0007_aave_deposit_tax.sql',       'Almstins — Aave + tax engine, both carved OUT'],
	['0008_petro_receipts.sql',         'Almstins — PetroTins surface, carved OUT'],
	['0009_verify_qr_claim.sql',        'Verify — in scope (§3); apply at the Verify build'],
	['0010_verify_monitor.sql',         'Verify — in scope (§3); apply at the Verify build'],
	['0011_verify_claimed_names.sql',   'Verify — in scope (§3); apply at the Verify build'],
	['0012_verify_display_hint.sql',    'Verify — in scope (§3); apply at the Verify build'],
	['0013_import_price_provenance.sql','Almstins — CSV import + price feeds, both carved OUT'],
	['0015_token_overrides.sql',        'Almstins — token/price stack, carved OUT permanently'],
	['0016_nft_manual_cost.sql',        'Almstins — cost basis / tax engine, carved OUT'],
	['0017_ai_usage.sql',               'Almstins — AI features, carved OUT (no Anthropic key)'],
	['0018_terms_acceptance.sql',       'Almstins — superseded by SusuFinance ToS v2.0'],
	['0019_security_events.sql',        'Almstins — revisit at the auth build'],
	['0020_community_ratings.sql',      'Almstins — checker is a link-out now (§3)'],
]);

const MIGRATIONS_DIR = 'migrations-pg';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const markIdx = args.indexOf('--mark');
const markFile = markIdx !== -1 ? args[markIdx + 1] : null;

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('Missing DATABASE_URL.');
	console.error('  DATABASE_URL=<susufinancedata url> npm run db:migrate');
	process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])/.test(url);
const client = new pg.Client({
	connectionString: url,
	ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function main() {
	await client.connect();

	// Same table name the Turso runner used, so the concept carries over.
	await client.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id         TEXT        PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`);

	const appliedRows = await client.query('SELECT id FROM schema_migrations ORDER BY id');
	const applied = new Set(appliedRows.rows.map((r) => r.id));

	if (markFile) {
		await client.query(
			'INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
			[path.basename(markFile)],
		);
		console.log(`[db:migrate] marked as applied (not run): ${path.basename(markFile)}`);
		return;
	}

	const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

	const held = files.filter((f) => LEGACY.has(f));
	const pending = files.filter((f) => !LEGACY.has(f) && !applied.has(f));
	const done = files.filter((f) => !LEGACY.has(f) && applied.has(f));

	console.log(`[db:migrate] ${MIGRATIONS_DIR} — ${files.length} files\n`);

	if (held.length) {
		console.log(`  held back (${held.length}) — Almstins-era, never applied here:`);
		for (const f of held) console.log(`    · ${f.padEnd(34)} ${LEGACY.get(f)}`);
		console.log('');
	}
	if (done.length) {
		console.log(`  already applied (${done.length}):`);
		for (const f of done) console.log(`    ✓ ${f}`);
		console.log('');
	}
	if (!pending.length) {
		console.log('  nothing pending.');
		return;
	}

	console.log(`  pending (${pending.length}):`);
	for (const f of pending) console.log(`    → ${f}`);
	console.log('');

	if (dryRun) {
		console.log('[db:migrate] --dry-run, nothing applied.');
		return;
	}

	for (const file of pending) {
		const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
		// One transaction per file: a migration lands whole or not at all.
		await client.query('BEGIN');
		try {
			await client.query(sql);
			await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
			await client.query('COMMIT');
			console.log(`  applied: ${file}`);
		} catch (e) {
			await client.query('ROLLBACK');
			console.error(`  FAILED: ${file}\n    ${e.message}`);
			throw e;
		}
	}
	console.log('\n[db:migrate] complete.');
}

try {
	await main();
} catch (e) {
	process.exitCode = 1;
} finally {
	await client.end();
}
