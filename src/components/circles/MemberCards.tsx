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
	isRecipientOfOpenRound: boolean;
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

function MemberCard({ m, t, cycleLength }: { m: Member; t: ReturnType<typeof getCirclesLocale>; cycleLength: number }) {
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
		</article>
	);
}

export default function MemberCards({ lang, contractId }: { lang: Lang; contractId: string }) {
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
						<MemberCard key={`${m.id}-${m.turnOrder}-${m.joinedAt}`} m={m} t={t} cycleLength={contract.cycleLength} />
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
