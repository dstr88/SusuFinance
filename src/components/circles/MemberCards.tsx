// MemberCards — the tin, opened. One card per member: her standing in THIS circle.
//
// A card is her standing in one group. A woman in three circles has three cards —
// and they are not strangers to each other: her history goes with her, her rotation
// does not. Each card shows the same record, because the record is hers, derived
// from her contributions across every circle. What differs card to card is her turn
// slot and her stars for that group's current cycle. She never starts from zero.
//
// ── What is deliberately not here ────────────────────────────────────────────
//
// No stars. No payment history. No totals, no net, no on-time-vs-late counts.
// Her record belongs to her and lives on her screen, for her to show a lender when
// SHE decides it is time. §5a already said who polices payment: "inside the circle
// = full shared ledger (transparency IS the enforcement)". The circle sees, the
// circle enforces. The operator administers — he does not supervise.
//
// The card answers his actual questions and stops: who is she, is she still in the
// group, whose turn is it, is her payout address verified, and (once circle_votes
// exists) is a vote open on her joining or leaving.
//
// The API does not return her record, so this component could not render it even if
// someone tried. The guarantee is what is absent.

import { useCallback, useEffect, useState } from 'react';
import { getCirclesLocale } from '@/i18n/dashboard/circles';
import type { Lang } from '@/lib/i18n/locale';
import './MemberCards.css';

interface Member {
	id: string;
	displayName: string | null;
	joinedAt: string | null;
	leftAt: string | null;
	turnOrder: number | null;
	payoutVerified: boolean;
	/** Where her turn pays. The operator sets it for a member who has not claimed a
	 *  login yet; once she claims, she manages it herself. */
	payoutAddress: string | null;
	isRecipientOfOpenRound: boolean;
	/** Has she bound a login? A seeded member (false) can be handed a claim link. */
	claimed: boolean;
}
interface Round { index: number; dueDate: string; status: string; recipientId: string | null; payoutObserved: boolean; payoutFrozen: boolean }
/** No `detail`: the admin feed renders action + actor only, and the endpoint
 *  does not return the rest. */
interface Evt { actor: string | null; action: string; at: string }
interface Payload {
	contract: {
		id: string; type: string; name: string; currency: string; cadence: string; status: string;
		expectedAmount: number; totalRounds: number;
		/** Turn slots in one rotation — what a turn is counted against. */
		cycleLength: number;
		currentCycle: number;
		totalCycles: number;
	};
	members: Member[];
	rounds: Round[];
	events: Evt[];
}

function fmtDate(iso: string | null, lang: string) {
	if (!iso) return '—';
	return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
		year: 'numeric', month: 'short', day: 'numeric',
	});
}

/** Her chosen identity, or the bare UUID — which is a choice, not a missing name. */
function label(m: Member) {
	if (m.displayName) return m.displayName;
	return m.id.length > 14 ? `${m.id.slice(0, 8)}…${m.id.slice(-4)}` : m.id;
}

/**
 * The organizer's per-member claim link. A seeded member (no login) gets a button
 * that mints a single-use link; the organizer copies it and sends it to her however
 * they reach each other. Shown only to the operator, only for an unclaimed member.
 */
function ClaimLink({ memberId, name, t }: { memberId: string; name: string; t: ReturnType<typeof getCirclesLocale> }) {
	const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
	const [url, setUrl] = useState('');
	const [copied, setCopied] = useState(false);

	async function mint() {
		setState('loading');
		try {
			const res = await fetch('/api/circles/member-claim', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ memberId }),
			});
			const j = await res.json().catch(() => ({}));
			if (!j?.ok || !j.url) { setState('error'); return; }
			setUrl(String(j.url));
			setState('done');
		} catch {
			setState('error');
		}
	}

	if (state === 'done') {
		return (
			<div className="mc-claim mc-claim--done">
				<input className="mc-claim__url" type="text" readOnly value={url} aria-label={t.claim.linkLabel(name)} onFocus={(e) => e.currentTarget.select()} />
				<button
					className="mc-claim__copy"
					type="button"
					onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
				>
					{copied ? t.claim.copied : t.claim.copy}
				</button>
			</div>
		);
	}

	return (
		<button className="mc-claim__btn" type="button" onClick={mint} disabled={state === 'loading'}>
			{state === 'loading' ? t.claim.minting : state === 'error' ? t.claim.retry : t.claim.get}
		</button>
	);
}

/**
 * The organizer sets a seeded member's payout wallet — where her turn pays — for a
 * member who has not claimed a login yet and so cannot use her own account modal. He
 * can also run the self-send verification on her behalf (she does the on-chain
 * self-send from her wallet; he triggers the observation). Operational, not custodial.
 */
