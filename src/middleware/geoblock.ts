// Sanctions geo-blocking — local lookup via geoip-lite (bundled MaxMind data).
//
// Returns a 451 (Unavailable For Legal Reasons) response when a request comes
// from a comprehensively-sanctioned jurisdiction, otherwise null.
//
// Detection is a fully LOCAL lookup — no external API, no token, no DB — so the
// block can't be silently disabled by a missing key. geoip-lite returns both
// country AND region, which lets us block the sanctioned *regions* of Ukraine
// (Crimea / Sevastopol / Donetsk / Luhansk) without blocking the whole country.
//
// FAIL-CLOSED for public IPs: if a public client IP cannot be resolved to a
// country, or the lookup throws, the request is REFUSED (451) rather than let
// through — the conservative sanctions posture. Internal/private IPs (health
// checks, backend calls) are exempt so infra traffic is never blocked. geoip-lite
// resolves the vast majority of public IPv4/IPv6, so this rarely turns away a
// legitimate visitor; when it does, it is the deliberate compliance tradeoff.
//
// BEST-EFFORT for the UA regions: many occupied-region IPs route through Russian
// networks and geolocate to RU, so this catches only the subset that still
// resolves to UA. The ToS region attestation is the dependable control; this is
// a supplement on top of it.

import geoip from 'geoip-lite';
import { getClientIp } from '../lib/analytics/ip';

// OFAC comprehensively-sanctioned countries — ISO-3166-1 alpha-2.
//   CU Cuba · IR Iran · KP North Korea · SY Syria
export const BLOCKED_COUNTRIES = new Set<string>(['CU', 'IR', 'KP', 'SY']);

// OFAC "Covered Regions" of Ukraine — ISO-3166-2 subdivision codes.
//   43 Crimea · 40 Sevastopol · 14 Donetsk · 09 Luhansk · 65 Kherson · 23 Zaporizhzhia
// (Original four confirmed against geoip-lite output, e.g. a Sevastopol IP → UA/"40";
//  Kherson/Zaporizhzhia added to match OFAC's late-2022 extension of the covered
//  regions. As with Donetsk/Luhansk, geoip can't distinguish occupied from
//  Ukrainian-controlled areas within an oblast, so the whole oblast is blocked.)
export const BLOCKED_UA_REGIONS = new Set<string>(['43', '40', '14', '09', '65', '23']);

export function isBlockedLocation(country: string, region: string): boolean {
	if (BLOCKED_COUNTRIES.has(country)) return true;
	if (country === 'UA' && BLOCKED_UA_REGIONS.has(region)) return true;
	return false;
}

// ── Africa-only mode ─────────────────────────────────────────────────────────
//
// When GEOBLOCK_AFRICA_ONLY is on, the sanctions BLOCKLIST becomes an ALLOWLIST:
// only visitors geolocating to an African country pass; everyone else gets the
// 451. Decided Jul 16 (SusuData §1): "Scope: Africa. No one else is welcome."
//
// OFF by default. This is a fail-closed, continent-wide access rule on top of
// geoip data that is imperfect for African mobile carriers (some Ghana ranges
// resolve to the wrong African country — harmless, still allowed — but some
// resolve to NULL, which fail-closes to a block). It must be switched on
// deliberately in Render and tested against a real Ghana connection BEFORE it is
// trusted, or it can turn away the pilot. Unset the env to revert instantly, no
// deploy.
//
// The DIASPORA cost is real and intended-with-eyes-open: a Ghanaian in London or
// a Nigerian in Houston sits on a non-African IP and is blocked. The scope note
// includes the diaspora; this rule, while on, excludes them. Revisit before any
// diaspora push.
const AFRICA_ISO = new Set<string>([
	// 54 UN member states
	'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD',
	'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE',
	'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG',
	'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG',
	'ZM', 'ZW',
	// Inhabited African territories geoip-lite may emit
	'EH', 'RE', 'YT', 'SH',
]);

function envFlag(name: string): boolean {
	const raw = ((process.env as Record<string, string | undefined>)[name] ??
		(import.meta.env as Record<string, string | undefined>)[name] ?? '')
		.toString().trim().toLowerCase();
	return raw === '1' || raw === 'true' || raw === 'on';
}

