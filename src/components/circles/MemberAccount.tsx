// MemberAccount — the member's account modal. HER home, the counterpart to the
// operator's account dropdown in Layout.astro.
//
// Where the operator's drill-in refuses to know her payment record, this is the
// other side of that line: it is hers. Her circles, and the votes open in them that
// she can act on — vouch for someone joining, weigh in on a proposal, or put her own
// question to the group. One tap from wherever she lands.
//
// ── What it does not show ────────────────────────────────────────────────────
//
// No tally, ever. A vote in flight reads "open"; only its outcome lands at close.
// `mine` dedups her own button — it never says which way she, or anyone, voted.
// (§5a: ballots are secret; the shared ledger is who-paid, not who-voted-how.)
//
// The lobby server-seeds `initial` so this paints without a spinner on a slow
// bundle; every action refetches /api/me/circles for the fresh list.

import { useCallback, useState } from 'react';
import { getCirclesLocale } from '@/i18n/dashboard/circles';
import type { Lang } from '@/lib/i18n/locale';
import type { MemberCircle, MemberVote } from '@/lib/circles/memberAccount';
import type { SusuCard } from '@/lib/circles/susuCard';
import type { ActivityItem } from '@/lib/circles/almstinsActivity';
import { SLOT_GLYPH } from '@/lib/circles/slotGlyph';
import './MemberAccount.css';

interface MemberInfo {
	displayName: string | null;
	payoutAddress: string | null;
	addressVerified: boolean;
}
interface InitialAccount {
	member: MemberInfo | null;
	circles: MemberCircle[];
}

interface Props {
	lang: Lang;
	initial: InitialAccount;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function MemberAccount({ lang, initial }: Props) {
	const t = getCirclesLocale(lang);
	const [member, setMember] = useState(initial.member);
	const [circles, setCircles] = useState<MemberCircle[]>(initial.circles ?? []);
	const [busy, setBusy] = useState<Record<string, boolean>>({});
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [proposing, setProposing] = useState<Record<string, boolean>>({});
	const [proposed, setProposed] = useState<Record<string, boolean>>({});
	const [err, setErr] = useState<string | null>(null);

	// Payout-address entry. `addrEditing` opens the field; `addrDraft` is what she types.
	const [addrEditing, setAddrEditing] = useState(false);
	const [addrDraft, setAddrDraft] = useState('');
	const [addrSaving, setAddrSaving] = useState(false);
	const [addrErr, setAddrErr] = useState<string | null>(null);

	// Verification against Almstins Verify. One tap re-checks; `verifyMsg` shows the
	// "not proven yet" result.
	const [verifyBusy, setVerifyBusy] = useState(false);
	const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

	// Her wallet's funds in/out, read from the public chain via Almstins. Loaded on
	// demand (a live chain read is slow) and shown only to her.
	const [activityOpen, setActivityOpen] = useState(false);
	const [activityLoading, setActivityLoading] = useState(false);
	const [activity, setActivity] = useState<ActivityItem[] | null>(null);
	const [activityReason, setActivityReason] = useState<string | null>(null);
	const [activityTruncated, setActivityTruncated] = useState(false);

	const refetch = useCallback(async () => {
		try {
			const res = await fetch('/api/me/circles', { headers: { Accept: 'application/json' } });
			const data = await res.json();
			if (data?.ok) {
				setMember(data.member ?? null);
				setCircles(Array.isArray(data.circles) ? data.circles : []);
			}
		} catch { /* keep the last good view */ }
	}, []);

	const cast = useCallback(async (voteId: string, ballot: 'yes' | 'no') => {
		setErr(null);
		setBusy((b) => ({ ...b, [voteId]: true }));
		try {
			const res = await fetch(`/api/circles/vote/${voteId}/ballot`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ballot }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data?.ok) setErr(t.me.err);
			await refetch();
		} catch {
			setErr(t.me.err);
		} finally {
			setBusy((b) => ({ ...b, [voteId]: false }));
		}
	}, [refetch, t]);

