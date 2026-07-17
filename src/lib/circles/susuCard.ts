/**
 * The susu card, digitized — HER record in one circle (SusuData §4, decided Jul 14,
 * corrected Jul 15). The tradition's most trusted object, rendered.
 *
 * ── Not a score ──────────────────────────────────────────────────────────────
 *
 * Every mark here is a FACT derived from the chain, never a number the platform
 * assigns. No comparison, no tiers, no ranking (§5d). It is her own record, decorated
 * — within THIS circle only (§5b); the thing that spans her circles is her signed
 * export, which she carries. Nothing here is stored: discipline is read from dates
 * every time (discipline.ts), so "behind" stops being true the moment she pays.
 *
 * ── What the card face shows ──────────────────────────────────────────────────
 *
 *   • entry date ("member since")            — contract_members.joined_at
 *   • the current cycle's star row            — one slot per turn in the cycle
 *   • lifetime tallies                        — composition + completed-cycle gates
 *
 * Star row (glyphs, not colours — a colour-blind or pre-literate reader must parse
 * it before she reads it):
 *   on_time  ★  paid on the due date or early
 *   late     ☆  paid, but late (within grace) or made good after (repaid) — still a star
 *   turn     ◆  HER round: the other members pay her, so she was never asked to pay
 *   missed   ○  past grace and still unpaid — the one open-debt state
 *   pending  ·  not yet due, inside grace, or a slot not reached — no judgment yet
 *
 * The star row is only the CURRENT cycle. Completed cycles compress: the timeline is
 * forgotten (which week), the COMPOSITION never is — on-time · late · repaid · missed
 * counts are permanent, and one tally gate is banked per five finished rotations.
 */

import { db } from '@/lib/db';
import { disciplineState } from '@/lib/circles/discipline';

export type SlotState = 'on_time' | 'late' | 'turn' | 'missed' | 'pending';

export interface SusuCard {
	joinedAt: string | null;
	/** Her slot in the agreed order (turn_order), or null if not yet placed. */
	turnSlot: number | null;
	/** Turns in one rotation — the length of the star row. */
	cycleLength: number;
	/** Which rotation the circle is on now (1-based). The star row is this cycle. */
	currentCycle: number;
	/** The current cycle's row, one entry per slot, ordered by turn position. */
	slots: SlotState[];
	/** Permanent counts across every cycle — composition never compresses. */
	lifetime: {
		onTime: number;
		late: number;
		repaid: number;
		missed: number;
		/** Finished rotations — the tally gates (one gate = five). */
		cyclesCompleted: number;
	};
}

interface RoundRow {
	id: string;
	round_index: number;
	recipient_member_id: string | null;
	due_date: string;
	status: string;
}
interface ContribRow {
	round_id: string;
	observed_at: string | null;
	due_date: string;
}

/**
 * Build the card for each of a member's circles. One small set of queries per circle
 * (a member is in a handful, not hundreds), all scoped by tenant + her member id.
 */
export async function getSusuCards(
	tenantId: string,
	memberId: string,
	circleIds: string[],
): Promise<Map<string, SusuCard>> {
	const out = new Map<string, SusuCard>();
	for (const contractId of circleIds) {
		try {
			const card = await buildCard(tenantId, memberId, contractId);
			if (card) out.set(contractId, card);
		} catch {
			/* one circle's card failing must not blank the whole modal */
		}
	}
	return out;
}