function bypassToken(): string {
	return ((process.env as Record<string, string | undefined>).GEOBLOCK_BYPASS_TOKEN ??
		(import.meta.env as Record<string, string | undefined>).GEOBLOCK_BYPASS_TOKEN ?? '')
		.toString().trim();
}

/** "My computer" — a secret cookie, so Donnie (a non-African IP, otherwise
 *  blocked) reaches his own site from anywhere, and it survives IP changes.
 *  Set once via /api/geo/allow?token=… which validates against the same secret.
 *  Empty token → no bypass exists (cannot be enabled by an empty string). */
export const GEO_BYPASS_COOKIE = 'sf-geo-pass';
export function hasGeoBypass(request: Request): boolean {
	const token = bypassToken();
	if (!token) return false;
	const cookie = request.headers.get('cookie') ?? '';
	for (const part of cookie.split(';')) {
		const [k, ...v] = part.trim().split('=');
		if (k === GEO_BYPASS_COOKIE && v.join('=') === token) return true;
	}
	return false;
}

const BLOCKED_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Not available in your region</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0f1a;color:#f5f8ff;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px}
  main{max-width:480px;text-align:center}
  h1{font-size:1.4rem;margin:0 0 12px}
  p{color:rgba(245,248,255,0.7);line-height:1.6;margin:0 0 10px}
  .muted{font-size:0.85rem;color:rgba(245,248,255,0.45)}
</style></head>
<body><main>
  <h1>SusuFinance isn't available in your region</h1>
  <p>For legal and compliance reasons, SusuFinance cannot be offered in your location. We're sorry for the inconvenience.</p>
  <p class="muted">If you believe this is an error, contact support@titaniumhut.com.</p>
</main></body></html>`;

/** Internal / private / loopback IPs — infra traffic (health checks, backend
 * calls), never a foreign visitor. Exempt from geo-blocking. */
function isPrivateIp(ip: string): boolean {
	return (
		ip === '127.0.0.1' || ip === '::1' ||
		ip.startsWith('10.') ||
		ip.startsWith('192.168.') ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||       // 172.16.0.0/12
		ip.startsWith('169.254.') ||                    // link-local
		/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) || // 100.64.0.0/10 CGNAT
		/^f[cd]/i.test(ip) || ip.toLowerCase().startsWith('fe80') // IPv6 ULA / link-local
	);
}

/** The 451 block page. Exported so the middleware can fail closed if the geo
 * check itself errors (e.g. the module can't load). */
export function geoblockedResponse(): Response {
	return new Response(BLOCKED_PAGE, {
		status: 451,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	});
}

/**
 * Returns a 451 Response if the request's location is sanctioned OR cannot be
 * verified (fail-closed for public IPs), else null. Does not throw — internal
 * lookup errors resolve to a block.
 */
export async function getGeoblockResponse(request: Request): Promise<Response | null> {
	// The cookie-setting endpoint must stay reachable even to a blocked visitor —
	// it is how Donnie (blocked as a non-African IP) sets the bypass in the first
	// place. It validates the secret itself, so exempting it leaks nothing.
	const { pathname } = new URL(request.url);
	if (pathname === '/api/geo/allow') return null;

	// "My computer" — the secret bypass cookie wins over any geo rule, from anywhere.
	if (hasGeoBypass(request)) return null;

	const ip = getClientIp(request);
	// No IP, or an internal/private IP → not a foreign visitor; allow.
	if (!ip || isPrivateIp(ip)) return null;

	let geo: ReturnType<typeof geoip.lookup>;
	try {
		geo = geoip.lookup(ip);
	} catch {
		return geoblockedResponse(); // FAIL-CLOSED: public IP we couldn't check
	}

	// FAIL-CLOSED: a public IP with no country data is treated as unverified.
	if (!geo || !geo.country) return geoblockedResponse();

	// Sanctions block (always on).
	if (isBlockedLocation(geo.country, geo.region)) return geoblockedResponse();

	// Africa-only (opt-in): the blocklist becomes an allowlist. Anyone geolocating
	// outside Africa is refused. Off unless GEOBLOCK_AFRICA_ONLY is set.
	if (envFlag('GEOBLOCK_AFRICA_ONLY') && !AFRICA_ISO.has(geo.country)) {
		return geoblockedResponse();
	}

	return null;
}