	const propose = useCallback(async (contractId: string) => {
		const title = (drafts[contractId] ?? '').trim();
		if (!title) return;
		setErr(null);
		setProposing((p) => ({ ...p, [contractId]: true }));
		try {
			const res = await fetch('/api/circles/propose', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, title }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data?.ok) {
				setErr(t.me.err);
			} else {
				setDrafts((d) => ({ ...d, [contractId]: '' }));
				setProposed((p) => ({ ...p, [contractId]: true }));
				setTimeout(() => setProposed((p) => ({ ...p, [contractId]: false })), 2500);
				await refetch();
			}
		} catch {
			setErr(t.me.err);
		} finally {
			setProposing((p) => ({ ...p, [contractId]: false }));
		}
	}, [drafts, refetch, t]);

	const saveAddress = useCallback(async () => {
		const address = addrDraft.trim();
		setAddrErr(null);
		setAddrSaving(true);
		try {
			const res = await fetch('/api/me/address', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ address }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data?.ok) {
				setAddrErr(
					data?.error === 'bad_address' ? t.me.address.badAddress
						: data?.error === 'address_taken' ? t.me.address.taken
							: t.me.address.genericErr,
				);
			} else {
				setAddrEditing(false);
				await refetch();
			}
		} catch {
			setAddrErr(t.me.address.genericErr);
		} finally {
			setAddrSaving(false);
		}
	}, [addrDraft, refetch, t]);

	const checkVerify = useCallback(async () => {
		setVerifyMsg(null);
		setVerifyBusy(true);
		try {
			const res = await fetch('/api/me/address/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
			const data = await res.json().catch(() => ({}));
			if (data?.ok && data?.verified) await refetch(); // badge flips to verified
			else setVerifyMsg(t.me.address.verify.notFound);
		} catch {
			setVerifyMsg(t.me.address.verify.notFound);
		} finally {
			setVerifyBusy(false);
		}
	}, [refetch, t]);

	const loadActivity = useCallback(async () => {
		setActivityLoading(true);
		setActivityReason(null);
		try {
			const res = await fetch('/api/me/activity', { headers: { Accept: 'application/json' } });
			const data = await res.json().catch(() => ({}));
			if (data?.ok) {
				setActivity(Array.isArray(data.activity) ? data.activity : []);
				setActivityReason(typeof data.reason === 'string' ? data.reason : null);
				setActivityTruncated(Boolean(data.truncated));
			} else {
				setActivity([]);
				setActivityReason('unavailable');
			}
		} catch {
			setActivity([]);
			setActivityReason('unavailable');
		} finally {
			setActivityOpen(true);
			setActivityLoading(false);
		}
	}, []);

	// Not a member of any programme (an operator, or someone not yet joined). Her home
	// is not for them — render nothing.
	if (!member) return null;

	const label = member.displayName || t.me.trigger;

	return (
		<details className="ma">
			<summary className="ma__trigger">
				<span className="ma__avatar" aria-hidden="true">{initialOf(label)}</span>
				<span className="ma__triggerlabel">{t.me.trigger}</span>
				<span className="ma__caret" aria-hidden="true">▾</span>
			</summary>

			<div className="ma__panel" role="dialog" aria-label={t.me.heading}>
				<p className="ma__name">{label}</p>

				{/* Her payout wallet — where her turn pays. She sets it; the app never
				    holds it. Verification (self-send) is deferred, so it reads
				    "not yet verified" until that is rebuilt. */}
				<section className="ma__addr">
					<span className="ma__addrlabel">{t.me.address.label}</span>
					{member.payoutAddress && !addrEditing ? (
						<>
							<div className="ma__addrrow">
								<code className="ma__addrval" title={member.payoutAddress}>{member.payoutAddress}</code>
								<button
									type="button"
									className="ma__addredit"
									onClick={() => { setAddrDraft(member.payoutAddress ?? ''); setAddrErr(null); setAddrEditing(true); }}
								>{t.me.address.edit}</button>
							</div>
							<div className="ma__addrverify">
								<span className={`ma__addrstatus ${member.addressVerified ? 'ma__addrstatus--ok' : ''}`}>
									{member.addressVerified ? t.me.address.verified : t.me.address.unverified}
								</span>
								{!member.addressVerified && (
									<button type="button" className="ma__addrverifybtn" disabled={verifyBusy} onClick={checkVerify}>
										{verifyBusy ? t.me.address.verify.checking : t.me.address.verify.cta}
									</button>
								)}
							</div>
							{!member.addressVerified && verifyMsg && <p className="ma__addrverifymsg">{verifyMsg}</p>}

							{/* Her wallet's funds in/out — her own record, read from the chain. */}
							<div className="ma__activity">
								<button
									type="button"
									className="ma__actbtn"
									disabled={activityLoading}
									onClick={activityOpen ? () => setActivityOpen(false) : loadActivity}
								>
									{activityOpen ? t.me.activity.hide : activityLoading ? t.me.activity.loading : t.me.activity.cta}
								</button>
								{activityOpen && (
									<div className="ma__actbody">
										<p className="ma__acthint">{t.me.activity.intro}</p>
										{activity && activity.length > 0 ? (
											<ul className="ma__actlist">
												{activity.map((it, i) => (
													<li className={`ma__act ma__act--${it.direction}`} key={`${it.hash}-${i}`}>
														<span className="ma__actdir">{it.direction === 'in' ? t.me.activity.in : t.me.activity.out}</span>
														<span className="ma__actamt">{it.direction === 'in' ? '+' : '−'}{it.amount} {it.asset}</span>
														<span className="ma__actcp" title={it.counterparty || undefined}>{shortAddr(it.counterparty)}</span>
														<span className="ma__actdate">{fmtDay(it.timestamp, lang)}</span>
													</li>
												))}
											</ul>
										) : (
											<p className="ma__actempty">{activityMsg(activityReason, t)}</p>
										)}
										{activityTruncated && <p className="ma__acttrunc">{t.me.activity.truncated}</p>}
									</div>
								)}
							</div>
						</>
					) : (
						<>
							<div className="ma__addrrow">
								<input
									className="ma__addrinput"
									type="text"
									inputMode="text"
									autoCapitalize="none"
									autoCorrect="off"
									spellCheck={false}
									placeholder={t.me.address.placeholder}
									value={addrDraft}
									disabled={addrSaving}
									onChange={(e) => setAddrDraft(e.target.value)}
									onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveAddress(); } }}
								/>
								<button
									type="button"
									className="ma__addrsave"
									disabled={addrSaving}
									onClick={saveAddress}
								>{addrSaving ? t.me.address.saving : t.me.address.save}</button>
							</div>
							{!member.payoutAddress && !addrErr && <span className="ma__addrhint">{t.me.address.notSet}</span>}
						</>
					)}
					<span className="ma__addrhint">{t.me.address.hint}</span>
					{addrErr && <span className="ma__addrerr">{addrErr}</span>}
				</section>

				{circles.length === 0 ? (
					<div className="ma__empty">
						<p className="ma__emptytext">{t.me.none}</p>
						<a className="ma__join" href="/join">{t.me.joinCta}</a>
					</div>
				) : (
					circles.map((c) => (
						<section className="ma__circle" key={c.id}>
							<h3 className="ma__circlename">
								{c.name}
								<span className="ma__kind">{c.type === 'target_group' ? t.kind.targetGroup : t.kind.circle}</span>
							</h3>

							{c.card && <SusuCardFace card={c.card} t={t} lang={lang} />}

							{c.votes.length === 0 ? (
								<p className="ma__novotes">{t.me.noVotes}</p>
							) : (
								<ul className="ma__votes">
									{c.votes.map((v) => (
										<li className="ma__vote" key={v.voteId}>
											<span className="ma__votetitle">{voteTitle(v, t)}</span>
											<span className="ma__closes">{closesText(v.closesAt, t)}</span>
											{v.mine ? (
												<span className="ma__voted">{t.me.voted}</span>
											) : v.canCast ? (
												<span className="ma__cast">
													<button
														type="button"
														className="ma__yes"
														disabled={Boolean(busy[v.voteId])}
														onClick={() => cast(v.voteId, 'yes')}
													>{t.me.yes}</button>
													<button
														type="button"
														className="ma__no"
														disabled={Boolean(busy[v.voteId])}
														onClick={() => cast(v.voteId, 'no')}
													>{t.me.no}</button>
												</span>
											) : (
												<span className="ma__awaiting">{t.me.awaiting}</span>
											)}
										</li>
									))}
								</ul>
							)}

							<div className="ma__propose">
								<label className="ma__proposelabel" htmlFor={`ma-q-${c.id}`}>{t.me.propose.label}</label>
								<div className="ma__proposerow">
									<input
										id={`ma-q-${c.id}`}
										className="ma__proposeinput"
										type="text"
										maxLength={280}
										placeholder={t.me.propose.placeholder}
										value={drafts[c.id] ?? ''}
										disabled={Boolean(proposing[c.id])}
										onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
										onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); propose(c.id); } }}
									/>
									<button
										type="button"
										className="ma__proposebtn"
										disabled={Boolean(proposing[c.id]) || !(drafts[c.id] ?? '').trim()}
										onClick={() => propose(c.id)}
									>{proposing[c.id] ? t.me.propose.sending : t.me.propose.submit}</button>
								</div>
								{proposed[c.id] && <p className="ma__proposedone">{t.me.propose.done}</p>}
							</div>
						</section>
					))
				)}

				{err && <p className="ma__err">{err}</p>}

				{circles.length > 0 && (
					<a className="ma__record" href="/me/card">{t.me.card.open}</a>
				)}

				<form className="ma__logout" method="post" action="/api/logout">
					<button type="submit" className="ma__logoutbtn">{t.me.logout}</button>
				</form>
			</div>
		</details>
	);
}