async function buildCard(tenantId: string, memberId: string, contractId: string): Promise<SusuCard | null> {
	// Her membership facts + the group's grace window.
	const memRes = await db.execute({
		sql: `SELECT cm.turn_order, cm.joined_at::text AS joined_at, c.grace_days
		        FROM contract_members cm
		        JOIN contracts c ON c.id = cm.contract_id AND c.tenant_id = cm.tenant_id
		       WHERE cm.tenant_id = ? AND cm.contract_id = ? AND cm.member_id = ?
		       LIMIT 1`,
		args: [tenantId, contractId, memberId],
	});
	if (!memRes.rows.length) return null;
	const mem: any = memRes.rows[0];
	const turnSlot = mem.turn_order === null || mem.turn_order === undefined ? null : Number(mem.turn_order);
	const joinedAt = mem.joined_at ? String(mem.joined_at) : null;
	const graceDays = Number(mem.grace_days ?? 0);

	// The rotation length = the turn slots the group agreed. Derived, never stored —
	// exactly as the operator drill-in derives it (max turn_order among live members).
	const slotsRes = await db.execute({
		sql: `SELECT MAX(turn_order) AS slots
		        FROM contract_members
		       WHERE tenant_id = ? AND contract_id = ? AND left_at IS NULL`,
		args: [tenantId, contractId],
	});
	const maxTurn = Number((slotsRes.rows[0] as any)?.slots ?? 0);

	// Rounds (the rotation) and her contributions (her record). Her own round carries no
	// contribution — the pot nets her share — so a turn slot is known from the round's
	// recipient / her turn_order, not from a missing row.
	const roundsRes = await db.execute({
		sql: `SELECT id, round_index, recipient_member_id, due_date::text AS due_date, status
		        FROM rounds WHERE tenant_id = ? AND contract_id = ? ORDER BY round_index`,
		args: [tenantId, contractId],
	});
	const rounds = roundsRes.rows as unknown as RoundRow[];

	const contribRes = await db.execute({
		sql: `SELECT round_id, observed_at::text AS observed_at, due_date::text AS due_date
		        FROM contributions
		       WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND round_id IS NOT NULL`,
		args: [tenantId, contractId, memberId],
	});
	// Key on the round's real id — works for both the Beta seed's readable ids and any
	// circle's UUIDs.
	const contribByRoundId = new Map<string, ContribRow>();
	for (const r of contribRes.rows as unknown as ContribRow[]) {
		if (r.round_id) contribByRoundId.set(String(r.round_id), r);
	}

	const cycleLength = maxTurn > 0 ? maxTurn : rounds.length > 0 ? rounds.length : 1;

	// Where the circle is now: the open round, or the furthest round on record.
	const openRound = rounds.find((r) => r.status === 'open');
	const lastIndex = rounds.length ? Math.max(...rounds.map((r) => Number(r.round_index))) : 0;
	const currentRoundIndex = openRound ? Number(openRound.round_index) : lastIndex;
	const currentCycle = currentRoundIndex > 0 ? Math.ceil(currentRoundIndex / cycleLength) : 1;

	const roundByIndex = new Map<number, RoundRow>();
	for (const r of rounds) roundByIndex.set(Number(r.round_index), r);

	// ── the current cycle's star row ─────────────────────────────────────────────
	const slots: SlotState[] = [];
	for (let p = 1; p <= cycleLength; p++) {
		const roundIndex = (currentCycle - 1) * cycleLength + p;
		const round = roundByIndex.get(roundIndex);

		// Her turn: known from her slot in the agreed order, even before the round opens.
		if (turnSlot !== null && p === turnSlot) { slots.push('turn'); continue; }
		if (round && round.recipient_member_id && String(round.recipient_member_id) === memberId) { slots.push('turn'); continue; }

		if (!round) { slots.push('pending'); continue; }
		const contrib = contribByRoundId.get(String(round.id));
		slots.push(slotFor(contrib, graceDays));
	}

	// ── lifetime composition — every cycle, never compressed ─────────────────────
	const lifetime = { onTime: 0, late: 0, repaid: 0, missed: 0, cyclesCompleted: 0 };
	for (const c of contribByRoundId.values()) {
		const state = disciplineState({ observedAt: c.observed_at, dueDate: c.due_date, graceDays });
		if (state === 'early' || state === 'on_time') lifetime.onTime++;
		else if (state === 'late') lifetime.late++;
		else if (state === 'repaid') lifetime.repaid++;
		else if (state === 'behind') lifetime.missed++;
		// 'pending' is not a fact yet — excluded
	}
	const maxCompleted = rounds.reduce((m, r) => (r.status === 'completed' ? Math.max(m, Number(r.round_index)) : m), 0);
	lifetime.cyclesCompleted = Math.floor(maxCompleted / cycleLength);

	return { joinedAt, turnSlot, cycleLength, currentCycle, slots, lifetime };
}

/** Map one contribution (or its absence) to a slot glyph. */
function slotFor(contrib: ContribRow | undefined, graceDays: number): SlotState {
	if (!contrib) {
		// No contribution and not her turn: she was not in the circle for this round
		// (joined later, or already departed). A blank slot, not a missed payment.
		return 'pending';
	}
	const state = disciplineState({ observedAt: contrib.observed_at, dueDate: contrib.due_date, graceDays });
	if (state === 'early' || state === 'on_time') return 'on_time';
	if (state === 'late' || state === 'repaid') return 'late';
	if (state === 'behind') return 'missed';
	return 'pending';
}
