// The group decides. The core of admission (§5a) and any-question proposals (Jul 16).
//
// This is the substance; the API routes are thin wrappers that resolve a session to
// a member and call in here. Kept as a lib so the mechanic is testable without a
// live session, and so the two surfaces (join flow, proposals) share one evaluator.
//
// ── What "the group decides" means in code ──────────────────────────────────
//
// A vote's THRESHOLD is the whole personality:
//   sponsor       admission v1 — passes the instant the sponsor votes yes, fails on
//                 her no. Only her ballot is consulted.
//   majority      a proposal — at close, yes > no among ballots cast.
//   blackball     admission, full §5a — silence consents, one no fails (at close).
//   unanimous_no  expulsion, §5b — every eligible voter must vote no (at close).
//
// v1 wires `sponsor` and `majority`. `blackball` and `unanimous_no` are schema-ready
// and evaluate() has their shape, but they resolve only at close, which needs the
// close pass (a later slice) — so they are left returning 'open' until then rather
// than half-resolving early.
//
// Admission is the ONLY kind that mutates membership on pass: it inserts her
// contract_members row (see §6 — a candidate has no such row until admitted, which
// is what makes "she sees nothing until admitted" free). turn_order is left NULL on
// admission to a live circle: her rotation slot is §5a's entry question (next
// boundary / vacant slot / consented mid-cycle), decided separately, not by the
// admission itself.

import crypto from 'node:crypto';
import { db } from '@/lib/db';

export type VoteKind = 'admission' | 'mid_entry' | 'expulsion' | 'proposal';
export type Threshold = 'sponsor' | 'blackball' | 'unanimous_no' | 'majority';
export type Ballot = 'yes' | 'no' | 'abstain';
export type VoteStatus = 'open' | 'passed' | 'failed' | 'cancelled';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Find the member row for this login in this programme, or create one. A login
 *  is at most one member per tenant (members_tenant_user_uniq). */
export async function ensureMemberForUser(
	tenantId: string,
	userId: string,
	opts: { username?: string | null } = {},
): Promise<string> {
	const existing = await db.execute({
		sql: `SELECT id FROM members WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
		args: [tenantId, userId],
	});
	if (existing.rows.length) return String((existing.rows[0] as any).id);

	const id = crypto.randomUUID();
	const username = opts.username?.trim() || null;
	await db.execute({
		sql: `INSERT INTO members (id, tenant_id, display_name, user_id, created_at, updated_at)
		      VALUES (?, ?, ?, ?, now(), now())`,
		args: [id, tenantId, username, userId],
	});
	return id;
}

/** The member row for this login in this programme, or null. A voter must already
 *  BE a member (unlike a candidate, who is created on join). */
export async function getMemberForUser(tenantId: string, userId: string): Promise<string | null> {
	const res = await db.execute({
		sql: `SELECT id FROM members WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
		args: [tenantId, userId],
	});
	return res.rows.length ? String((res.rows[0] as any).id) : null;
}

/**
 * Open an admission vote — the candidate is asking to join `contractId`, vouched by
 * `sponsorMemberId`. v1 threshold is `sponsor`: her sponsor's yes admits her.
 *
 * Refuses if she is already a member of the circle, or already has an admission open
 * on it — a candidate should not be able to stack requests.
 */
