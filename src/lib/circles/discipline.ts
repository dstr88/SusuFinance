// discipline.ts — how a contribution reads, derived from dates alone.
//
// This is the single place the early / on-time / late / behind reading is made.
// Nothing stores it: "behind" is a fact about a date, never a label the platform
// hangs on a person, and it stops being true the moment she pays. Every stat, badge
// and reminder must call this function so they can never disagree about her.
//
// ── Vocabulary is load-bearing ───────────────────────────────────────────────
// "behind", never "delinquent". Bank-speak imports the wrong moral frame, and the
// operator's vocabulary becomes the program's culture. The DB refuses 'delinquent'
// as a status; this module refuses it as a concept.
//
// ── Nobody is anything until grace closes ────────────────────────────────────
// An unpaid contribution inside its grace window is `pending` — not late, not
// behind, not judged. The group defines late via contracts.grace_days; until that
// window shuts, the honest reading is "no news". This is why `pending` exists
// alongside §4's four buckets rather than being folded into one of them.

export type DisciplineState =
	| 'early'    // paid before the due date
	| 'on_time'  // paid on the due date
	| 'late'     // paid within the group's grace window
	| 'repaid'   // paid after grace closed — she made it good, late
	| 'behind'   // past grace and STILL UNPAID — the only state that is an open debt
	| 'pending'; // not yet due, or inside grace: no judgment yet

/**
 * `repaid` splits out of what §4 called `behind` (Donnie, Jul 15).
 *
 * "Behind" was doing two jobs: a woman who paid five weeks late, and a woman who
 * never paid at all. Those are not the same fact — the first kept her word late,
 * the second owes the circle money — and collapsing them wrongs whichever one you
 * are looking at. `behind` now means only what the word means: she owes, now.
 *
 * This also makes `behind` properly transient. It stops being true the moment she
 * pays, becoming `repaid` — which is permanent, because it happened. The record
 * remembers that she was late; it does not go on calling her behind.
 */
export const DISCIPLINE_BUCKETS: DisciplineState[] = ['early', 'on_time', 'late', 'repaid', 'behind'];

/**
 * Calendar-day number in UTC. Dates arrive as 'YYYY-MM-DD' text (selected as
 * ::text in SQL on purpose — node-postgres parses a DATE into a JS Date at LOCAL
 * midnight, which silently shifts the day for anyone west of Greenwich and would
 * make a member "late" by timezone).
 */
function dayNumber(value: string | Date): number {
	if (typeof value === 'string') {
		const [y, m, d] = value.slice(0, 10).split('-').map(Number);
		return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
	}
	return Math.floor(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / 86_400_000);
}

export interface DisciplineInput {
	/** When the chain was observed paying. null = no transfer seen yet. */
	observedAt: string | Date | null;
	/** The due date snapshotted on the contribution ('YYYY-MM-DD'). */
	dueDate: string | Date;
	/** The group's definition of late (contracts.grace_days). */
	graceDays: number;
	/** Injectable for tests; defaults to now. */
	now?: Date;
}

export function disciplineState({ observedAt, dueDate, graceDays, now = new Date() }: DisciplineInput): DisciplineState {
	const due = dayNumber(dueDate);
	const graceEnds = due + Math.max(0, graceDays);

	if (observedAt) {
		const paid = dayNumber(observedAt);
		if (paid < due) return 'early';
		if (paid === due) return 'on_time';
		if (paid <= graceEnds) return 'late';
		return 'repaid'; // paid, but after the window the group agreed to — made good
	}

	// Unpaid. Only past the grace window is it anything at all — and only here does
	// "behind" mean what the word means: she owes the circle, now.
	return dayNumber(now) > graceEnds ? 'behind' : 'pending';
}

/**
 * Is this contribution short of what was expected?
 *
 * DELIBERATELY SEPARATE from disciplineState, and deliberately not a verdict.
 * Whether 15 of 25 rolls forward, counts as credit, or reads as late is the
 * group's rule and is still open (SusuData §7 q5, a question for the partner
 * call). Collapsing "short" into the timing states would answer it by accident.
 * So we report the fact and let the surface show it neutrally; when the rule
 * lands, it lands here and nowhere else.
 *
 * Note this is NOT the arrears/forgiveness case (§5b): a shorted member at her
 * turn has two valid expectations, and the observed amount IS her decision. That
 * is a matching concern, not a discipline one.
 */
export function isShort(observedAmount: number | null, expectedAmount: number): boolean {
	if (observedAmount === null) return false; // unpaid is not "short" — it's pending or behind
	return observedAmount + 1e-9 < expectedAmount;
}

export interface DisciplineTally {
	early: number;
	on_time: number;
	late: number;
	repaid: number;
	behind: number;
	pending: number;
	/** §4's denominator: expected contributions, judgment reached. Excludes pending. */
	judged: number;
	/** Every expected contribution, including those still inside grace. */
	expected: number;
}

export function tally(states: DisciplineState[]): DisciplineTally {
	const t: DisciplineTally = { early: 0, on_time: 0, late: 0, repaid: 0, behind: 0, pending: 0, judged: 0, expected: 0 };
	for (const s of states) {
		t[s] += 1;
		t.expected += 1;
		if (s !== 'pending') t.judged += 1;
	}
	return t;
}

/** Share of `judged` in a bucket, 0–1. Returns 0 when nothing is judged yet — a
 *  program with no closed grace windows has no discipline record, not a 0% one. */
export function shareOf(t: DisciplineTally, bucket: DisciplineState): number {
	if (!t.judged) return 0;
	return t[bucket] / t.judged;
}
