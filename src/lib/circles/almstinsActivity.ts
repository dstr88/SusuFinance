/**
 * Ask Almstins what has moved in and out of an address — the reading half of the
 * "watch my wallet" panel. SusuFinance carries NO chain-reading code (that is
 * Almstins' animal, the same way verification is Verify's); it delegates the read to
 * Almstins' secret-gated /api/verify/address-activity endpoint.
 *
 * This returns transaction FLOWS, so the endpoint is NOT public like Verify's lookup —
 * it needs a shared secret. The caller (/api/me/activity) is responsible for the other
 * half of the boundary: it reads the address from HER OWN member row, so a girl only
 * ever sees her own wallet's activity. Owner→owner: bookkeeping, never surveillance.
 *
 * Base is configurable (ALMSTINS_VERIFY_URL, same host as Verify). Fail-closed: no
 * secret, unreachable, or non-ok → a typed reason the panel renders as a soft message.
 */

const BASE = process.env.ALMSTINS_VERIFY_URL ?? 'https://almstins.com';
const SECRET = process.env.ADDRESS_ACTIVITY_SECRET ?? '';

export type ActivityItem = {
	direction: 'in' | 'out';
	amount: string;
	asset: string;
	counterparty: string;
	hash: string;
	timestamp: number;
};

export type ActivityFetch =
	| { ok: true; chain: string; activity: ActivityItem[]; truncated: boolean }
	| { ok: false; reason: 'unconfigured' | 'unsupported' | 'unavailable' };

export async function fetchAlmstinsActivity(address: string, network?: string): Promise<ActivityFetch> {
	const addr = (address ?? '').trim();
	if (!addr) return { ok: false, reason: 'unavailable' };
	// The endpoint is secret-gated; with no secret configured there is nothing to call.
	if (!SECRET) return { ok: false, reason: 'unconfigured' };

	const params = new URLSearchParams({ address: addr });
	if (network) params.set('network', network);
	const url = `${BASE.replace(/\/$/, '')}/api/verify/address-activity?${params.toString()}`;

	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 12000); // chain reads can be slow
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: { Accept: 'application/json', 'x-activity-secret': SECRET },
		});
		clearTimeout(timer);
		if (res.status === 422) return { ok: false, reason: 'unsupported' }; // chain not watched
		if (!res.ok) return { ok: false, reason: 'unavailable' };
		const data: any = await res.json();
		if (data?.ok !== true || !Array.isArray(data?.activity)) return { ok: false, reason: 'unavailable' };
		return {
			ok: true,
			chain: String(data.chain ?? ''),
			activity: data.activity as ActivityItem[],
			truncated: Boolean(data.truncated),
		};
	} catch {
		return { ok: false, reason: 'unavailable' };
	}
}