export async function openAdmission(params: {
	tenantId: string;
	contractId: string;
	candidateMemberId: string;
	sponsorMemberId: string;
	windowDays?: number;
	threshold?: Extract<Threshold, 'sponsor' | 'blackball'>;
}): Promise<{ voteId: string }> {
	const { tenantId, contractId, candidateMemberId, sponsorMemberId } = params;
	const threshold = params.threshold ?? 'sponsor';
	const windowDays = params.windowDays ?? 10;

	const already = await db.execute({
		sql: `SELECT 1 FROM contract_members
		       WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND left_at IS NULL LIMIT 1`,
		args: [tenantId, contractId, candidateMemberId],
	});
	if (already.rows.length) throw new VoteError('already_member', 'She is already in this group.');

	const open = await db.execute({
		sql: `SELECT 1 FROM circle_votes
		       WHERE tenant_id = ? AND contract_id = ? AND kind = 'admission'
		         AND subject_member_id = ? AND status = 'open' LIMIT 1`,
		args: [tenantId, contractId, candidateMemberId],
	});
	if (open.rows.length) throw new VoteError('already_pending', 'A request is already open for her.');

	const voteId = crypto.randomUUID();
	const closesAt = new Date(Date.now() + windowDays * DAY_MS).toISOString();
	await db.execute({
		sql: `INSERT INTO circle_votes
		        (id, tenant_id, contract_id, kind, subject_member_id, opened_by, invited_by, threshold, closes_at)
		      VALUES (?, ?, ?, 'admission', ?, ?, ?, ?, ?)`,
		args: [voteId, tenantId, contractId, candidateMemberId, candidateMemberId, sponsorMemberId, threshold, closesAt],
	});
	return { voteId };
}

/**
 * Open a proposal — any member putting a question to her circle. Advisory: the app
 * records the group's decision, it never enforces it.
 */
export async function openProposal(params: {
	tenantId: string;
	contractId: string;
	byMemberId: string;
	title: string;
	windowDays?: number;
}): Promise<{ voteId: string }> {
	const { tenantId, contractId, byMemberId } = params;
	const title = params.title.trim();
	if (!title) throw new VoteError('empty_question', 'A proposal needs a question.');
	const windowDays = params.windowDays ?? 7;

	const voteId = crypto.randomUUID();
	const closesAt = new Date(Date.now() + windowDays * DAY_MS).toISOString();
	await db.execute({
		sql: `INSERT INTO circle_votes
		        (id, tenant_id, contract_id, kind, title, opened_by, threshold, closes_at)
		      VALUES (?, ?, ?, 'proposal', ?, ?, 'majority', ?)`,
		args: [voteId, tenantId, contractId, title, byMemberId, closesAt],
	});
	return { voteId };
}

/**
 * Cast a ballot, then re-evaluate the vote. Returns the vote's status after the
 * ballot. For a `sponsor` admission the sponsor's yes/no resolves it immediately;
 * `majority`/`blackball`/`unanimous_no` resolve at close, so they stay 'open' here.
 *
 * The ballot row is dedup-only and secret by rule — never read back for display.
 */
export async function castBallot(params: {
	tenantId: string;
	voteId: string;
	memberId: string;
	ballot: Ballot;
}): Promise<{ status: VoteStatus; resolved: boolean }> {
	const { tenantId, voteId, memberId, ballot } = params;

	const vres = await db.execute({
		sql: `SELECT id, contract_id, kind, subject_member_id, invited_by, threshold, status
		        FROM circle_votes WHERE tenant_id = ? AND id = ? LIMIT 1`,
		args: [tenantId, voteId],
	});
	if (!vres.rows.length) throw new VoteError('no_such_vote', 'That vote does not exist.');
	const v = vres.rows[0] as any;
	if (String(v.status) !== 'open') throw new VoteError('vote_closed', 'That vote is already decided.');

	// Eligibility. sponsor: only the sponsor may cast the deciding ballot. Everything
	// else: any live member of the circle (the candidate/subject cannot vote on herself).
	const threshold = String(v.threshold) as Threshold;
	if (threshold === 'sponsor') {
		if (memberId !== String(v.invited_by)) {
			throw new VoteError('not_the_sponsor', 'Only her sponsor can vouch for her.');
		}
	} else {
		if (v.subject_member_id && memberId === String(v.subject_member_id)) {
			throw new VoteError('subject_cannot_vote', 'You cannot vote on yourself.');
		}
		const member = await db.execute({
			sql: `SELECT 1 FROM contract_members
			       WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND left_at IS NULL LIMIT 1`,
			args: [tenantId, String(v.contract_id), memberId],
		});
		if (!member.rows.length) throw new VoteError('not_a_member', 'Only members of this circle may vote.');
	}

	// One ballot per member. INSERT … the PK (vote_id, member_id) rejects a second.
	try {
		await db.execute({
			sql: `INSERT INTO circle_vote_ballots (vote_id, member_id, ballot) VALUES (?, ?, ?)`,
			args: [voteId, memberId, ballot],
		});
	} catch (err: any) {
		if (String(err?.message ?? '').includes('circle_vote_ballots_pkey')) {
			throw new VoteError('already_voted', 'You have already voted.');
		}
		throw err;
	}

	return resolveIfDecided(tenantId, voteId);
}

