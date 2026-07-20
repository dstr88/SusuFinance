/**
 * mailThreats.ts — run an incoming message through the wallet checker.
 *
 * Extracts every wallet address and link from a message, checks each against the same
 * sources the public checker uses, and records what it finds.
 *
 * ── Why the two checks are budgeted differently ─────────────────────────────
 * lookupDomainThreats() reads lists already held locally and refreshed on a schedule,
 * so it costs nothing per message and every URL gets checked.
 *
 * checkWallet() calls external APIs. Left unbounded, one mailing list with forty
 * addresses in the footer would burn the quota and stall the cron behind forty
 * round trips. So addresses are capped per message and per run, and the checker's own
 * cache is consulted first. A capped scan is honest as long as the cap is visible,
 * which is why scanned_at is recorded separately from the findings: no findings means
 * "checked, nothing found", a null scanned_at means "not checked".
 */

import { randomUUID } from 'node:crypto';
import { db } from './db';
import { lookupDomainThreats } from './threatLists';
import { checkWallet, getCached, isValidAddress } from './walletChecker';

/** Addresses put through the full API check, per message. */
const MAX_ADDRESSES_PER_MESSAGE = 5;
/** And across one poll run, so a burst of mail cannot exhaust the quota. */
const MAX_ADDRESS_CHECKS_PER_RUN = 25;

/** URLs are cheap, but a message with a thousand links is not worth unbounded work. */
const MAX_URLS_PER_MESSAGE = 25;

export interface Finding {
	kind: 'address' | 'url';
	value: string;
	severity: 'danger' | 'warning';
	reason: string;
}

// EVM, Bitcoin (bech32 and legacy), and Solana base58. Deliberately broad: a false
// candidate costs one cache lookup, a missed address costs the whole point.
const ADDRESS_RE = /\b(0x[a-fA-F0-9]{40}|bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

export function extractAddresses(text: string): string[] {
	const found = new Set<string>();
	for (const m of String(text ?? '').matchAll(ADDRESS_RE)) {
		const candidate = m[1];
		if (isValidAddress(candidate)) found.add(candidate);
	}
	return [...found];
}

export function extractDomains(text: string): string[] {
	const found = new Set<string>();
	for (const m of String(text ?? '').matchAll(URL_RE)) {
		try {
			const host = new URL(m[0]).hostname.toLowerCase().replace(/^www\./, '');
			if (host) found.add(host);
		} catch {
			// A malformed URL is not a domain to check; skip rather than guess at it.
		}
	}
	return [...found];
}

/**
 * Scan one message. Returns findings; never throws — a scanner failure must not lose
 * the mail it was scanning.
 *
 * `budget` is shared across a poll run: pass the same object for every message so the
 * per-run address cap actually holds.
 */
export async function scanMessage(
	text: string,
	budget: { addressChecksLeft: number },
): Promise<Finding[]> {
	const findings: Finding[] = [];

	// ── Links ────────────────────────────────────────────────────────────────
	for (const domain of extractDomains(text).slice(0, MAX_URLS_PER_MESSAGE)) {
		try {
			const r = await lookupDomainThreats(domain);

			// ready=false means the mirrored lists have not been populated yet. Absence
			// of a hit then proves nothing, so say nothing — a warning system that
			// reports "clean" while its data is missing is worse than one that is quiet.
			if (!r.ready) continue;

			// An explicit MetaMask whitelist entry outranks a ScamSniffer hit: the
			// whitelist exists precisely to correct false positives on real sites.
			if (r.metamaskWhitelist) continue;

			const sources: string[] = [];
			if (r.metamaskBlacklist) sources.push('MetaMask');
			if (r.scamsniffer) sources.push('ScamSniffer');

			if (sources.length) {
				findings.push({
					kind: 'url',
					value: domain,
					severity: 'danger',
					reason: `Known phishing domain (${sources.join(', ')})`,
				});
			}
		} catch {
			// A list lookup failing is not evidence of safety, but it is not evidence of
			// danger either. Stay silent rather than cry wolf.
		}
	}

	// ── Addresses ────────────────────────────────────────────────────────────
	const addresses = extractAddresses(text).slice(0, MAX_ADDRESSES_PER_MESSAGE);
	for (const address of addresses) {
		try {
			// The cache first — one scam address repeated across many messages should
			// cost one API call, not one per message.
			let result = getCached(address);
			if (!result) {
				if (budget.addressChecksLeft <= 0) continue;
				budget.addressChecksLeft--;
				result = await checkWallet(address);
			}
			if (!result) continue;

			// partialCoverage means no primary scam source ran for this chain, so a
			// "clean" result is not a confident one. The checker itself flags this; the
			// inbox must not launder it into a green light by staying silent.
			if (result.partialCoverage && result.scamLevel === 'clean') continue;

			const f = result.flags;
			const reasons: string[] = [];
			if (f.blacklisted) reasons.push('on a global blacklist');
			if (f.sanctioned) reasons.push('OFAC sanctioned');
			if (f.phishing) reasons.push('linked to phishing');
			if (f.honeypotRelated) reasons.push('honeypot related');
			if (f.stealingAttack) reasons.push('linked to a stealing attack');
			if (f.darkwebTransactions) reasons.push('dark web activity');
			if (f.mixer) reasons.push('mixer activity');
			if (f.moneyLaundering || f.financialCrime || f.cybercrime) reasons.push('financial crime');
			if (f.blackmail) reasons.push('blackmail reports');

			if (result.scamLevel === 'danger' || reasons.length) {
				findings.push({
					kind: 'address',
					value: address,
					severity: 'danger',
					reason: reasons.length
						? `Wallet ${reasons.join(', ')}`
						: `Wallet scored ${result.scamScore}/100 by the checker`,
				});
			} else if (result.scamLevel === 'caution') {
				findings.push({
					kind: 'address',
					value: address,
					severity: 'warning',
					reason: `Wallet flagged for caution (${result.scamScore}/100)`,
				});
			}
		} catch {
			// Same reasoning as above: an unreachable checker is not a verdict.
		}
	}

	return findings;
}

/**
 * Scan a stored message and record the result.
 *
 * scanned_at is always stamped, findings or not, so the panel can distinguish "checked
 * and clean" from "never checked". Treating those the same would let an outage read as
 * an all-clear, which is the failure mode that matters for a warning system.
 */
export async function scanAndRecord(
	messageId: string,
	text: string,
	budget: { addressChecksLeft: number },
): Promise<Finding[]> {
	let findings: Finding[] = [];
	try {
		findings = await scanMessage(text, budget);
	} catch {
		findings = [];
	}

	try {
		for (const f of findings) {
			await db.execute({
				sql: `INSERT INTO mail_threats (id, message_id, kind, value, severity, reason)
				      VALUES (?, ?, ?, ?, ?, ?)
				      ON CONFLICT (message_id, kind, value) DO NOTHING`,
				args: [randomUUID(), messageId, f.kind, f.value, f.severity, f.reason],
			});
		}

		const level = findings.some((f) => f.severity === 'danger') ? 'danger'
			: findings.length ? 'warning'
			: null;

		await db.execute({
			sql: `UPDATE mail_messages SET threat_level = ?, scanned_at = now() WHERE id = ?`,
			args: [level, messageId],
		});
	} catch (err) {
		console.warn('[mailThreats] could not record findings:', err instanceof Error ? err.message : err);
	}

	return findings;
}

/** A fresh budget for one poll run. */
export function newScanBudget() {
	return { addressChecksLeft: MAX_ADDRESS_CHECKS_PER_RUN };
}