function PayoutAddressEditor({ memberId, current, verified, t, onChanged }: {
	memberId: string; current: string | null; verified: boolean;
	t: ReturnType<typeof getCirclesLocale>; onChanged: () => void;
}) {
	const a = t.drill.addr;
	const [editing, setEditing] = useState(!current);
	const [draft, setDraft] = useState(current ?? '');
	const [saving, setSaving] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const [verifyOpen, setVerifyOpen] = useState(false);
	const [verifyBusy, setVerifyBusy] = useState(false);
	const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

	async function save() {
		setErr(null); setSaving(true);
		try {
			const res = await fetch('/api/circles/member-address', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ memberId, address: draft.trim() }),
			});
			const j = await res.json().catch(() => ({}));
			if (!res.ok || !j?.ok) {
				setErr(j?.error === 'bad_address' ? a.badAddress : j?.error === 'address_taken' ? a.taken : a.err);
			} else { setEditing(false); onChanged(); }
		} catch { setErr(a.err); } finally { setSaving(false); }
	}

	async function check() {
		setVerifyMsg(null); setVerifyBusy(true);
		try {
			const res = await fetch('/api/circles/member-address/verify', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ memberId }),
			});
			const j = await res.json().catch(() => ({}));
			if (j?.ok && j?.verified) { setVerifyOpen(false); onChanged(); }
			else if (j?.reason === 'unsupported') setVerifyMsg(a.unsupported);
			else if (j?.reason === 'not_found') setVerifyMsg(a.notFound);
			else setVerifyMsg(a.unavailable);
		} catch { setVerifyMsg(a.unavailable); } finally { setVerifyBusy(false); }
	}

	return (
		<div className="mc-addr">
			<span className="mc-addr__label">{a.label}</span>
			{current && !editing ? (
				<div className="mc-addr__row">
					<code className="mc-addr__val" title={current}>{current}</code>
					<button type="button" className="mc-addr__edit" onClick={() => { setDraft(current); setErr(null); setEditing(true); }}>{a.edit}</button>
				</div>
			) : (
				<div className="mc-addr__row">
					<input
						className="mc-addr__input" type="text" spellCheck={false} autoCapitalize="none" autoCorrect="off"
						placeholder={a.placeholder} value={draft} disabled={saving}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
					/>
					<button type="button" className="mc-addr__save" disabled={saving} onClick={save}>{saving ? a.saving : a.save}</button>
				</div>
			)}
			{err && <span className="mc-addr__err">{err}</span>}
			{current && !editing && !verified && !verifyOpen && (
				<button type="button" className="mc-addr__verifybtn" onClick={() => { setVerifyMsg(null); setVerifyOpen(true); }}>{a.verify}</button>
			)}
			{current && !editing && !verified && verifyOpen && (
				<div className="mc-addr__verify">
					<p className="mc-addr__how">{a.how}</p>
					<button type="button" className="mc-addr__check" disabled={verifyBusy} onClick={check}>{verifyBusy ? a.checking : a.verify}</button>
					{verifyMsg && <p className="mc-addr__msg">{verifyMsg}</p>}
				</div>
			)}
		</div>
	);
}

function MemberCard({ m, t, cycleLength, isAdmin, onChanged }: { m: Member; t: ReturnType<typeof getCirclesLocale>; cycleLength: number; isAdmin: boolean; onChanged: () => void }) {
	const gone = Boolean(m.leftAt);
	return (
		<article className={`mc-card ${gone ? 'mc-card--left' : ''} ${m.isRecipientOfOpenRound ? 'mc-card--receiving' : ''}`}>
			<header className="mc-card__head">
				<div className="mc-card__id">
					<h3 className="mc-card__name" title={m.displayName ? undefined : t.drill.uuidOnly}>{label(m)}</h3>
					<span className="mc-card__turn">
						{m.turnOrder ? t.drill.turnOf(m.turnOrder, cycleLength) : t.drill.noTurn}
					</span>
				</div>
				{/* Is she still in the group — the operator's actual question, answered
				    plainly. A departure is recorded, not condemned. */}
				<span className={`mc-status ${gone ? 'mc-status--left' : 'mc-status--in'}`}>
					{gone ? t.drill.statusLeft : t.drill.statusIn}
				</span>
			</header>

			<div className="mc-card__since">
				{t.drill.memberSince} {fmtDate(m.joinedAt, t.lang)}
				{gone && <span className="mc-card__left-pill">{t.drill.departedOn(fmtDate(m.leftAt, t.lang))}</span>}
			</div>

			{m.isRecipientOfOpenRound && <p className="mc-card__receiving">{t.drill.herTurnNow}</p>}

			<footer className={`mc-verify ${m.payoutVerified ? 'mc-verify--ok' : 'mc-verify--pending'}`}>
				<span className="mc-verify__dot" aria-hidden="true" />
				{m.payoutVerified ? t.card.payoutVerified : t.card.payoutUnverified}
			</footer>

			{/* Operator-only, and only while she has no login of her own to reach the app:
			    set (and verify) her payout wallet, and hand her a claim link. */}
			{isAdmin && !gone && !m.claimed && (
				<div className="mc-setup">
					<PayoutAddressEditor memberId={m.id} current={m.payoutAddress} verified={m.payoutVerified} t={t} onChanged={onChanged} />
					<div className="mc-claim-row">
						<ClaimLink memberId={m.id} name={label(m)} t={t} />
					</div>
				</div>
			)}
		</article>
	);
}

