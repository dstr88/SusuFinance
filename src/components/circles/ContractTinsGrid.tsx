// ContractTinsGrid — the operator vault. One card per contract: a rotating circle
// or a targeted savings group. The tin architecture, reborn as contracts.
//
// The card shows everything about the RELATIONSHIP and nothing about the person
// beyond it. There is no balance on this card and no way to add one: the API does
// not return a balance and the schema does not store one. What the operator sees
// is what the circle already knows — because its members send to these addresses.
//
// Nothing here ranks a member or a circle. No scores, no tiers, no badges, no
// leaderboard. Facts may shine; ranks may not.

import { useCallback, useEffect, useState } from 'react';
import { getCirclesLocale, type CirclesLocale } from '@/i18n/dashboard/circles';
import type { Lang } from '@/lib/i18n/locale';
import './ContractTinsGrid.css';

type DisciplineState = 'early' | 'on_time' | 'late' | 'repaid' | 'behind' | 'pending';

interface CircleCard {
	id: string;
	type: 'circle' | 'target_group';
	name: string;
	currency: string;
	cadence: 'weekly' | 'biweekly' | 'monthly';
	status: 'forming' | 'active' | 'completed' | 'abandoned';
	memberCount: number;
	expectedAmount: number;
	/**
	 * The women in this tin — `forming` tins only; null for a live one.
	 *
	 * null vs [] is load-bearing: null means the API sent no roster because this
	 * tin's cards are not arrangeable, [] means an empty tin with room. Rendering
	 * them the same way would turn a live circle into an empty one on screen.
	 */
	roster:
		| { memberId: string; displayName: string | null; turnOrder: number | null; payoutVerified: boolean }[]
		| null;
	round: {
		index: number;
		total: number;
		recipientName: string | null;
		recipientId: string | null;
		payoutVerified: boolean;
		payoutFrozen: boolean;
	} | null;
	target: {
		perMemberAmount: number;
		groupTarget: number;
		observed: number;
		fraction: number;
		targetDate: string | null;
	} | null;
	period: {
		label: string | null;
		dueDate: string | null;
		paid: number;
		expected: number;
		observedUnits: number;
		expectedUnits: number;
		states: Record<DisciplineState, number>;
	} | null;
	totalInUnits: number;
	verifiedMembers: number;
}

/** Units, never currency. `toLocaleString` with a currency style would imply a
 *  valuation, which this product does not do and will not do. */
function units(n: number, currency: string, lang: string) {
	const s = n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 0,
	});
	return `${s} ${currency}`;
}

function daysUntil(dateStr: string): number {
	const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
	const due = Date.UTC(y, m - 1, d);
	const now = new Date();
	const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return Math.round((due - today) / 86_400_000);
}

/** Her chosen identity, or the bare UUID. A member with no display name is not a
 *  missing name — she is a member who chose not to give one, and the UUID-only
 *  path is first-class. Shortened for the card; never invented, never "Anonymous". */
