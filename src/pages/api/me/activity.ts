/**
 * GET /api/me/activity — a member sees the funds in and out of HER OWN wallet.
 *
 * The one guarantee that keeps this bookkeeping and not surveillance: the address is
 * read from HER member row (scoped by tenant_id + user_id), never taken from the
 * request. She cannot pass an address; this endpoint can only ever reveal her own
 * wallet's activity, to her. Owner→owner.
 *
 * SusuFinance holds no chain-reading code — it delegates the read to Almstins
 * (fetchAlmstinsActivity). A soft failure (no wallet set, chain unreachable, chain not
 * watched) still returns ok:true with a `reason`, so the panel shows a friendly line
 * instead of an error.
 */

import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { requireTenantSession } from '@/lib/requireTenantSession';
import { getAuthSession } from '@/lib/authSession';
import { fetchAlmstinsActivity } from '@/lib/circles/almstinsActivity';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
	const session = await requireTenantSession(request);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
	const auth = await getAuthSession(request).catch(() => null);
	const userId = auth?.user?.id ? String(auth.user.id) : '';
	if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

	try {
		// Her own wallet, from her own row. The address is NEVER read from the request.
		const res = await db.execute({
			sql: `SELECT wallet_address FROM members WHERE tenant_id = ? AND user_id = ? LIMIT 1`,
			args: [session.tenantId, userId],
		});
		if (!res.rows.length) return json({ ok: false, error: 'not_a_member' }, 403);
		const address = (res.rows[0] as any).wallet_address ? String((res.rows[0] as any).wallet_address) : '';
		if (!address) return json({ ok: true, address: null, activity: [], reason: 'no_address' });

		// Optional network hint for EVM (the same 0x… lives on every chain). Default
		// (undefined) → Almstins reads Ethereum. A chain switcher can pass ?network= later.
		const network = url.searchParams.get('network')?.trim() || undefined;
		const result = await fetchAlmstinsActivity(address, network);
		if (!result.ok) return json({ ok: true, address, activity: [], reason: result.reason });
		return json({
			ok: true,
			address,
			chain: result.chain,
			activity: result.activity,
			truncated: result.truncated,
		});
	} catch (err) {
		console.error('[api/me/activity] failed', err);
		return json({ ok: false, error: 'load_failed' }, 500);
	}
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
