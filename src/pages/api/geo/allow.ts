/**
 * GET /api/geo/allow?token=<secret> — set the "my computer" geo-bypass cookie.
 *
 * When GEOBLOCK_AFRICA_ONLY is on, every non-African IP gets the 451 — including
 * Donnie's, in the US. This is how he lets his own machine through: visit this URL
 * once with the secret, and a long-lived cookie thereafter carries him past the
 * geoblock from anywhere, surviving IP changes.
 *
 * The route is exempt from the geoblock (see geoblock.ts) so a blocked visitor can
 * reach it — but it only sets a working cookie when the token matches the server
 * secret, so exempting it leaks nothing. A wrong/absent token sets no cookie.
 *
 * The cookie's VALUE is the secret itself; the geoblock compares cookie === env.
 * So there is nothing to guess that the holder doesn't already know.
 */

import type { APIRoute } from 'astro';
import { GEO_BYPASS_COOKIE } from '../../../middleware/geoblock';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
	const secret = (
		(process.env as Record<string, string | undefined>).GEOBLOCK_BYPASS_TOKEN ??
		(import.meta.env as Record<string, string | undefined>).GEOBLOCK_BYPASS_TOKEN ??
		''
	).toString().trim();

	const given = (url.searchParams.get('token') ?? '').trim();

	// No secret configured, or wrong token → do nothing. Deliberately vague: this
	// endpoint neither confirms nor denies whether a secret exists.
	if (!secret || given !== secret) {
		return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	}

	// Cookie value = the secret. httpOnly so page scripts can't read it; Secure in
	// production; SameSite=Lax so it rides top-level navigations; a year long.
	const isHttps = url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
	const cookie = [
		`${GEO_BYPASS_COOKIE}=${secret}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		'Max-Age=31536000',
		isHttps ? 'Secure' : '',
	].filter(Boolean).join('; ');

	// Straight to the homepage — the point is to browse, now unblocked.
	return new Response(null, {
		status: 303,
		headers: {
			Location: '/',
			'Set-Cookie': cookie,
			'Cache-Control': 'no-store',
		},
	});
};