/** Apply the threshold. Only `sponsor` resolves on a single ballot in v1; the tallied
 *  thresholds wait for the close pass. */
async function resolveIfDecided(tenantId: string, voteId: string): Promise<{ status: VoteStatus; resolved: boolean }> {
	const vres = await db.execute({
		sql: `SELECT contract_id, kind, subject_member_id, invited_by, threshold FROM circle_votes
		        WHERE tenant_id = ? AND id = ? LIMIT 1`,
		args: [tenantId, voteId],
	});
	const v = vres.rows[0] as any;
	if (String(v.threshold) !== 'sponsor') return { status: 'open', resolved: false };

	// The sponsor's ballot is the only one that matters.
	const sb = await db.execute({
		sql: `SELECT ballot FROM circle_vote_ballots WHERE vote_id = ? AND member_id = ? LIMIT 1`,
		args: [voteId, String(v.invited_by)],
	});
	if (!sb.rows.length) return { status: 'open', resolved: false };

	const passed = String((sb.rows[0] as any).ballot) === 'yes';
	const status: VoteStatus = passed ? 'passed' : 'failed';
	await db.execute({
		sql: `UPDATE circle_votes SET status = ?, outcome_at = now() WHERE tenant_id = ? AND id = ? AND status = 'open'`,
		args: [status, tenantId, voteId],
	});

	if (passed && String(v.kind) === 'admission') {
		await admitMember(tenantId, String(v.contract_id), String(v.subject_member_id));
	}
	return { status, resolved: true };
}

/** Admission's one side effect: insert her membership. turn_order NULL — her slot is
 *  §5a's entry question, set separately. ON CONFLICT-safe against a double resolve. */
async function admitMember(tenantId: string, contractId: string, memberId: string): Promise<void> {
	const already = await db.execute({
		sql: `SELECT 1 FROM contract_members
		       WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND left_at IS NULL LIMIT 1`,
		args: [tenantId, contractId, memberId],
	});
	if (already.rows.length) return;
	await db.execute({
		sql: `INSERT INTO contract_members (tenant_id, contract_id, member_id, turn_order, joined_at)
		      VALUES (?, ?, ?, NULL, now())`,
		args: [tenantId, contractId, memberId],
	});
}

// ── The close pass ───────────────────────────────────────────────────────────
//
// `sponsor` admissions resolve the instant the sponsor votes (above). The tallied
// thresholds — majority, blackball, unanimous_no — resolve only when their window
// ends, which is what this does: scan open votes past closes_at, apply the
// threshold, and stamp the outcome (admitting or expelling on the way). Run by a
// cron and opportunistically on-read.