function memberLabel(name: string | null, id: string | null): string {
	if (name) return name;
	if (!id) return '—';
	return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function DueBadge({ dateStr, t }: { dateStr: string; t: CirclesLocale }) {
	const d = daysUntil(dateStr);
	const text = d === 0 ? t.card.dueToday : d > 0 ? t.card.dueIn(d) : t.card.overdueBy(-d);
	// Past due is stated, not scolded — a fact about a date.
	return <span className={`ct-due ${d < 0 ? 'ct-due--past' : ''}`}>{text}</span>;
}

function DisciplineBar({ states, t }: { states: Record<DisciplineState, number>; t: CirclesLocale }) {
	const order: DisciplineState[] = ['early', 'on_time', 'late', 'repaid', 'behind', 'pending'];
	const total = order.reduce((a, k) => a + states[k], 0);
	if (!total) return null;
	return (
		<div className="ct-bar" role="img" aria-label={order.filter((k) => states[k]).map((k) => `${states[k]} ${t.discipline[k]}`).join(', ')}>
			{order.map((k) =>
				states[k] ? <span key={k} className={`ct-bar__seg ct-bar__seg--${k}`} style={{ flexGrow: states[k] }} title={`${states[k]} · ${t.discipline[k]}`} /> : null,
			)}
		</div>
	);
}

/** What a drag carries. `mode` is decided by WHERE he grabbed: the card body moves
 *  her, the corner square copies her. */
type DragPayload = { memberId: string; fromContractId: string; mode: 'move' | 'copy'; name: string };

/** Her chosen identity, or a shortened id — which is a choice, not a missing name. */
function rosterLabel(r: NonNullable<CircleCard['roster']>[number]) {
	if (r.displayName) return r.displayName;
	return r.memberId.length > 14 ? `${r.memberId.slice(0, 8)}…${r.memberId.slice(-4)}` : r.memberId;
}

/**
 * One woman's card inside a forming tin.
 *
 * Nothing about her record is here, and nothing could be: a forming tin has run no
 * rounds, so there is no record yet — and the API sends no roster at all for the
 * live tins that do have one.
 *
 * The corner square is a drag handle, not a button. It is deliberately not a
 * `<button>`: a button promises that clicking does something, and clicking this does
 * nothing — a copy needs a destination, and the destination is where you drop it.
 */
function RosterCard({
	r,
	tinId,
	t,
	onGrab,
}: {
	r: NonNullable<CircleCard['roster']>[number];
	tinId: string;
	t: CirclesLocale;
	onGrab: (e: React.DragEvent, p: DragPayload) => void;
}) {
	const name = rosterLabel(r);
	return (
		<div
			className="ct-mini"
			draggable
			onDragStart={(e) => onGrab(e, { memberId: r.memberId, fromContractId: tinId, mode: 'move', name })}
		>
			<span className="ct-mini__turn">{r.turnOrder ? t.arrange.turn(r.turnOrder) : t.arrange.noTurn}</span>
			<span className="ct-mini__name">{name}</span>
			<span
				className={`ct-mini__dot ${r.payoutVerified ? 'ct-mini__dot--ok' : 'ct-mini__dot--pending'}`}
				title={r.payoutVerified ? t.card.payoutVerified : t.card.payoutUnverified}
				aria-hidden="true"
			/>
			<span
				className="ct-mini__copy"
				draggable
				role="img"
				aria-label={t.arrange.copyLabel(name)}
				title={t.arrange.copyHint}
				onDragStart={(e) => {
					// Stop the card's own dragstart from firing too — otherwise the parent
					// would overwrite the payload and every copy would silently be a move.
					e.stopPropagation();
					onGrab(e, { memberId: r.memberId, fromContractId: tinId, mode: 'copy', name });
				}}
			>
				⧉
			</span>
		</div>
	);
}

function Card({
	c,
	t,
	onGrab,
	onDropCard,
	dragging,
}: {
	c: CircleCard;
	t: CirclesLocale;
	onGrab: (e: React.DragEvent, p: DragPayload) => void;
	onDropCard: (p: DragPayload, toContractId: string) => void;
	dragging: DragPayload | null;
}) {
	const isCircle = c.type === 'circle';
	const kind = isCircle ? t.kind.circle : t.kind.targetGroup;
	const [over, setOver] = useState(false);

	// roster === null means a live tin: its cards are not his to arrange, and its
	// names were never sent. An empty array is a forming tin with room.
	const forming = c.roster !== null;
	// Dropping her back where she came from is a no-op, so it is not a drop target.
	const canTake = forming && dragging !== null && dragging.fromContractId !== c.id;

	return (
		<article
			className={`ct-card ct-card--${c.type} ${forming ? 'ct-card--forming' : ''} ${over && canTake ? 'ct-card--over' : ''}`}
			onDragOver={(e) => {
				// preventDefault is what makes an element a drop target at all. Calling it
				// only when canTake means a live tin refuses the drag visibly — the cursor
				// says no before he lets go.
				if (canTake) {
					e.preventDefault();
					setOver(true);
				}
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				setOver(false);
				if (!canTake || !dragging) return;
				e.preventDefault();
				onDropCard(dragging, c.id);
			}}
		>
			<span className="ct-card__kind">{kind}</span>

			<header className="ct-card__head">
				{/* The whole tin opens — a card is the handle for the group it houses. */}
				<h3 className="ct-card__name">
					<a className="ct-card__link" href={`/dashboard/circles/${encodeURIComponent(c.id)}`}>
						{c.name}
					</a>
				</h3>
				<span className="ct-card__meta">
					{c.memberCount} {t.card.members} · {t.cadence[c.cadence]} · {units(c.expectedAmount, c.currency, t.lang)}
				</span>
			</header>

			{/* A forming tin shows its women instead of a rotation, because it has no
			    rotation yet — no rounds, no dues, nothing to summarise. It is a list of
			    names and an agreed order, and that is exactly what is arrangeable. */}
			{forming && (
				<div className="ct-roster">
					<span className="ct-status ct-status--forming">{t.status.forming}</span>
					<p className="ct-roster__hint">{t.arrange.hint}</p>
					{c.roster!.length === 0 ? (
						<p className="ct-roster__empty">{t.arrange.empty}</p>
					) : (
						<div className="ct-roster__cards">
							{c.roster!.map((r) => (
								<RosterCard key={r.memberId} r={r} tinId={c.id} t={t} onGrab={onGrab} />
							))}
						</div>
					)}
				</div>
			)}

			{/* Rotation position, or progress toward the members' target. */}
			{isCircle && c.round && (
				<div className="ct-round">
					<div className="ct-round__line">
						<span className="ct-label">{t.card.roundLabel}</span>
						<span className="ct-round__pos">{t.card.round(c.round.index, c.round.total)}</span>
					</div>
					<div className="ct-pips" role="img" aria-label={t.card.round(c.round.index, c.round.total)}>
						{Array.from({ length: c.round.total }, (_, i) => (
							<span
								key={i}
								className={`ct-pip ${i + 1 < c.round!.index ? 'ct-pip--done' : i + 1 === c.round!.index ? 'ct-pip--now' : ''}`}
							/>
						))}
					</div>
				</div>
			)}

			{!isCircle && c.target && (
				<div className="ct-round">
					<div className="ct-round__line">
						<span className="ct-label">{t.card.progress}</span>
						<span className="ct-round__pos">
							{units(c.target.observed, c.currency, t.lang)} / {units(c.target.groupTarget, c.currency, t.lang)}
						</span>
					</div>
					<div className="ct-progress">
						<span className="ct-progress__fill" style={{ width: `${Math.round(c.target.fraction * 100)}%` }} />
					</div>
				</div>
			)}

			{/* Contributions in, this period. Units only. */}
			<div className="ct-period">
				<div className="ct-round__line">
					<span className="ct-label">{t.card.thisPeriod}</span>
					{c.period?.dueDate ? <DueBadge dateStr={c.period.dueDate} t={t} /> : <span className="ct-due">{t.card.noRoundOpen}</span>}
				</div>
				{c.period ? (
					<>
						<div className="ct-period__figures">
							<strong className="ct-period__units">{units(c.period.observedUnits, c.currency, t.lang)}</strong>
							<span className="ct-period__of">/ {units(c.period.expectedUnits, c.currency, t.lang)}</span>
							<span className="ct-period__count">{t.card.paidOf(c.period.paid, c.period.expected)}</span>
						</div>
						<DisciplineBar states={c.period.states} t={t} />
					</>
				) : (
					<p className="ct-period__none">{t.discipline.none}</p>
				)}
			</div>

			{/* Payout-address Verify status. §3: every payout address verified before
			    a round opens — so an unverified one is the card's loudest fact. */}
			{isCircle && c.round && (
				<footer className={`ct-verify ${c.round.payoutVerified ? 'ct-verify--ok' : 'ct-verify--pending'}`}>
					<span className="ct-verify__dot" aria-hidden="true" />
					<span className="ct-verify__text">
						<span className="ct-verify__who">
							{t.card.receiving}: {memberLabel(c.round.recipientName, c.round.recipientId)}
						</span>
						<span className="ct-verify__state">
							{c.round.payoutVerified ? t.card.payoutVerified : t.card.payoutUnverified}
						</span>
						<span className="ct-verify__hint">
							{c.round.payoutVerified ? t.card.payoutVerifiedHint : t.card.payoutUnverifiedHint}
						</span>
					</span>
				</footer>
			)}
		</article>
	);
}

/**
 * Takes `lang`, not the locale object. Astro serializes island props to JSON, which
 * silently drops functions — so passing the locale directly delivered a `t` whose
 * `card.round(...)` was undefined on the client, and every Card threw. Resolving the
 * locale here keeps interpolation as functions instead of flattening the strings
 * into template placeholders that FR word order would eventually fight.
 */
export default function ContractTinsGrid({ lang }: { lang: Lang }) {
	const t = getCirclesLocale(lang);
	const [cards, setCards] = useState<CircleCard[]>([]);
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
	/** What is in his hand right now — drives which tins light up as targets. */
	const [dragging, setDragging] = useState<DragPayload | null>(null);
	/** The outcome of the last drop, said in words. A card that silently jumps tins
	 *  is a card he has to re-count to trust. */
	const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

	const load = useCallback(async (quiet = false) => {
		if (!quiet) setState('loading');
		try {
			const res = await fetch('/api/circles');
			if (!res.ok) throw new Error(String(res.status));
			const data = await res.json();
			if (!data.ok) throw new Error(data.error ?? 'load_failed');
			setCards(data.cards ?? []);
			setState('ready');
		} catch {
			setState('error');
		}
	}, []);

	const onGrab = useCallback((e: React.DragEvent, p: DragPayload) => {
		setDragging(p);
		setNote(null);
		e.dataTransfer.effectAllowed = p.mode === 'copy' ? 'copy' : 'move';
		// The payload also rides on the event so a drop is never at the mercy of React
		// state that may not have flushed yet.
		e.dataTransfer.setData('application/json', JSON.stringify(p));
	}, []);

	const onDropCard = useCallback(
		async (p: DragPayload, toContractId: string) => {
			setDragging(null);
			const toName = cards.find((c) => c.id === toContractId)?.name ?? '';
			try {
				const res = await fetch('/api/circles/arrange', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						memberId: p.memberId,
						toContractId,
						// Only a move has a source to leave. Sending one for a copy would
						// invite the endpoint to interpret it.
						fromContractId: p.mode === 'move' ? p.fromContractId : undefined,
						mode: p.mode,
					}),
				});
				const j = await res.json().catch(() => ({}));
				if (!j?.ok) {
					const key = String(j?.error ?? '') as keyof CirclesLocale['arrange']['err'];
					setNote({ kind: 'err', text: t.arrange.err[key] ?? t.arrange.err.generic });
					return;
				}
				setNote({
					kind: 'ok',
					text: p.mode === 'copy' ? t.arrange.copied(p.name, toName) : t.arrange.moved(p.name, toName),
				});
				// Re-read rather than patch local state: the turn slot she landed on was
				// decided by the server, and guessing it here would show her a seat she
				// might not be sitting in.
				await load(true);
			} catch {
				setNote({ kind: 'err', text: t.arrange.err.generic });
			}
		},
		[cards, load, t],
	);

	useEffect(() => {
		load();
	}, [load]);

	if (state === 'loading') return <p className="ct-msg">{t.page.loading}</p>;
	if (state === 'error')
		return (
			<div className="ct-msg">
				<p>{t.page.error}</p>
				<button type="button" className="ct-retry" onClick={() => load()}>
					{t.page.retry}
				</button>
			</div>
		);
	if (!cards.length)
		return (
			<div className="ct-msg">
				<p className="ct-msg__title">{t.page.empty}</p>
				<p>{t.page.emptyHint}</p>
			</div>
		);

	const circles = cards.filter((c) => c.type === 'circle');
	const groups = cards.filter((c) => c.type === 'target_group');
	const props = { t, onGrab, onDropCard, dragging };

	return (
		<div className="ct-grid" onDragEnd={() => setDragging(null)}>
			{/* aria-live: a drop is a mouse gesture with no text of its own, so the
			    outcome has to be announced or it happens silently. */}
			{note && (
				<p className={`ct-note ct-note--${note.kind}`} role="status" aria-live="polite">
					{note.text}
				</p>
			)}
			{circles.length > 0 && (
				<section className="ct-section">{circles.map((c) => <Card key={c.id} c={c} {...props} />)}</section>
			)}
			{groups.length > 0 && (
				<>
					<hr className="ct-divider" />
					<section className="ct-section">{groups.map((c) => <Card key={c.id} c={c} {...props} />)}</section>
				</>
			)}
			<p className="ct-footnote">{t.footnote}</p>
		</div>
	);
}
