/**
 * observePayments.ts — mark contributions paid by watching the chain.
 *
 * The missing half of the record-keeping promise. open-round.ts writes one `pending`
 * contribution per member when a round opens, and until now nothing ever moved one off
 * pending: the UI, the susu card and the stats all read `observed_at` and speak of
 * "contributions observed on the chain", while no code observed anything. A circle
 * could run correctly and show every woman as unpaid forever.
 *
 * ── What it does, and what it must never do ─────────────────────────────────
 * It READS. It never sends, signs, or holds anything — bright line #1. Every write here
 * is to our own record of what already happened on a public chain.
 *
 * For each open round it asks: did this member's wallet send USDC to THIS round's
 * frozen payout address, since the round opened? The frozen snapshot
 * (rounds.payout_address_snapshot) is what makes the question answerable — the
 * destination cannot move mid-round, so a payment either went to the agreed address or
 * it did not.
 *
 * ── Deliberately conservative ───────────────────────────────────────────────
 * A wrong "she paid" is worse than a missing one. SusuData's own standard: "one false
 * 'you owe' costs more trust than fifty correct reminders earn" — and the inverse is
 * equally true, because a false "paid" hides a real debt from the group. So:
 *   · only transfers of the configured token count
 *   · only to the round's snapshotted address, never a current address
 *   · only at or after the round opened
 *   · under-payment records `partial`, never `paid`
 * Anything ambiguous is left pending for a human, which is the failure direction the
 * group can see and correct.
 */

import { db } from '../db';

/** Free-tier Etherscan allows ~5 calls/sec; stay well under and cap the run. */
const MAX_LOOKUPS_PER_RUN = 60;
const CALL_SPACING_MS = 260;

/** Tolerance for float noise when comparing amounts, not a discount on the debt. */
const EPSILON = 1e-9;

export interface ObserveResult {
	checked: number;
	paid: number;
	partial: number;
	errors: string[];
}

function config() {
	const apiKey = process.env.ETHERSCAN_API_KEY ?? '';
	// Chain and token are config, not constants: the ramp decision picks the chain, and
	// changing it later must be an env edit rather than a rewrite.
	const chainId = process.env.SUSU_CHAIN_ID ?? '1';
	const token = (process.env.SUSU_TOKEN_ADDRESS ?? '').toLowerCase();
	return { apiKey, chainId, token };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Token transfers OUT of one wallet, newest first.
 *
 * Scoped to the configured token contract so a scam airdrop of a lookalike token can
 * never be mistaken for a contribution — the single most likely way to fake a payment.
 */
async function tokenTransfers(address: string): Promise<any[]> {
	const { apiKey, chainId, token } = config();
	const url =
		`https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${apiKey}` +
		`&module=account&action=tokentx&address=${address}` +
		(token ? `&contractaddress=${token}` : '') +
		`&sort=desc&page=1&offset=100`;

	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { status?: string; message?: string; result?: unknown };

	// Etherscan says "No transactions found" with status 0 — an empty wallet, not a
	// failure. Anything else with status 0 is a real problem and must be reported
	// rather than silently read as "she has not paid".
	if (String(json.status) !== '1') {
		if (/no transactions found/i.test(String(json.message))) return [];
		throw new Error(String(json.message ?? 'lookup failed'));
	}
	return Array.isArray(json.result) ? json.result : [];
}

/** Raw token units → human amount, using the decimals the explorer reports. */
function toAmount(value: string, decimals: string): number {
	const d = Number(decimals || '6');
	return Number(value) / Math.pow(10, d);
}

/**
 * One pass over every open round.
 *
 * Tenant-scoped implicitly: it walks rounds, and every row it touches is reached
 * through that round's own tenant_id. No cross-tenant read is possible because no query
 * here starts from a member.
 */
export async function observePayments(): Promise<ObserveResult> {
	const out: ObserveResult = { checked: 0, paid: 0, partial: 0, errors: [] };
	const { apiKey, chainId } = config();
	if (!apiKey) {
		out.errors.push('ETHERSCAN_API_KEY not set');
		return out;
	}

	// Every unpaid contribution in an open round, with the payer's wallet and the
	// round's FROZEN destination. Rounds that never opened have no obligations, and a
	// round with no snapshot predates the anti-swap freeze and is skipped rather than
	// matched against a moving target.
	const rows = await db.execute({
		sql: `SELECT c.id, c.tenant_id, c.member_id, c.expected_amount, c.due_date,
		             r.payout_address_snapshot AS dest,
		             m.wallet_address AS payer
		      FROM contributions c
		      JOIN rounds r  ON r.id = c.round_id AND r.tenant_id = c.tenant_id
		      JOIN members m ON m.id = c.member_id AND m.tenant_id = c.tenant_id
		      WHERE c.status = 'pending'
		        AND r.status = 'open'
		        AND r.payout_address_snapshot IS NOT NULL
		        AND m.wallet_address IS NOT NULL
		      ORDER BY c.due_date ASC
		      LIMIT ?`,
		args: [MAX_LOOKUPS_PER_RUN],
	});

	// One lookup per payer, not per contribution: a woman in three circles is one
	// wallet, and asking three times is three times the quota for the same answer.
	const byPayer = new Map<string, Record<string, unknown>[]>();
	for (const r of rows.rows as Record<string, unknown>[]) {
		const payer = String(r.payer).toLowerCase();
		if (!byPayer.has(payer)) byPayer.set(payer, []);
		byPayer.get(payer)!.push(r);
	}

	for (const [payer, items] of byPayer) {
		let transfers: any[];
		try {
			transfers = await tokenTransfers(payer);
		} catch (err) {
			out.errors.push(`${payer.slice(0, 10)}…: ${err instanceof Error ? err.message : err}`);
			await sleep(CALL_SPACING_MS);
			continue;
		}
		await sleep(CALL_SPACING_MS);

		for (const item of items) {
			out.checked++;
			const dest = String(item.dest).toLowerCase();
			const expected = Number(item.expected_amount);

			// Sent BY her, TO this round's frozen address. `from` is checked explicitly
			// because tokentx returns both directions for an address.
			const match = transfers.find(
				(t) =>
					String(t.to ?? '').toLowerCase() === dest &&
					String(t.from ?? '').toLowerCase() === payer,
			);
			if (!match) continue;

			const amount = toAmount(String(match.value ?? '0'), String(match.tokenDecimal ?? '6'));
			// Under-payment is recorded as partial and stays visible. Rounding it up to
			// "paid" would hide a real shortfall from the group, which is the one thing
			// the shared ledger exists to prevent.
			const status = amount + EPSILON >= expected ? 'paid' : 'partial';

			await db.execute({
				sql: `UPDATE contributions
				      SET status = ?, observed_tx_hash = ?, observed_amount = ?,
				          observed_at = to_timestamp(?), updated_at = now()
				      WHERE id = ? AND status = 'pending'`,
				args: [status, String(match.hash), amount, Number(match.timeStamp ?? 0), item.id as number],
			});

			if (status === 'paid') out.paid++;
			else out.partial++;
		}
	}

	if (!out.errors.length && out.checked === 0) {
		// Not an error — just nothing due right now. Said explicitly so an empty run is
		// distinguishable from a broken one.
		out.errors.push(`nothing pending on chain ${chainId}`);
	}
	return out;
}
