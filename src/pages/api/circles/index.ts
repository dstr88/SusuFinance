/**
 * GET /api/circles — the operator vault's contract tins.
 *
 * One row per contract (circle or savings group) with the card face from
 * SusuData §4: name · member count · cadence · round position or target progress ·
 * contributions-in this period · next due date · payout-address Verify status.
 *
 * ── What this endpoint cannot do ─────────────────────────────────────────────
 *
 * Nothing here reads a wallet balance, and no query could: the schema stores no
 * balance and this endpoint never touches a chain. The operator sees "total in"
 * (cumulative observed contributions) and round state — relationship data. Her
 * balance is hers. The honest promise is "the app never shows him, and never
 * helps him" (§4), and that holds because there is no code path to show.
 *
 * Every amount is a token unit. No prices, no valuations — the price stack is
 * permanently out of this product.
 *
 * Nothing is ranked. The card carries facts about a circle, never a score.
 *
 * ── Isolation ────────────────────────────────────────────────────────────────
 * Every statement filters WHERE tenant_id, sourced from the session and never
 * from the request body. Cross-tenant reads do not exist; there are no
 * cross-tenant benchmarks, by design (§4).
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { disciplineState, type DisciplineState } from '@/lib/circles/discipline';

export const prerender = false;

type ContractType = 'circle' | 'target_group';

export interface CircleCard {
	id: string;
	type: ContractType;
	name: string;
	currency: string;
	cadence: 'weekly' | 'biweekly' | 'monthly';
	status: 'forming' | 'active' | 'completed' | 'abandoned';
	memberCount: number;
	expectedAmount: number;
	/** Circles: the open (or next) round. */
	round: {
		index: number;
		total: number;
		recipientName: string | null;
		recipientId: string | null;
		payoutVerified: boolean;
		/** The address frozen at open — the anti-swap rule made visible. */
		payoutFrozen: boolean;
	} | null;
	/** Savings groups: progress toward the members' target. */
	target: {
		perMemberAmount: number;
		groupTarget: number;
		observed: number;
		fraction: number;
		targetDate: string | null;
	} | null;
	/**
	 * The women in this tin, in the order the group agreed — `forming` tins only.
	 *
	 * A live tin gets `null`, not an empty array: its roster is not draggable, so the
	 * cards are not rendered in it, so the names are not sent. Shipping a roster the
	 * UI would only refuse to render is a wider surface than the feature needs, and
	 * "fetched and dropped" is not a boundary — not fetching is.
	 *
	 * There is nothing about her record here, in any tin — because this is the
	 * operator's screen, and the cut he made stands: he sees who is in the group, not
	 * whether or when she paid. That is not the same as her having no record. She
	 * carries one across every circle she is in; it belongs on her screen, not his.
	 *
	 * What a forming tin genuinely lacks is a ROTATION: no rounds have run, so there
	 * are no stars for this group's cycle yet. Her history is untouched by that.
	 */
	roster:
		| {
				memberId: string;
				displayName: string | null;
				turnOrder: number | null;
				payoutVerified: boolean;
		  }[]
		| null;
	/** The current open round (circles) or current period (savings groups). */
	period: {
		label: string | null;
		dueDate: string | null;
		paid: number;
		expected: number;
		observedUnits: number;
		expectedUnits: number;
		states: Record<DisciplineState, number>;
	} | null;
	/** Cumulative observed contributions, in units. Never a valuation. */
	totalInUnits: number;
	/** Payout addresses verified, among active members. Feeds §4's safety health. */
	verifiedMembers: number;
}