// ── the susu card, digitized ──────────────────────────────────────────────────
// Her record in this circle, decorated — never a score (SusuData §4). Entry date,
// the current cycle's star row, and permanent lifetime tallies. Every mark is a fact
// derived from the chain; nothing here compares her to anyone.
function SusuCardFace({ card, t, lang }: { card: SusuCard; t: ReturnType<typeof getCirclesLocale>; lang: Lang }) {
	const l = t.me.card;
	const lt = card.lifetime;
	const judged = lt.onTime + lt.late + lt.repaid + lt.missed;

	return (
		<div className="ma__card">
			<div className="ma__cardhead">
				{card.joinedAt && <span className="ma__since">{l.memberSince(fmtMonthYear(card.joinedAt, lang))}</span>}
				<span className="ma__cyclelabel">{card.currentCycle > 1 ? l.cycleN(card.currentCycle) : l.thisCycle}</span>
			</div>

			{/* The star row — this cycle only. role=list so a screen reader walks the
			    slots; each glyph carries its meaning as an aria-label, not by color. */}
			<div className="ma__stars" role="list" aria-label={l.thisCycle}>
				{card.slots.map((s, i) => (
					<span
						key={i}
						className={`ma__slot ma__slot--${s}`}
						role="listitem"
						aria-label={l.slot[s]}
						title={l.slot[s]}
					>{SLOT_GLYPH[s]}</span>
				))}
			</div>

			{judged === 0 ? (
				<p className="ma__fresh">{l.fresh}</p>
			) : (
				<div className="ma__lifetime">
					<span className="ma__ltlabel">{l.lifetime}</span>
					<span className="ma__ltcounts">
						{lt.onTime > 0 && <span className="ma__lt">{lt.onTime} {l.onTime}</span>}
						{lt.late > 0 && <span className="ma__lt">{lt.late} {l.late}</span>}
						{lt.repaid > 0 && <span className="ma__lt">{lt.repaid} {l.repaid}</span>}
						{lt.missed > 0 && <span className="ma__lt ma__lt--missed">{lt.missed} {l.missed}</span>}
					</span>
					{card.lifetime.cyclesCompleted > 0 && (
						<span className="ma__gates" title={l.cyclesDone(card.lifetime.cyclesCompleted)} aria-label={l.cyclesDone(card.lifetime.cyclesCompleted)}>
							<Tally n={card.lifetime.cyclesCompleted} />
						</span>
					)}
				</div>
			)}
		</div>
	);
}

