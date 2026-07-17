/**
 * Self-send proof — observe-only address verification (SusuData §3).
 *
 * She proves she controls her payout wallet by SENDING a tiny amount from it TO
 * ITSELF (a self-send). Only the key holder can sign an outgoing transaction, so an
 * observed self-send from her address proves control — and because it goes to
 * herself, SusuFinance receives nothing and holds nothing. "Self-send + observe, not
 * Almstins-sends: direction is the whole game." Read-only, no custody, intact.
 *
 * This is the ONLY chain read that survived the crypto-tracker removal, and it is a
 * single narrow query — a recent self-send exists, yes or no — never balances,
 * history, or holdings. It is not the return of the wallet tracker.
 *
 * EVM only for now: a self-send is observable on any Etherscan-v2 chain via one call.
 * Bitcoin/Solana payout addresses stay unverified until their own reader is added.
 * Fail-closed: no API key, or the explorer is unreachable → "unavailable", never a
 * false "verified".
 */

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// A small set of common EVM chains where a USDC circle's payouts are likely to live.
// Etherscan v2 is one endpoint + one key, keyed by chainid. Checked in rough order of
// likelihood, with early-exit on the first match.
const CHAINS: { id: number; name: string }[] = [
	{ id: 137, name: 'polygon' },
	{ id: 8453, name: 'base' },
	{ id: 1, name: 'ethereum' },
	{ id: 42161, name: 'arbitrum' },
	{ id: 10, name: 'optimism' },
];

export type SelfSendResult =
	| { status: 'verified'; chain: string }
	| { status: 'not_found' }
	| { status: 'unsupported' } // non-EVM address
	| { status: 'unavailable' }; // no key / explorer unreachable

function apiKey(): string {
	return process.env.ETHERSCAN_API_KEY ?? '';
}

/**
 * Has this address made a self-send (from == to == address) since `sinceUnix`?
 * Returns the chain it was seen on, or a non-verified status.
 */
export async function checkSelfSend(address: string, sinceUnix: number): Promise<SelfSendResult> {
	const addr = address.trim().toLowerCase();
	if (!EVM_ADDRESS_RE.test(addr)) return { status: 'unsupported' };
	const key = apiKey();
	if (!key) return { status: 'unavailable' };

	let anyReachable = false;
	for (const chain of CHAINS) {
		const found = await selfSendOnChain(addr, sinceUnix, chain.id, key);
		if (found === 'error') continue; // this chain unreachable; try the next
		anyReachable = true;
		if (found) return { status: 'verified', chain: chain.name };
	}
	// Reached every chain and saw no self-send → genuinely not found. Reached none →
	// the explorer is down, so we cannot claim "not found" honestly.
	return anyReachable ? { status: 'not_found' } : { status: 'unavailable' };
}

/** One chain: fetch recent normal txns and look for a self-send after `sinceUnix`. */
async function selfSendOnChain(
	addr: string,
	sinceUnix: number,
	chainId: number,
	key: string,
): Promise<boolean | 'error'> {
	const url =
		`https://api.etherscan.io/v2/api?chainid=${chainId}` +
		`&module=account&action=txlist&address=${addr}` +
		`&startblock=0&endblock=99999999&page=1&offset=30&sort=desc&apikey=${key}`;
	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 8000);
		const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
		clearTimeout(timer);
		if (!res.ok) return 'error';
		const data: any = await res.json();
		// status '0' with an empty result is a normal "no transactions" — not an error.
		const rows: any[] = Array.isArray(data?.result) ? data.result : [];
		if (data?.status !== '1' && rows.length === 0) {
			// "No transactions found" is a valid answer (reachable, just nothing yet).
			return typeof data?.message === 'string' && /no transactions/i.test(data.message) ? false : 'error';
		}
		return rows.some(
			(tx) =>
				String(tx?.from ?? '').toLowerCase() === addr &&
				String(tx?.to ?? '').toLowerCase() === addr &&
				String(tx?.isError ?? '0') === '0' &&
				Number(tx?.timeStamp ?? 0) >= sinceUnix,
		);
	} catch {
		return 'error';
	}
}
