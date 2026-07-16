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
import './MemberAccount.css';

interface InitialAccount {
	member: { displayName: string | null } | null;
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

				<form className="ma__logout" method="post" action="/api/logout">
					<button type="submit" className="ma__logoutbtn">{t.me.logout}</button>
				</form>
			</div>
		</details>
	);
}

function initialOf(name: string): string {
	const ch = name.trim().charAt(0);
	return ch ? ch.toUpperCase() : '•';
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