// Tally gates — one mark per completed cycle, every fifth struck through (IIII̸),
// readable with zero literacy (SusuData §4).
function Tally({ n }: { n: number }) {
	return (
		<>
			{Array.from({ length: n }, (_, i) => (
				<span key={i} className={`ma__tallymark${(i + 1) % 5 === 0 ? ' ma__tallymark--gate' : ''}`} aria-hidden="true">|</span>
			))}
		</>
	);
}

function fmtMonthYear(iso: string, lang: Lang): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const loc = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US';
	return d.toLocaleDateString(loc, { month: 'short', year: 'numeric' });
}

function initialOf(name: string): string {
	const ch = name.trim().charAt(0);
	return ch ? ch.toUpperCase() : '•';
}

// A counterparty address, shortened for the row. UTXO chains may report none → '—'.
function shortAddr(addr: string): string {
	const a = (addr ?? '').trim();
	if (!a) return '—';
	return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

// Activity timestamps are epoch seconds; 0 means unconfirmed/unknown → '—'.
function fmtDay(epochSeconds: number, lang: Lang): string {
	if (!epochSeconds) return '—';
	const d = new Date(epochSeconds * 1000);
	if (Number.isNaN(d.getTime())) return '—';
	const loc = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US';
	return d.toLocaleDateString(loc, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Which soft message to show when the list is empty — the chain wasn't reachable, the
// chain isn't watched, or there simply is no activity yet.
function activityMsg(reason: string | null, t: ReturnType<typeof getCirclesLocale>): string {
	if (reason === 'unsupported') return t.me.activity.unsupported;
	if (reason && reason !== 'no_address') return t.me.activity.unavailable;
	return t.me.activity.none;
}

function voteTitle(v: MemberVote, t: ReturnType<typeof getCirclesLocale>): string {
	if (v.kind === 'proposal') return v.title ?? '—';
	const name = v.subjectName ?? t.me.voteLabel.someone;
	if (v.kind === 'expulsion') return t.me.voteLabel.expulsion(name);
	return t.me.voteLabel.admission(name);
}

function closesText(iso: string, t: ReturnType<typeof getCirclesLocale>): string {
	const days = Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
	if (days <= 0) return t.me.closesToday;
	return t.me.closesIn(days);
}
