/**
 * The signed susu card — her record, made portable (SusuData §4/§5d).
 *
 * "Her export is what spans tins, and she carries it." The on-screen card is
 * within-circle; THIS is the cross-circle artifact — every circle's card in one
 * signed document she hands to a lender. It is the one place her record is allowed to
 * aggregate across circles, because it is HER disclosing HER OWN record to a party she
 * chose: owner → world, voluntary self-disclosure — the explicitly-encouraged
 * direction of the no-attribution line, never surveillance.
 *
 * ── Why her name is in the clear here (and not in the year-summary proof) ─────────
 *
 * The record-proof manifest for tax reports is deliberately PII-free: it travels as a
 * correlation-resistant attestation. This one is the opposite by design — she WANTS
 * the lender to see it is her card. So the manifest carries her chosen display name.
 * No third party is named; no address is attributed to anyone. She discloses herself.
 *
 * ── What the signature attests ───────────────────────────────────────────────────
 *
 * ORIGIN — signed by SusuFinance's published Ed25519 key — and INTEGRITY — the record
 * is byte-for-byte what SusuFinance emitted. It does NOT attest creditworthiness or
 * fitness for any lending decision; that judgment is the lender's. Fail-open to
 * UNSIGNED when no key is configured (the verifier reports "unsigned", never a false
 * "verified") — an unconfigured deploy ships an unsigned card, it does not crash.
 *
 * Reuses the record-proof signing primitives verbatim; no Merkle tree — a card is one
 * small whole artifact, not a many-line report needing selective disclosure.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import {
	canonicalManifestBytes,
	signManifest,
	verifyManifestSignature,
	getSigningKeyId,
	SIGNING_ALG,
} from '@/lib/recordProof/signing';
import type { MemberAccount } from '@/lib/circles/memberAccount';
import type { SlotState } from '@/lib/circles/slotGlyph';

export const CARD_FORMAT = 'susufinance-card-v1' as const;
const APP_BASE = process.env.APP_URL ?? 'https://susufinance.com';

export const CARD_DISCLAIMER =
	'This document is digitally signed by SusuFinance. A valid signature attests ORIGIN ' +
	'(it came from SusuFinance) and INTEGRITY (it is unaltered since signing). It is the ' +
	"cardholder's own record of contributions observed on-chain in these circles, disclosed " +
	'by her. It does NOT attest creditworthiness or fitness for any lending decision.';

export interface CardExportCircle {
	name: string;
	type: string;
	joined_at: string | null;
	cycle_length: number;
	current_cycle: number;
	slots: SlotState[];
	lifetime: {
		on_time: number;
		late: number;
		repaid: number;
		missed: number;
		cycles_completed: number;
	};
}

export interface CardManifest {
	v: number;
	record_type: 'susu_card';
	/** She discloses herself: her chosen name (or null), plus a stable opaque tag. */
	subject: { member_tag: string; display_name: string | null };
	circles: CardExportCircle[];
	generated_at: string;
	signing_key_id: string | null;
	schema_version: string;
	verify_url: string;
	disclaimer: string;
}

export interface CardBundle {
	format: typeof CARD_FORMAT;
	manifest: CardManifest;
	signature: { alg: typeof SIGNING_ALG; key_id: string; signature_hex: string } | null;
}

/** Opaque, non-reversible tag for the member — a stable record id that is not the raw
 *  member UUID. Her name travels in the clear (by design); this is just correlation. */
export function memberTag(memberId: string): string {
	return 'mt-' + bytesToHex(sha256(utf8ToBytes('susufinance-card-member:' + memberId))).slice(0, 24);
}

/** The signed surface — the manifest minus purely presentational fields. Identical
 *  split on both sides (build + verify) or the signature would never match. */
export function signedCardView(m: CardManifest): Omit<CardManifest, 'verify_url' | 'disclaimer'> {
	const { verify_url: _v, disclaimer: _d, ...signed } = m;
	return signed;
}

/** Build (and sign, if a key is configured) the cross-circle card export. */
export function buildCardExport(account: MemberAccount, generatedAt: string): CardBundle {
	const circles: CardExportCircle[] = account.circles.map((c) => ({
		name: c.name,
		type: c.type,
		joined_at: c.card?.joinedAt ?? null,
		cycle_length: c.card?.cycleLength ?? 0,
		current_cycle: c.card?.currentCycle ?? 1,
		slots: c.card?.slots ?? [],
		lifetime: {
			on_time: c.card?.lifetime.onTime ?? 0,
			late: c.card?.lifetime.late ?? 0,
			repaid: c.card?.lifetime.repaid ?? 0,
			missed: c.card?.lifetime.missed ?? 0,
			cycles_completed: c.card?.lifetime.cyclesCompleted ?? 0,
		},
	}));

	const manifest: CardManifest = {
		v: 1,
		record_type: 'susu_card',
		subject: { member_tag: memberTag(account.memberId), display_name: account.displayName },
		circles,
		generated_at: generatedAt,
		signing_key_id: getSigningKeyId(),
		schema_version: '1',
		verify_url: `${APP_BASE}/.well-known/almstins-signing-key.json`,
		disclaimer: CARD_DISCLAIMER,
	};

	const sig = signManifest(canonicalManifestBytes(signedCardView(manifest)));
	const signature = sig ? { alg: sig.alg, key_id: sig.keyId, signature_hex: sig.signatureHex } : null;
	return { format: CARD_FORMAT, manifest, signature };
}

export type CardVerdict = 'verified' | 'unverifiable' | 'tampered';
export type CardVerifyCode = 'ok' | 'unsigned' | 'unknown_key' | 'bad_signature' | 'malformed';
export interface PublishedKey { key_id: string; public_key_hex: string }
export interface CardVerifyOutcome {
	verdict: CardVerdict;
	code: CardVerifyCode;
	signing_key_id: string | null;
	generated_at: string | null;
}

/**
 * Verify a card bundle against published keys. Isomorphic-safe (only @noble +
 * canonicalize via the signing module's verify helper). Unsigned or unknown key →
 * 'unverifiable' (never a false 'verified'); bad signature → 'tampered'.
 */
export function verifyCardExport(bundle: CardBundle, publishedKeys: PublishedKey[] = []): CardVerifyOutcome {
	if (!bundle || typeof bundle !== 'object' || !bundle.manifest || bundle.format !== CARD_FORMAT) {
		return { verdict: 'unverifiable', code: 'malformed', signing_key_id: null, generated_at: null };
	}
	const m = bundle.manifest;
	const gen = m.generated_at ?? null;
	if (!bundle.signature) {
		return { verdict: 'unverifiable', code: 'unsigned', signing_key_id: null, generated_at: gen };
	}
	const key = publishedKeys.find((k) => k.key_id === bundle.signature!.key_id);
	if (!key) {
		return { verdict: 'unverifiable', code: 'unknown_key', signing_key_id: bundle.signature.key_id, generated_at: gen };
	}
	const ok = verifyManifestSignature(
		canonicalManifestBytes(signedCardView(m)),
		bundle.signature.signature_hex,
		key.public_key_hex,
	);
	return ok
		? { verdict: 'verified', code: 'ok', signing_key_id: key.key_id, generated_at: gen }
		: { verdict: 'tampered', code: 'bad_signature', signing_key_id: key.key_id, generated_at: gen };
}