export default function MemberCards({ lang, contractId, isAdmin = false }: { lang: Lang; contractId: string; isAdmin?: boolean }) {
	const t = getCirclesLocale(lang);
	const [data, setData] = useState<Payload | null>(null);
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

	const load = useCallback(async () => {
		setState('loading');
		try {
			const res = await fetch(`/api/circles/${encodeURIComponent(contractId)}`);
			if (!res.ok) throw new Error(String(res.status));
			const j = await res.json();
			if (!j.ok) throw new Error(j.error);
			setData(j);
			setState('ready');
		} catch {
			setState('error');
		}
	}, [contractId]);

	useEffect(() => { load(); }, [load]);

	if (state === 'loading') return <p className="mc-msg">{t.drill.loading}</p>;
	if (state === 'error' || !data)
		return (
			<div className="mc-msg">
				<p>{t.drill.error}</p>
				<button type="button" className="ct-retry" onClick={load}>{t.page.retry}</button>
			</div>
		);

	const { contract, members, rounds, events } = data;

	/** A member's chosen identity, or a shortened UUID — only ever for real member
	 *  ids. Never guess: an unrecognised id is returned whole, because truncating
	 *  something you failed to resolve renders a fiction that looks like a name. */
	const nameOf = (id: string | null) => {
		if (!id) return '—';
		const m = members.find((x) => x.id === id);
		if (m) return label(m);
		return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
	};

	/** The log's actor is a member id, 'organizer', or 'system'. Only the first is a
	 *  person; 'system' is the watcher and needs no name against its own facts. */
	const actorOf = (actor: string | null) => {
		if (!actor || actor === 'system') return '';
		const m = members.find((x) => x.id === actor);
		if (m) return label(m);
		if (actor === 'organizer') return t.drill.actorOrganizer;
		return actor;
	};

	return (
		<div className="mc-wrap">
			<section className="mc-section">
				<div className="mc-section__head">
					<h2 className="mc-section__title">{t.drill.membersHeading}</h2>
					<p className="mc-section__hint">{t.drill.membersHint}</p>
				</div>
				<div className="mc-grid">
					{members.map((m) => (
						<MemberCard key={`${m.id}-${m.turnOrder}-${m.joinedAt}`} m={m} t={t} cycleLength={contract.cycleLength} isAdmin={isAdmin} onChanged={load} />
					))}
				</div>
			</section>

			{rounds.length > 0 && (
				<section className="mc-section">
					<div className="mc-section__head">
						<h2 className="mc-section__title">{t.drill.roundsHeading}</h2>
						<p className="mc-section__hint">{t.drill.roundsHint}</p>
					</div>
					<ol className="mc-rounds">
						{rounds.map((r) => (
							<li key={r.index} className={`mc-round mc-round--${r.status}`}>
								<span className="mc-round__idx">{r.index}</span>
								<span className="mc-round__who">{nameOf(r.recipientId)}</span>
								<span className="mc-round__due">{fmtDate(r.dueDate, t.lang)}</span>
								<span className="mc-round__state">
									{r.payoutObserved ? t.drill.payoutObserved : t.drill.payoutPending}
								</span>
								{r.payoutFrozen && <span className="mc-round__frozen" title={t.card.payoutVerifiedHint}>❄</span>}
							</li>
						))}
					</ol>
				</section>
			)}

			<section className="mc-section">
				<div className="mc-section__head">
					<h2 className="mc-section__title">{t.drill.eventsHeading}</h2>
					<p className="mc-section__hint">{t.drill.eventsHint}</p>
				</div>
				<ul className="mc-events">
					{events.map((e, i) => (
						<li key={i} className="mc-event">
							<span className="mc-event__when">{fmtDate(e.at, t.lang)}</span>
							<span className="mc-event__what">{t.drill.action[e.action] ?? e.action}</span>
							<span className="mc-event__who">{actorOf(e.actor)}</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
