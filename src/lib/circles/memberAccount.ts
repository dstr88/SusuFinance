/**
 * The member's own view of herself — the data behind her account modal.
 *
 * This is the counterpart to /api/circles/:id (the OPERATOR's view). Where that
 * endpoint deliberately refuses to know her payment record, this one is hers: her
 * circles, and the votes open in them that she can act on. It is scoped to a single
 * login's own member row, so a member only ever sees her own memberships — the same
 * "you can only read yourself" guarantee, from the other side.
 *
 * Ballots stay secret: this returns whether SHE has voted (to dedup her own button),
 * never how anyone voted, never a running tally. A vote in flight shows as "open,"
 * and only its outcome lands when the window closes.
 *
 * Shared by the lobby (server-seeds the modal so a market woman on a slow bundle
 * sees no spinner) and /api/me/circles (the modal's refetch after she acts).
 */

import { db } from '@/lib/db';
import { closeExpiredVotes } from '@/lib/circles/votes';

export type MemberVoteKind = 'admission' | 'mid_entry' | 'expulsion' | 'proposal';

export interface MemberVote {
	voteId: string;
	kind: MemberVoteKind;
	/** The proposal's question. Null for person-votes (admission/expulsion). */
	title: string | null;
	/** The person a vote is about, if any. Her chosen name, or null (UUID-only). */
	subjectName: string | null;
	closesAt: string;
	/** May this member cast the deciding ballot? Mirrors castBallot's eligibility:
	 *  a sponsor vote only her sponsor decides; otherwise any member but the subject. */
	canCast: boolean;
	/** Has she already voted? Dedup only — not a leak of which way. */
	mine: boolean;
}

export interface MemberCircle {
	id: string;
	name: string;
	type: string;
	votes: MemberVote[];
}

export interface MemberAccount {
	tenantId: string;
	memberId: string;
	displayName: string | null;
	circles: MemberCircle[];
}

/**
 * Resolve the account for a login, or null if this login is not a member of any
 * programme (an operator, or a signed-in person who has not joined yet — neither
 * needs this surface). Scoped entirely by the member row keyed on `userId`, so it
 * can only ever return that user's own circles.
 */
export async function getMemberAccount(userId: string): Promise<MemberAccount | null> {
	if (!userId) return null;

	// Her member row IS the scope. One login is one member in one programme (the
	// members_tenant_user partial-unique guarantees at most one per tenant; in
	// practice one overall). LIMIT 1 takes it.
	const meRes = await db.execute({
		sql: `SELECT id, tenant_id, display_name FROM members WHERE user_id = ? LIMIT 1`,
		args: [userId],
	});
	if (!meRes.rows.length) return null;
	const me: any = meRes.rows[0];
	const tenantId = String(me.tenant_id);
	const memberId = String(me.id);
	const displayName = me.display_name ? String(me.display_name) : null;

	// Resolve any lapsed votes before we read them, so a closed outcome is not shown
	// as still open. Non-fatal — the modal loads either way.
	await closeExpiredVotes(tenantId).catch(() => { /* the modal still loads */ });

	// Her live circles — the ones she is currently in (a departure drops her from this
	// list; her history is the operator's log, not her home screen).
	const cRes = await db.execute({
		sql: `SELECT c.id, c.name, c.type
		        FROM contracts c
		        JOIN contract_members cm
		          ON cm.contract_id = c.id AND cm.tenant_id = c.tenant_id
		       WHERE cm.tenant_id = ? AND cm.member_id = ? AND cm.left_at IS NULL
		       ORDER BY c.name`,
		args: [tenantId, memberId],
	});

	// Open votes in those circles. The join to contract_members is what scopes this to
	// HER circles — a vote in a group she is not in never appears.
	const vRes = await db.execute({
		sql: `SELECT v.id, v.contract_id, v.kind, v.title, v.threshold,
		             v.subject_member_id, v.invited_by,
		             v.closes_at::text AS closes_at,
		             sub.display_name AS subject_name,
		             EXISTS(
		               SELECT 1 FROM circle_vote_ballots b
		                WHERE b.vote_id = v.id AND b.member_id = ?
		             ) AS voted
		        FROM circle_votes v
		        JOIN contract_members cm
		          ON cm.contract_id = v.contract_id AND cm.tenant_id = v.tenant_id
		         AND cm.member_id = ? AND cm.left_at IS NULL
		        LEFT JOIN members sub
		          ON sub.id = v.subject_member_id AND sub.tenant_id = v.tenant_id
		       WHERE v.tenant_id = ? AND v.status = 'open'
		       ORDER BY v.closes_at ASC`,
		args: [memberId, memberId, tenantId],
	});

	const votesByContract = new Map<string, MemberVote[]>();
	for (const row of vRes.rows as any[]) {
		const threshold = String(row.threshold);
		const subjectId = row.subject_member_id ? String(row.subject_member_id) : null;
		// Eligibility mirrors castBallot exactly, so the button never offers a cast the
		// endpoint will reject: a sponsor vote is the sponsor's alone; any other vote is
		// open to every member of the circle except its subject.
		const canCast =
			threshold === 'sponsor'
				? String(row.invited_by ?? '') === memberId
				: subjectId !== memberId;

		const vote: MemberVote = {
			voteId: String(row.id),
			kind: String(row.kind) as MemberVoteKind,
			title: row.title ? String(row.title) : null,
			subjectName: row.subject_name ? String(row.subject_name) : null,
			closesAt: String(row.closes_at),
			canCast,
			mine: Boolean(row.voted),
		};
		const key = String(row.contract_id);
		const list = votesByContract.get(key);
		if (list) list.push(vote);
		else votesByContract.set(key, [vote]);
	}

	const circles: MemberCircle[] = (cRes.rows as any[]).map((c) => ({
		id: String(c.id),
		name: String(c.name),
		type: String(c.type),
		votes: votesByContract.get(String(c.id)) ?? [],
	}));

	return { tenantId, memberId, displayName, circles };
}
