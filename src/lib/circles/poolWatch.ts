/**
 * poolWatch.ts — check the chain for signs that someone is pooling member funds.
 *
 * "No pot, ever" is enforced inside this codebase by the absence of anywhere to put one.
 * It cannot be enforced UPSTREAM: a wallet provider or a ramp partner could pool, and the
 * only symptom visible here would be contributions quietly failing to be observed — which
 * reads as "nobody paid" rather than "someone is holding the money".
 *
 * This turns the partner's promise from something you have to trust into something you
 * monitor. Asking is not accountability; a scheduled check that would notice is.
 *
 * ── Two detections ──────────────────────────────────────────────────────────
 *
 * 1. SHARED ADDRESS — two members recorded against the same address. That is the omnibus
 *    tell: a custodian handing many users one deposit address, which is exactly what a
 *    pool looks like from outside. It also destroys the payment watcher's ability to say
 *    who paid, so it matters twice.
 *    Pure database check — no chain call, no quota, no excuse not to run it.
 *
 * 2. COMMON SINK — one address collecting from several different members. In a working
 *    circle a member pays the round's recipient, and a recipient is a member with a payout
 *    address. So an address that is NOBODY's payout address, receiving from two or more
 *    members, is a collector, a pool, or something that needs explaining.
 *
 * ── What this is not ────────────────────────────────────────────────────────
 * Not surveillance of members. Every check is about the SHAPE of the money flow, never
 * about who anyone is. It reads addresses the programme already holds and asks whether
 * they are distinct and whether funds route directly. No identity is involved, so bright
 * line #2 is untouched.
 *
 * An alert is not proof of bad faith. It is a fact that needs an explanation, which is a
 * far better thing to hold than a suspicion.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../db';

/** Chain lookups are metered; a pool shows up in recent history or not at all. */
const MAX_MEMBERS_SCANNED = 40;
const CALL_SPACING_MS = 260;
/** Distinct members feeding one non-payout address before it is worth a look. */
const SINK_THRESHOLD = 2;