/** Apply a vote's threshold at close, given its ballots. Returns the verdict. */
async function evaluateAtClose(v: {
	tenant_id: string; contract_id: string; threshold: string;
	subject_member_id: string | null; invited_by: string | null;
}, voteId: string): Promise<'passed' | 'failed'> {
	const ballots = (await db.execute({
		sql: `SELECT member_id, ballot FROM circle_vote_ballots WHERE vote_id = ?`,
		args: [voteId],
	})).rows as any[];

	switch (v.threshold) {
		case 'sponsor':
			// Still open at close means the sponsor never voted yes — no vouch, no entry.
			return ballots.some((b) => String(b.member_id) === String(v.invited_by) && String(b.ballot) === 'yes')
				? 'passed' : 'failed';
		case 'majority': {
			const yes = ballots.filter((b) => b.ballot === 'yes').length;
			const no = ballots.filter((b) => b.ballot === 'no').length;
			return yes > no ? 'passed' : 'failed';
		}
		case 'blackball':
			// Silence consents; one no fails. §5a.
			return ballots.some((b) => b.ballot === 'no') ? 'failed' : 'passed';
		case 'unanimous_no': {
			// Expulsion: every eligible voter (live members except the subject) must vote
			// no. Silence blocks. §5b.
			const eligRes = await db.execute({
				sql: `SELECT COUNT(*) AS n FROM contract_members
				       WHERE tenant_id = ? AND contract_id = ? AND left_at IS NULL AND member_id <> ?`,
				args: [v.tenant_id, v.contract_id, String(v.subject_member_id ?? '')],
			});
			const eligible = Number((eligRes.rows[0] as any)?.n ?? 0);
			const noVotes = ballots.filter((b) => b.ballot === 'no').length;
			return eligible > 0 && noVotes >= eligible ? 'passed' : 'failed';
		}
		default:
			return 'failed';
	}
}

/** Expulsion's side effect: the subject leaves. Her row keeps its turn_order forever
 *  (a departed member is never overwritten — 0021). */
async function expelMember(tenantId: string, contractId: string, memberId: string): Promise<void> {
	await db.execute({
		sql: `UPDATE contract_members SET left_at = now()
		       WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND left_at IS NULL`,
		args: [tenantId, contractId, memberId],
	});
}

/**
 * Resolve every open vote whose window has closed. Idempotent and safe to run often:
 * the status='open' guard on the UPDATE means two concurrent passes cannot both
 * apply the same outcome. Optionally scoped to one tenant.
 */
export async function closeExpiredVotes(tenantId?: string): Promise<{ resolved: number }> {
	const due = await db.execute({
		sql: `SELECT id, tenant_id, contract_id, kind, subject_member_id, invited_by, threshold
		        FROM circle_votes
		       WHERE status = 'open' AND closes_at <= now()
		         ${tenantId ? 'AND tenant_id = ?' : ''}`,
		args: tenantId ? [tenantId] : [],
	});

	let resolved = 0;
	for (const row of due.rows as any[]) {
		const v = {
			id: String(row.id),
			tenant_id: String(row.tenant_id),
			contract_id: String(row.contract_id),
			kind: String(row.kind),
			subject_member_id: row.subject_member_id ? String(row.subject_member_id) : null,
			invited_by: row.invited_by ? String(row.invited_by) : null,
			threshold: String(row.threshold),
		};
		const verdict = await evaluateAtClose(v, v.id);

		// Guarded: only the pass that flips 'open' → verdict does the side effect.
		const upd = await db.execute({
			sql: `UPDATE circle_votes SET status = ?, outcome_at = now()
			       WHERE id = ? AND status = 'open'`,
			args: [verdict, v.id],
		});
		if ((upd.rowsAffected ?? 0) === 0) continue; // another pass got it

		if (verdict === 'passed' && v.subject_member_id) {
			if (v.kind === 'admission' || v.kind === 'mid_entry') {
				await admitMember(v.tenant_id, v.contract_id, v.subject_member_id);
			} else if (v.kind === 'expulsion') {
				await expelMember(v.tenant_id, v.contract_id, v.subject_member_id);
			}
		}
		resolved += 1;
	}
	return { resolved };
}

export class VoteError extends Error {
	code: string;
	constructor(code: string, message: string) {
		super(message);
		this.code = code;
	}
}
