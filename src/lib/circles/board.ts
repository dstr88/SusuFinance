/**
 * board.ts — the data behind the signup task bar and the circle tins.
 *
 * "Signups" are members who exist but belong to no circle yet: a row in `members`
 * with no live `contract_members` row. That is the natural holding state between
 * someone registering and the group deciding what to do with them, and it needs no
 * new table — the absence IS the state.
 *
 * ── Tenant scoping ──────────────────────────────────────────────────────────
 * Every function here takes tenantId explicitly and filters on it. That is not
 * belt-and-braces: /admin deliberately runs with NO tenant context so its
 * cross-tenant counts work, which means the RLS backstop other pages rely on is
 * absent here. Dragging a member from one tenant into another tenant's circle would
 * be exactly the isolation break the architecture forbids, so the filter is the only
 * thing standing between this feature and that bug. Never remove it, and never derive
 * the tenant from a request body.
 */

import { db } from '../db';
import { randomUUID } from 'node:crypto';

export interface Signup {
	memberId: string;
	displayName: string | null;
	email: string | null;
	createdAt: string;
	/** True once an admission vote is open for them somewhere — they are spoken for. */
	pendingVote: boolean;
}

export interface BoardCircle {
	id: string;
	name: string;
	type: 'circle' | 'target_group';
	status: 'forming' | 'active' | 'completed' | 'abandoned';
	cadence: string;
	expectedAmount: string;
	currency: string;
	memberCount: number;
}

/** People with no live circle membership — the contents of the task bar. */
export async function getSignups(tenantId: string): Promise<Signup[]> {
	const r = await db.execute({
		sql: `SELECT m.id, m.display_name, m.email, m.created_at,
		             EXISTS (
		               SELECT 1 FROM circle_votes v
		               WHERE v.tenant_id = m.tenant_id
		                 AND v.subject_member_id = m.id
		                 AND v.status = 'open'
		             ) AS pending_vote
		      FROM members m
		      WHERE m.tenant_id = ?
		        AND NOT EXISTS (
		          SELECT 1 FROM contract_members cm
		          WHERE cm.tenant_id = m.tenant_id
		            AND cm.member_id = m.id
		            AND cm.left_at IS NULL
		        )
		      ORDER BY m.created_at DESC`,
		args: [tenantId],
	});

	return (r.rows as Record<string, unknown>[]).map((row) => ({
		memberId: String(row.id),
		displayName: row.display_name ? String(row.display_name) : null,
		email: row.email ? String(row.email) : null,
		createdAt: String(row.created_at),
		pendingVote: Boolean(row.pending_vote),
	}));
}

/** The circles this tenant runs, as tins. */
export async function getBoardCircles(tenantId: string): Promise<BoardCircle[]> {
	const r = await db.execute({
		sql: `SELECT c.id, c.name, c.type, c.status, c.cadence, c.expected_amount, c.currency,
		             (SELECT COUNT(*) FROM contract_members cm
		               WHERE cm.tenant_id = c.tenant_id
		                 AND cm.contract_id = c.id
		                 AND cm.left_at IS NULL) AS member_count
		      FROM contracts c
		      WHERE c.tenant_id = ?
		        AND c.status IN ('forming', 'active')
		      ORDER BY
		        -- Forming first: those are the ones that accept a drop directly, so they
		        -- are what the operator is reaching for when dragging someone in.
		        CASE c.status WHEN 'forming' THEN 0 ELSE 1 END,
		        c.created_at DESC`,
		args: [tenantId],
	});

	return (r.rows as Record<string, unknown>[]).map((row) => ({
		id: String(row.id),
		name: String(row.name),
		type: row.type as BoardCircle['type'],
		status: row.status as BoardCircle['status'],
		cadence: String(row.cadence),
		expectedAmount: String(row.expected_amount),
		currency: String(row.currency),
		memberCount: Number(row.member_count ?? 0),
	}));
}

/**
 * Seat a member in a FORMING circle.
 *
 * Only legal while forming — §5a organizer seeding. Once a circle is active the group
 * decides admissions by vote, and the caller must route there instead. This function
 * refuses rather than trusting the caller to have checked.
 */
export async function seatMember(
	tenantId: string, contractId: string, memberId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const c = await db.execute({
		sql: `SELECT status FROM contracts WHERE tenant_id = ? AND id = ? LIMIT 1`,
		args: [tenantId, contractId],
	});
	const status = (c.rows[0] as Record<string, unknown> | undefined)?.status;
	if (!status) return { ok: false, error: 'No such circle.' };
	if (status !== 'forming') {
		return { ok: false, error: 'That circle is active — admission is the group’s decision.' };
	}

	await db.execute({
		sql: `INSERT INTO contract_members (tenant_id, contract_id, member_id, joined_at)
		      SELECT ?, ?, ?, now()
		      WHERE NOT EXISTS (
		        SELECT 1 FROM contract_members
		        WHERE tenant_id = ? AND contract_id = ? AND member_id = ? AND left_at IS NULL
		      )`,
		args: [tenantId, contractId, memberId, tenantId, contractId, memberId],
	});

	return { ok: true };
}

export interface NewGroupInput {
	tenantId: string;
	name: string;
	expectedAmount: string;
	cadence: 'weekly' | 'biweekly' | 'monthly';
	currency?: string;
	memberIds: string[];
}

/**
 * Create a forming circle and seat the selected people in it — the "generate group"
 * action, for when several people sign up together.
 *
 * Deliberately requires an amount and a cadence rather than defaulting them. A susu
 * circle with a made-up contribution figure is not a draft, it is wrong data that
 * somebody will later mistake for a decision. Better to ask two questions up front.
 */
export async function createGroup(
	input: NewGroupInput,
): Promise<{ ok: true; contractId: string } | { ok: false; error: string }> {
	const { tenantId, name, expectedAmount, cadence, memberIds } = input;

	if (!name.trim()) return { ok: false, error: 'Give the group a name.' };
	if (!(Number(expectedAmount) > 0)) return { ok: false, error: 'Contribution must be greater than zero.' };

	const contractId = randomUUID();
	await db.execute({
		sql: `INSERT INTO contracts (id, tenant_id, type, name, currency, expected_amount, cadence, status)
		      VALUES (?, ?, 'circle', ?, ?, ?, ?, 'forming')`,
		args: [contractId, tenantId, name.trim(), input.currency ?? 'USDC', expectedAmount, cadence],
	});

	// Seated one at a time through seatMember so the forming check and the
	// already-a-member guard apply here too, rather than being duplicated.
	for (const memberId of memberIds) {
		await seatMember(tenantId, contractId, memberId);
	}

	return { ok: true, contractId };
}