export interface PoolWatchResult {
	tenantsChecked: number;
	membersScanned: number;
	sharedAddresses: number;
	commonSinks: number;
	errors: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Token transfers touching one wallet, newest first. Same shape and same token filter as
 * observePayments — a pool that moves a lookalike token is not the thing being watched
 * for, and widening the filter would fill the panel with airdrop noise.
 */
async function tokenTransfers(address: string): Promise<any[]> {
	const apiKey = process.env.ETHERSCAN_API_KEY ?? '';
	const chainId = process.env.SUSU_CHAIN_ID ?? '1';
	const token = (process.env.SUSU_TOKEN_ADDRESS ?? '').toLowerCase();

	const url =
		`https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${apiKey}` +
		`&module=account&action=tokentx&address=${address}` +
		(token ? `&contractaddress=${token}` : '') +
		`&sort=desc&page=1&offset=100`;

	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { status?: string; message?: string; result?: unknown };
	if (String(json.status) !== '1') {
		if (/no transactions found/i.test(String(json.message))) return [];
		throw new Error(String(json.message ?? 'lookup failed'));
	}
	return Array.isArray(json.result) ? json.result : [];
}

/** Record a finding, or bump last_seen on one already held. */
async function record(
	tenantId: string,
	kind: 'shared_address' | 'common_sink',
	address: string,
	memberCount: number,
	detail: string,
): Promise<void> {
	await db.execute({
		sql: `INSERT INTO pool_alerts (id, tenant_id, kind, address, member_count, detail)
		      VALUES (?, ?, ?, ?, ?, ?)
		      ON CONFLICT (tenant_id, kind, address) DO UPDATE
		        SET last_seen    = now(),
		            member_count = EXCLUDED.member_count,
		            detail       = EXCLUDED.detail`,
		args: [randomUUID(), tenantId, kind, address.toLowerCase(), memberCount, detail],
	});
}

export async function runPoolWatch(): Promise<PoolWatchResult> {
	const out: PoolWatchResult = {
		tenantsChecked: 0,
		membersScanned: 0,
		sharedAddresses: 0,
		commonSinks: 0,
		errors: [],
	};

	// Every programme holding member addresses. Each is checked alone: a shared address
	// only means something WITHIN a programme, and comparing across tenants would be the
	// cross-tenant read the isolation rule forbids.
	const tenants = await db.execute({
		sql: `SELECT DISTINCT tenant_id FROM members
		      WHERE (wallet_address IS NOT NULL AND wallet_address <> '')
		         OR (payout_address IS NOT NULL AND payout_address <> '')`,
		args: [],
	});

	for (const t of tenants.rows as Record<string, unknown>[]) {
		const tenantId = String(t.tenant_id);
		out.tenantsChecked++;

		// ── 1. Shared addresses. Database only, so this always runs. ─────────────────
		//
		// Duplicate wallet_address is already impossible — members_tenant_wallet_uniq
		// forbids it, for exactly this reason. What is NOT forbidden, and is the shape a
		// custodian produces, is several members sharing one payout address, or one
		// member's payout address being another member's contribution wallet.
		const shared = await db.execute({
			sql: `WITH addrs AS (
			        SELECT id, lower(wallet_address) AS addr FROM members
			         WHERE tenant_id = ? AND wallet_address IS NOT NULL AND wallet_address <> ''
			        UNION ALL
			        SELECT id, lower(payout_address) AS addr FROM members
			         WHERE tenant_id = ? AND payout_address IS NOT NULL AND payout_address <> ''
			      )
			      SELECT addr, COUNT(DISTINCT id)::int AS n
			        FROM addrs
			       GROUP BY addr
			      HAVING COUNT(DISTINCT id) > 1`,
			args: [tenantId, tenantId],
		});
		for (const row of shared.rows as Record<string, unknown>[]) {
			await record(
				tenantId,
				'shared_address',
				String(row.addr),
				Number(row.n),
				`${row.n} members are recorded against this same address. One address per member is what makes it possible to say who paid, and a custodian handing several people one deposit address is what a pool looks like from outside.`,
			);
			out.sharedAddresses++;
		}

		// ── 2. Common sink. Needs the chain. ────────────────────────────────────────
		if (!process.env.ETHERSCAN_API_KEY) {
			out.errors.push('ETHERSCAN_API_KEY not set — chain check skipped');
			continue;
		}

		const members = await db.execute({
			sql: `SELECT id,
			             lower(wallet_address) AS wallet,
			             lower(payout_address) AS payout
			        FROM members
			       WHERE tenant_id = ?
			       ORDER BY updated_at DESC
			       LIMIT ?`,
			args: [tenantId, MAX_MEMBERS_SCANNED],
		});
		const rows = members.rows as Record<string, unknown>[];

		// A member paying another member's payout address is the whole point of a round,
		// so those destinations are expected and never flagged.
		const payouts = new Set(
			rows.map((r) => String(r.payout ?? '')).filter((a) => a && a !== 'null'),
		);

		// destination → the distinct members who sent to it
		const sinks = new Map<string, Set<string>>();

		for (const m of rows) {
			const wallet = String(m.wallet ?? '');
			if (!wallet || wallet === 'null') continue;
			try {
				const txs = await tokenTransfers(wallet);
				out.membersScanned++;
				for (const tx of txs) {
					const from = String(tx.from ?? '').toLowerCase();
					const to = String(tx.to ?? '').toLowerCase();
					if (from !== wallet) continue; // only what she sent
					if (!to || payouts.has(to)) continue; // paying a member is the point
					if (!sinks.has(to)) sinks.set(to, new Set());
					sinks.get(to)!.add(String(m.id));
				}
			} catch (err) {
				out.errors.push(
					`${wallet.slice(0, 10)}…: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			await sleep(CALL_SPACING_MS);
		}

		for (const [dest, senders] of sinks) {
			if (senders.size < SINK_THRESHOLD) continue;
			await record(
				tenantId,
				'common_sink',
				dest,
				senders.size,
				`${senders.size} members sent to this address, and it is nobody's payout address in this programme. In a circle a member pays the round's recipient directly, so a shared destination needs an explanation.`,
			);
			out.commonSinks++;
		}
	}

	return out;
}

/** Open findings for one programme, most recently seen first. */
export async function openPoolAlerts(tenantId: string) {
	const r = await db.execute({
		sql: `SELECT kind, address, member_count, detail, first_seen, last_seen
		        FROM pool_alerts
		       WHERE tenant_id = ? AND resolved_at IS NULL
		       ORDER BY last_seen DESC
		       LIMIT 50`,
		args: [tenantId],
	});
	return r.rows as Record<string, unknown>[];
}

/** Open findings across every programme, for the platform admin surface. */
export async function allOpenPoolAlerts() {
	const r = await db.execute({
		sql: `SELECT a.tenant_id, t.name AS tenant_name,
		             a.kind, a.address, a.member_count, a.detail, a.first_seen, a.last_seen
		        FROM pool_alerts a
		        LEFT JOIN tenants t ON t.id = a.tenant_id
		       WHERE a.resolved_at IS NULL
		       ORDER BY a.last_seen DESC
		       LIMIT 50`,
		args: [],
	});
	return r.rows as Record<string, unknown>[];
}
