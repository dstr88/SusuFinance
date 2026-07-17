/**
 * GET /api/me/circles — the member's own account, refreshed.
 *
 * The lobby server-seeds her account modal so it paints without a spinner; this is
 * what the modal refetches after she casts a ballot or opens a proposal, so the list
 * reflects what just happened. Scoped to her own member row (see getMemberAccount) —
 * a login only ever reads its own circles.
 *
 * `member: null` means this login is not a member of any programme (an operator, or
 * someone signed in but not yet joined). The modal renders nothing for them.
 */

import type { APIRoute } from 'astro';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { getMemberAccount } from '@/lib/circles/memberAccount';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return json({ ok: true, member: null, circles: [] });

	try {
		const account = await getMemberAccount(userId);
		if (!account) return json({ ok: true, member: null, circles: [] });
		return json({
			ok: true,
			member: {
				displayName: account.displayName,
				payoutAddress: account.payoutAddress,
				addressVerified: account.addressVerified,
			},
			circles: account.circles,
		});
	} catch (err) {
		console.error('[api/me/circles] failed', err);
		return json({ ok: false, error: 'load_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