export const GET: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	const tenantId = session.tenantId;

	try {
		// Contracts + active member count + verified-payout count, in one pass.
		// The member count is of ACTIVE memberships (left_at IS NULL): a departed
		// member keeps her row and her turn_order forever, but she is not a member.
		const contractsRes = await db.execute({
			sql: `
				SELECT c.id, c.type, c.name, c.currency, c.cadence, c.status,
				       c.expected_amount::float8   AS expected_amount,
				       c.target_amount::float8     AS target_amount,
				       c.target_date::text         AS target_date,
				       c.grace_days,
				       COUNT(cm.id) FILTER (WHERE cm.left_at IS NULL)::int AS member_count,
				       COUNT(cm.id) FILTER (WHERE cm.left_at IS NULL AND m.address_verified_at IS NOT NULL)::int AS verified_members
				  FROM contracts c
				  LEFT JOIN contract_members cm ON cm.contract_id = c.id AND cm.tenant_id = c.tenant_id
				  LEFT JOIN members m           ON m.id = cm.member_id  AND m.tenant_id = c.tenant_id
				 WHERE c.tenant_id = ?
				 GROUP BY c.id
				 ORDER BY c.type, c.created_at`,
			args: [tenantId],
		});

		if (!contractsRes.rows.length) return json({ ok: true, cards: [], updatedAt: new Date().toISOString() });

		const contractIds = contractsRes.rows.map((r) => String(r.id));
		const placeholders = contractIds.map(() => '?').join(',');

		// The open round per circle, plus the recipient's chosen identity and her
		// Verify state. display_name may be null — a UUID-only member is first-class,
		// so the UI renders her id, never a "missing name" state.
		const roundsRes = await db.execute({
			sql: `
				SELECT r.contract_id, r.round_index, r.due_date::text AS due_date, r.status,
				       r.recipient_member_id, r.payout_address_snapshot,
				       m.display_name, m.address_verified_at,
				       (SELECT COUNT(*)::int FROM rounds r2
				         WHERE r2.contract_id = r.contract_id AND r2.tenant_id = r.tenant_id) AS total_rounds
				  FROM rounds r
				  LEFT JOIN members m ON m.id = r.recipient_member_id AND m.tenant_id = r.tenant_id
				 WHERE r.tenant_id = ? AND r.contract_id IN (${placeholders})
				   AND r.status IN ('open','scheduled')
				 ORDER BY r.contract_id, r.round_index`,
			args: [tenantId, ...contractIds],
		});

		// Contributions for the CURRENT window only: the open round for circles, the
		// latest period for savings groups. Plus lifetime units per contract.
		const contribRes = await db.execute({
			sql: `
				SELECT ct.contract_id, ct.round_id, ct.period,
				       ct.due_date::text  AS due_date,
				       ct.observed_at::text AS observed_at,
				       ct.expected_amount::float8 AS expected_amount,
				       ct.observed_amount::float8 AS observed_amount,
				       r.status AS round_status
				  FROM contributions ct
				  LEFT JOIN rounds r ON r.id = ct.round_id AND r.tenant_id = ct.tenant_id
				 WHERE ct.tenant_id = ? AND ct.contract_id IN (${placeholders})`,
			args: [tenantId, ...contractIds],
		});

		// The roster of every FORMING tin, in agreed turn order. Scoped to forming in
		// the SQL rather than filtered in JS: a live tin's names never leave the
		// database, so no future refactor of the mapping code can leak them onto a card
		// that is not meant to carry them.
		const formingIds = contractsRes.rows
			.filter((c: any) => String(c.status) === 'forming')
			.map((c: any) => String(c.id));
		const rosterRes = formingIds.length
			? await db.execute({
					sql: `
						SELECT cm.contract_id, cm.member_id, cm.turn_order,
						       m.display_name, m.address_verified_at
						  FROM contract_members cm
						  LEFT JOIN members m ON m.id = cm.member_id AND m.tenant_id = cm.tenant_id
						 WHERE cm.tenant_id = ?
						   AND cm.contract_id IN (${formingIds.map(() => '?').join(',')})
						   AND cm.left_at IS NULL
						 ORDER BY cm.contract_id, cm.turn_order NULLS LAST`,
					args: [tenantId, ...formingIds],
				})
			: { rows: [] as any[] };

		const now = new Date();
		const rows = contribRes.rows as any[];

		const cards: CircleCard[] = contractsRes.rows.map((c: any) => {
			const id = String(c.id);
			const type = String(c.type) as ContractType;
			const graceDays = Number(c.grace_days ?? 0);
			const mine = rows.filter((r) => String(r.contract_id) === id);

			const totalInUnits = mine.reduce((a, r) => a + (Number(r.observed_amount) || 0), 0);

			// ── the current window ────────────────────────────────────────────
			let windowRows: any[] = [];
			let periodLabel: string | null = null;
			let periodDue: string | null = null;

			if (type === 'circle') {
				const open = mine.filter((r) => r.round_status === 'open');
				windowRows = open;
				periodDue = open[0]?.due_date ?? null;
			} else {
				// Latest period present. Savings groups have no rounds; the period IS
				// the window, and the cycle — not the calendar — is her time unit.
				const periods = [...new Set(mine.map((r) => r.period).filter(Boolean))].sort();
				const latest = periods[periods.length - 1] ?? null;
				periodLabel = latest ? String(latest) : null;
				windowRows = latest ? mine.filter((r) => r.period === latest) : [];
				periodDue = windowRows[0]?.due_date ?? null;
			}

			const states: Record<DisciplineState, number> = { early: 0, on_time: 0, late: 0, repaid: 0, behind: 0, pending: 0 };
			let observedUnits = 0;
			let expectedUnits = 0;
			let paid = 0;
			for (const r of windowRows) {
				const s = disciplineState({
					observedAt: r.observed_at,
					dueDate: r.due_date,
					graceDays,
					now,
				});
				states[s] += 1;
				expectedUnits += Number(r.expected_amount) || 0;
				if (r.observed_at) {
					paid += 1;
					observedUnits += Number(r.observed_amount) || 0;
				}
			}

			// ── circles: the open round, else the next scheduled one ──────────
			const contractRounds = (roundsRes.rows as any[]).filter((r) => String(r.contract_id) === id);
			const openRound = contractRounds.find((r) => r.status === 'open') ?? contractRounds[0] ?? null;

			const round =
				type === 'circle' && openRound
					? {
							index: Number(openRound.round_index),
							total: Number(openRound.total_rounds),
							recipientName: openRound.display_name ? String(openRound.display_name) : null,
							recipientId: openRound.recipient_member_id ? String(openRound.recipient_member_id) : null,
							payoutVerified: Boolean(openRound.address_verified_at),
							payoutFrozen: Boolean(openRound.payout_address_snapshot),
						}
					: null;

			// ── savings groups: progress toward the target ────────────────────
			// target_amount is PER MEMBER (the seed's 40/month × 12 = 480 reads as one
			// saver's school-fees goal, and §5c has each saver accumulating in her own
			// wallet — there is no group pot to progress toward). The group figure is
			// therefore per-member × active members. Flagged for Donnie: the §6 draft
			// does not say which, and this is the reading the numbers support.
			const perMember = Number(c.target_amount) || 0;
			const memberCount = Number(c.member_count) || 0;
			const groupTarget = perMember * memberCount;
			const target =
				type === 'target_group' && perMember > 0
					? {
							perMemberAmount: perMember,
							groupTarget,
							observed: totalInUnits,
							fraction: groupTarget > 0 ? Math.min(1, totalInUnits / groupTarget) : 0,
							targetDate: c.target_date ? String(c.target_date) : null,
						}
					: null;

			// null for a live tin, and an array — possibly empty — for a forming one.
			// The distinction is load-bearing: null means "this tin's cards are not
			// yours to arrange", [] means "an empty tin, waiting for someone".
			const roster =
				String(c.status) === 'forming'
					? (rosterRes.rows as any[])
							.filter((r) => String(r.contract_id) === id)
							.map((r) => ({
								memberId: String(r.member_id),
								displayName: r.display_name ? String(r.display_name) : null,
								turnOrder: r.turn_order === null ? null : Number(r.turn_order),
								payoutVerified: Boolean(r.address_verified_at),
							}))
					: null;

			return {
				id,
				type,
				roster,
				name: String(c.name),
				currency: String(c.currency),
				cadence: String(c.cadence) as CircleCard['cadence'],
				status: String(c.status) as CircleCard['status'],
				memberCount,
				expectedAmount: Number(c.expected_amount) || 0,
				round,
				target,
				period: windowRows.length
					? {
							label: periodLabel,
							dueDate: periodDue,
							paid,
							expected: windowRows.length,
							observedUnits,
							expectedUnits,
							states,
						}
					: null,
				totalInUnits,
				verifiedMembers: Number(c.verified_members) || 0,
			};
		});

		return json({ ok: true, cards, updatedAt: new Date().toISOString() });
	} catch (err) {
		console.error('[api/circles] failed', err);
		return json({ ok: false, error: 'load_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
