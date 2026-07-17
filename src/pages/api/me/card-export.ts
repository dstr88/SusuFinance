/**
 * GET /api/me/card-export — download HER signed susu card as JSON.
 *
 * The portable, verifiable artifact she carries to a lender. Scoped to her own login
 * (getMemberAccount resolves her own member row only), so a member can only ever
 * export her own record. The bundle is signed by SusuFinance's key when configured,
 * unsigned otherwise — never another party's key, never her key (she has none here).
 */

import type { APIRoute } from 'astro';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { getMemberAccount } from '@/lib/circles/memberAccount';
import { buildCardExport } from '@/lib/circles/cardExport';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

	try {
		const account = await getMemberAccount(userId);
		if (!account) return json({ ok: false, error: 'not_a_member' }, 403);

		const bundle = buildCardExport(account, new Date().toISOString());
		const date = bundle.manifest.generated_at.slice(0, 10);
		return new Response(JSON.stringify(bundle, null, 2), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="susu-card-${date}.json"`,
				'Cache-Control': 'no-store',
			},
		});
	} catch (err) {
		console.error('[api/me/card-export] failed', err);
		return json({ ok: false, error: 'export_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
