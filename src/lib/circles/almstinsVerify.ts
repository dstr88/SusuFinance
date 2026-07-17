/**
 * Accept a payout address that is already proven with Almstins Verify.
 *
 * A second path to the same badge: instead of (or before) observing a fresh self-send,
 * ask Almstins' public Verify lookup whether this address has been proven as someone's
 * destination. If yes, SusuFinance accepts it. Read-only, one GET, no key handled here.
 *
 * ── The trust nuance (deliberate, documented) ────────────────────────────────
 *
 * The self-send check proves CURRENT control — a self-send in the last few hours, so
 * whoever claims the address must hold its key now. Almstins "verified" is PERSISTENT:
 * the address was proven once and published, not necessarily by this member. So this
 * is a slightly weaker binding — fine as a convenience for a member who already uses
 * Verify, and low-risk for a payout target (a misdirected pot benefits no attacker),
 * but it is not the same guarantee as a fresh self-send.
 *
 * Cross-product call by design: Donnie owns both products and is pressure-testing
 * Verify through SusuFinance. Base is configurable (ALMSTINS_VERIFY_URL) so it can
 * point at a staging Almstins. Fail-closed: unreachable / not-ok → false, and the
 * caller falls through to the self-send path.
 */

const BASE = process.env.ALMSTINS_VERIFY_URL ?? 'https://almstins.com';

export async function checkAlmstinsVerify(address: string): Promise<boolean> {
	const addr = address.trim();
	if (!addr) return false;
	const url = `${BASE.replace(/\/$/, '')}/api/verify/lookup?address=${encodeURIComponent(addr)}`;
	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 6000);
		const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
		clearTimeout(timer);
		if (!res.ok) return false;
		const data: any = await res.json();
		return data?.ok === true && data?.verified === true;
	} catch {
		return false;
	}
}
