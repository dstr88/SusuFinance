/**
 * platformSettings.ts — switches an operator throws, not features that happen to be
 * missing.
 *
 * ── The admissions hold ─────────────────────────────────────────────────────
 *
 * Right now nobody can join a circle on their own, and it would be easy to call that
 * "locked". It is not locked, it is unbuilt: group signup does not exist, so the
 * self-serve door leads nowhere. The difference matters, because an accident of the
 * roadmap lifts itself the day the feature ships, and nobody has to decide anything
 * for the door to open.
 *
 * `admissions_held` makes it a decision. While it is on:
 *
 *   · a person can sign up, sign in, and reach the lobby, which tells her she is
 *     waiting — signing up is not the thing being prevented
 *   · she cannot open an admission request, so she cannot become a candidate
 *   · an operator can still create a circle and place members himself
 *
 * That last one is the point rather than a loophole. The hold does not stop entry;
 * it stops entry that nobody chose.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * Every failure path returns HELD. A missing table, an unrun migration, a database
 * that will not answer — all of them mean the door stays shut. The alternative is a
 * gate that opens whenever the thing guarding it breaks, which is not a gate.
 */

import { db } from '@/lib/db';

export const ADMISSIONS_HELD = 'admissions_held';

/**
 * Is the self-serve door shut? Defaults to true, and stays true on any error.
 *
 * Not cached. This is read on the join paths only — a handful of requests — and a
 * cached "open" surviving a decision to close would be exactly the wrong thing to
 * optimize for.
 */
export async function isAdmissionsHeld(): Promise<boolean> {
	try {
		const r = await db.execute({
			sql: `SELECT value FROM platform_settings WHERE key = ? LIMIT 1`,
			args: [ADMISSIONS_HELD],
		});
		if (!r.rows.length) return true; // no row = never opened = held
		return String((r.rows[0] as any).value ?? 'true').toLowerCase() !== 'false';
	} catch {
		return true; // table missing, migration unrun, database unreachable — held
	}
}

/** Throw the switch. `who` is recorded so a lift is never anonymous. */
export async function setAdmissionsHeld(held: boolean, who: string): Promise<void> {
	await db.execute({
		sql: `INSERT INTO platform_settings (key, value, updated_at, updated_by)
		      VALUES (?, ?, now(), ?)
		      ON CONFLICT (key) DO UPDATE
		        SET value = EXCLUDED.value,
		            updated_at = now(),
		            updated_by = EXCLUDED.updated_by`,
		args: [ADMISSIONS_HELD, held ? 'true' : 'false', who],
	});
}

/** For the admin panel: the state, plus who last changed it and when. */
export async function getAdmissionsHold(): Promise<{
	held: boolean;
	updatedAt: string | null;
	updatedBy: string | null;
}> {
	try {
		const r = await db.execute({
			sql: `SELECT value, updated_at, updated_by FROM platform_settings WHERE key = ? LIMIT 1`,
			args: [ADMISSIONS_HELD],
		});
		if (!r.rows.length) return { held: true, updatedAt: null, updatedBy: null };
		const row = r.rows[0] as any;
		return {
			held: String(row.value ?? 'true').toLowerCase() !== 'false',
			updatedAt: row.updated_at ? String(row.updated_at) : null,
			updatedBy: row.updated_by ? String(row.updated_by) : null,
		};
	} catch {
		return { held: true, updatedAt: null, updatedBy: null };
	}
}
