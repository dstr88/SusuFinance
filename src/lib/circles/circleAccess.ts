/**
 * circleAccess.ts — may this login see a programme's circles at all?
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 *
 * Every circle surface used to gate on requireTenantSession alone, which answers
 * "does this session have a tenant?" — and having a tenant turned out to be much
 * easier to obtain than being approved by anybody.
 *
 * /api/circles/join-request set `auth_users.active_tenant_id` the moment a stranger
 * SUBMITTED a request, before her sponsor answered. So anyone who signed up, guessed
 * a circle's name and one member's display name, got a tenant on the spot and could
 * open /dashboard/circles and read every circle in the programme — member counts,
 * cadences, amounts, round state — while her admission was still pending. Approval
 * gated her MEMBERSHIP; it never gated her ACCESS.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 *
 * A tenant is not an entitlement. Access to programme data requires one of:
 *
 *   · the demo session, which exists to showcase the operator panel
 *   · owner/admin of the tenant — the operator
 *   · a live contract_members row — she was admitted by a vote
 *
 * A pending candidate has a `members` row (join-request creates one so a vote has a
 * subject) but NO contract_members row until admitMember inserts it. That row is
 * therefore the honest test, and it is the same row the constitution already treats
 * as "is she in the circle" everywhere else.
 *
 * Waiting is not a failure state to hide. A refused caller is sent to the lobby,
 * which now says where she stands.
 */

import { db } from '@/lib/db';
import { DEMO_TENANT_ID } from '@/lib/demo';
import { getAuthSession } from '@/lib/authSession';
import { requireTenantSession } from '@/lib/requireTenantSession';

export async function hasCircleAccess(
	tenantId: string,
	userId: string,
	isDemo = false,
): Promise<boolean> {
	if (isDemo || tenantId === DEMO_TENANT_ID) return true;
	if (!tenantId || !userId) return false;

	// The operator. Checked first: he has no member row of his own, so the membership
	// query below would refuse him.
	const role = await db.execute({
		sql: `SELECT role FROM tenant_memberships
		       WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
		args: [tenantId, userId],
	});
	const r = role.rows[0] ? String((role.rows[0] as any).role ?? '') : '';
	if (r === 'owner' || r === 'admin') return true;

	// Admitted to at least one circle in this programme. `left_at IS NULL` because an
	// expelled member's row survives for the record and must not keep her inside.
	const member = await db.execute({
		sql: `SELECT 1
		        FROM contract_members cm
		        JOIN members m ON m.id = cm.member_id AND m.tenant_id = cm.tenant_id
		       WHERE cm.tenant_id = ? AND m.user_id = ? AND cm.left_at IS NULL
		       LIMIT 1`,
		args: [tenantId, userId],
	});
	return member.rows.length > 0;
}

/**
 * The whole gate for a circle page, in one call.
 *
 * Returns null when the caller may proceed, or the path to redirect to.
 *
 * Two destinations, and choosing between them matters more than it looks. The pages
 * used to send every failure to `/login?next=…`, which is right for a stranger and a
 * TRAP for someone already signed in with no programme: she signs in, arrives, is
 * refused, is sent back to sign in. The same chicken-and-egg that once made a third
 * human unable to log in at all (see tenants.ts, BOOTSTRAP_OWNERS).
 *
 * So: not signed in → login. Signed in but not admitted → the lobby, which tells her
 * she is waiting on her sponsor instead of looping her through a door she is already
 * through.
 */
export async function circleGateTarget(
	request: Request,
	nextPath: string,
): Promise<{ redirect: string } | { session: { tenantId: string; isDemo?: boolean }; userId: string }> {
	const session = await requireTenantSession(request);
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';

	if (!session) {
		return { redirect: userId ? '/dashboard/lobby' : `/login?next=${nextPath}` };
	}
	if (!(await hasCircleAccess(session.tenantId, userId, session.isDemo))) {
		return { redirect: '/dashboard/lobby' };
	}
	return { session, userId };
}
