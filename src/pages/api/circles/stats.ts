/**
 * GET /api/circles/stats — the programme, in aggregate.
 *
 * ── The rule this endpoint exists under ──────────────────────────────────────
 *
 * AGGREGATES ONLY. NO MEMBER ROWS. Not "no member rows in the UI" — no member row
 * ever leaves this endpoint. Every count is computed in SQL and only the total
 * crosses the wire, so a member id is never in the response to be rendered, logged,
 * sorted, or leaked. "Aggregates only, no member rows" was the programme-report
 * rule; it is now the rule for the whole admin surface.
 *
 * This is what the operator legitimately needs: is the programme working. It is
 * NOT how any individual woman is doing — her record belongs to her and lives on
 * her screen. §5a put enforcement inside the circle ("full shared ledger —
 * transparency IS the enforcement"); the operator administers, he does not police.
 *
 * ── Early withdrawals ────────────────────────────────────────────────────────
 *
 * count · % · total units, and nothing else. The draft feed of (member, amount,
 * date) is deleted: it came with a framing rule promising it would "never be a
 * problem-members wall", and the framing rule was the tell — you cannot frame your
 * way out of a data shape. The rate IS the intelligence ("30% = emergencies or
 * product mismatch"); a name only says which woman is struggling. And an early
 * withdrawal is her own money leaving her own wallet, which makes it more private
 * than a contribution, not less.
 *
 * ── Vocabulary ──────────────────────────────────────────────────────────────
 *
 * "behind", never "delinquent". The operator's vocabulary becomes the programme's
 * culture. And `behind` means only "past grace and still unpaid" — a woman who paid
 * five weeks late is `repaid`, which is a different fact.
 *
 * Units only. No prices, no valuations. Within-tenant: no cross-tenant benchmarks,
 * ever. Every statement filters WHERE tenant_id, from the session only.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { disciplineState, type DisciplineState } from '@/lib/circles/discipline';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	const tenantId = session.tenantId;

	try {
		// ── people ────────────────────────────────────────────────────────────
		// "87 of 100 active in week 6" — the pilot-reporting line. Active = a live
		// membership; departed = left_at set. A departure is recorded, never erased.
		const peopleRes = await db.execute({
			sql: `SELECT
			        COUNT(DISTINCT m.id)::int AS total,
			        COUNT(DISTINCT cm.member_id) FILTER (WHERE cm.left_at IS NULL)::int AS active,
			        COUNT(DISTINCT cm.member_id) FILTER (WHERE cm.left_at IS NOT NULL)::int AS departed,
			        COUNT(DISTINCT m.id) FILTER (WHERE m.created_at > now() - interval '30 days')::int AS joined_30d
			      FROM members m
			      LEFT JOIN contract_members cm ON cm.member_id = m.id AND cm.tenant_id = m.tenant_id
			     WHERE m.tenant_id = ?`,
			args: [tenantId],
		});

		// ── contracts / completion ────────────────────────────────────────────
		// The headline: circles finished vs abandoned.
		const contractsRes = await db.execute({
			sql: `SELECT status, type, COUNT(*)::int AS n
			        FROM contracts WHERE tenant_id = ? GROUP BY status, type`,
			args: [tenantId],
		});

		// ── discipline ────────────────────────────────────────────────────────
		// Contributions are read ONLY to be counted. Member ids are selected so the
		// state can be derived per row, then discarded — nothing per-member is
		// returned. grace_days comes from the contract: "late" is the group's own
		// definition, not the platform's.
		const contribRes = await db.execute({
			sql: `SELECT ct.observed_at::text AS observed_at,
			             ct.due_date::text AS due_date,
			             ct.observed_amount::float8 AS observed_amount,
			             c.grace_days,
			             r.round_index
			        FROM contributions ct
			        JOIN contracts c ON c.id = ct.contract_id AND c.tenant_id = ct.tenant_id
			        LEFT JOIN rounds r ON r.id = ct.round_id AND r.tenant_id = ct.tenant_id
			       WHERE ct.tenant_id = ?`,
			args: [tenantId],
		});

		// ── payouts observed, in units ────────────────────────────────────────
		const payoutRes = await db.execute({
			sql: `SELECT COUNT(*)::int AS n FROM rounds
			       WHERE tenant_id = ? AND payout_tx_hash IS NOT NULL`,
			args: [tenantId],
		});

		// ── Verify health ─────────────────────────────────────────────────────
		// §3: every payout address verified before a round opens. Among ACTIVE
		// members — a departed member's unverified address is not a live risk.
		const verifyRes = await db.execute({
			sql: `SELECT
			        COUNT(DISTINCT cm.member_id)::int AS active,
			        COUNT(DISTINCT cm.member_id) FILTER (WHERE m.address_verified_at IS NOT NULL)::int AS verified
			      FROM contract_members cm
			      JOIN members m ON m.id = cm.member_id AND m.tenant_id = cm.tenant_id
			     WHERE cm.tenant_id = ? AND cm.left_at IS NULL`,
			args: [tenantId],
		});

		// Rounds open with an unverified recipient — the one safety fact worth an
		// alert, because §3 says such a round should not have opened.
		const riskRes = await db.execute({
			sql: `SELECT COUNT(*)::int AS n
			        FROM rounds r
			        LEFT JOIN members m ON m.id = r.recipient_member_id AND m.tenant_id = r.tenant_id
			       WHERE r.tenant_id = ? AND r.status = 'open' AND m.address_verified_at IS NULL`,
			args: [tenantId],
		});

		// ── early withdrawals — AGGREGATED IN SQL ─────────────────────────────
		// COUNT and SUM only. The member id is read inside COUNT(DISTINCT ...) and
		// never selected, so it cannot reach the response. This is the difference
		// between a rate and a wall, expressed as a query.
		const ewRes = await db.execute({
			sql: `SELECT COUNT(*)::int AS events,
			             COUNT(DISTINCT (detail->>'member_id'))::int AS people,
			             COALESCE(SUM((detail->>'amount')::numeric), 0)::float8 AS units
			        FROM contract_events
			       WHERE tenant_id = ? AND action = 'early_withdrawal'`,
			args: [tenantId],
		});

		const now = new Date();

		// ── derive ────────────────────────────────────────────────────────────
		const buckets: Record<DisciplineState, number> = {
			early: 0, on_time: 0, late: 0, repaid: 0, behind: 0, pending: 0,
		};
		let observedUnits = 0;
		// Discipline trend by round index — "does discipline decay late in a
		// rotation?" The classic ROSCA question, answered per programme.
		const byRound = new Map<number, { judged: number; clean: number }>();

		for (const row of contribRes.rows as any[]) {
			const s = disciplineState({
				observedAt: row.observed_at,
				dueDate: row.due_date,
				graceDays: Number(row.grace_days ?? 0),
				now,
			});
			buckets[s] += 1;
			observedUnits += Number(row.observed_amount) || 0;

			if (row.round_index != null && s !== 'pending') {
				const idx = Number(row.round_index);
				const e = byRound.get(idx) ?? { judged: 0, clean: 0 };
				e.judged += 1;
				if (s === 'early' || s === 'on_time') e.clean += 1;
				byRound.set(idx, e);
			}
		}

		const judged = buckets.early + buckets.on_time + buckets.late + buckets.repaid + buckets.behind;

		const byStatus = (st: string) =>
			(contractsRes.rows as any[])
				.filter((r) => String(r.status) === st)
				.reduce((a, r) => a + Number(r.n), 0);

		const completed = byStatus('completed');
		const abandoned = byStatus('abandoned');
		const settled = completed + abandoned;

		const p: any = peopleRes.rows[0] ?? {};
		const v: any = verifyRes.rows[0] ?? {};
		const ew: any = ewRes.rows[0] ?? {};
		const activeMembers = Number(v.active) || 0;

		return json({
			ok: true,
			people: {
				total: Number(p.total) || 0,
				active: Number(p.active) || 0,
				departed: Number(p.departed) || 0,
				joined30d: Number(p.joined_30d) || 0,
			},
			contracts: {
				active: byStatus('active'),
				forming: byStatus('forming'),
				completed,
				abandoned,
				// Null, not zero: a programme with no finished cycles has no completion
				// record, not a 0% one. Reporting 0% would be a claim we cannot make.
				completionRate: settled > 0 ? completed / settled : null,
			},
			discipline: {
				...buckets,
				judged,
				// Shares of what has actually been judged. `pending` is excluded — it is
				// not a verdict, and nobody is anything until grace closes.
				shares: judged > 0
					? {
							early: buckets.early / judged,
							on_time: buckets.on_time / judged,
							late: buckets.late / judged,
							repaid: buckets.repaid / judged,
							behind: buckets.behind / judged,
						}
					: null,
				trend: [...byRound.entries()]
					.sort((a, b) => a[0] - b[0])
					.map(([roundIndex, e]) => ({
						roundIndex,
						judged: e.judged,
						onTimeShare: e.judged > 0 ? e.clean / e.judged : 0,
					})),
			},
			flow: {
				contributionsObservedUnits: observedUnits,
				payoutsObserved: Number((payoutRes.rows[0] as any)?.n) || 0,
			},
			earlyWithdrawals: {
				events: Number(ew.events) || 0,
				people: Number(ew.people) || 0,
				units: Number(ew.units) || 0,
				// Share of active members who have exercised the right at least once.
				// This number is the programme intelligence; no name is attached to it,
				// here or anywhere downstream.
				shareOfMembers: activeMembers > 0 ? (Number(ew.people) || 0) / activeMembers : null,
			},
			safety: {
				activeMembers,
				verifiedMembers: Number(v.verified) || 0,
				verifiedShare: activeMembers > 0 ? (Number(v.verified) || 0) / activeMembers : null,
				openRoundsUnverifiedRecipient: Number((riskRes.rows[0] as any)?.n) || 0,
			},
			// Honest zero-state rather than a fabricated number: the notifications table
			// does not exist yet, so nothing has been sent and we say so.
			ops: { notificationsBuilt: false },
			updatedAt: new Date().toISOString(),
		});
	} catch (err) {
		console.error('[api/circles/stats] failed', err);
		return json({ ok: false, error: 'load_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
