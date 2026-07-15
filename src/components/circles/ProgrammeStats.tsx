// ProgrammeStats — the programme, in aggregate.
//
// Every figure here answers "is the programme working". None of them answer "how is
// this woman doing" — that is her record, and it lives on her screen. No member is
// named on this page, and none could be: the endpoint aggregates in SQL and a member
// id never crosses the wire.
//
// Nothing ranks. There is no leaderboard, no worst-performers list, no sort-by-late.
// The early-withdrawal panel carries a rate and no names, on purpose: the rate is the
// intelligence ("30% = emergencies or a product that does not fit"), a name would
// only say which woman is struggling.

import { useCallback, useEffect, useState } from 'react';
import { getCirclesLocale } from '@/i18n/dashboard/circles';
import type { Lang } from '@/lib/i18n/locale';
import './ProgrammeStats.css';

type DisciplineState = 'early' | 'on_time' | 'late' | 'repaid' | 'behind' | 'pending';

interface Stats {
	people: { total: number; active: number; departed: number; joined30d: number };
	contracts: { active: number; forming: number; completed: number; abandoned: number; completionRate: number | null };
	discipline: Record<DisciplineState, number> & {
		judged: number;
		shares: Record<Exclude<DisciplineState, 'pending'>, number> | null;
		trend: { roundIndex: number; judged: number; onTimeShare: number }[];
	};
	flow: { contributionsObservedUnits: number; payoutsObserved: number };
	earlyWithdrawals: { events: number; people: number; units: number; shareOfMembers: number | null };
	safety: { activeMembers: number; verifiedMembers: number; verifiedShare: number | null; openRoundsUnverifiedRecipient: number };
	ops: { notificationsBuilt: boolean };
}

const pct = (n: number, lang: string) =>
	`${(n * 100).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 0 })}%`;

const num = (n: number, lang: string) =>
	n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 });

export default function ProgrammeStats({ lang }: { lang: Lang }) {
	const t = getCirclesLocale(lang);
	const [d, setD] = useState<Stats | null>(null);
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

	const load = useCallback(async () => {
		setState('loading');
		try {
			const res = await fetch('/api/circles/stats');
			if (!res.ok) throw new Error(String(res.status));
			const j = await res.json();
			if (!j.ok) throw new Error(j.error);
			setD(j);
			setState('ready');
		} catch {
			setState('error');
		}
	}, []);

	useEffect(() => { load(); }, [load]);

	if (state === 'loading') return <p className="ps-msg">{t.stats.loading}</p>;
	if (state === 'error' || !d)
		return (
			<div className="ps-msg">
				<p>{t.stats.error}</p>
				<button type="button" className="ct-retry" onClick={load}>{t.page.retry}</button>
			</div>
		);

	const disciplineOrder: Exclude<DisciplineState, 'pending'>[] = ['early', 'on_time', 'late', 'repaid', 'behind'];

	return (
		<div className="ps-wrap">
			<div className="ps-row">
				{/* People — the pilot-reporting line: "87 of 100 active in week 6". */}
				<section className="ps-card">
					<h2 className="ps-card__title">{t.stats.people}</h2>
					<p className="ps-big">
						{d.people.active}
						<span className="ps-big__of"> / {d.people.total}</span>
					</p>
					<p className="ps-sub">{t.stats.activeOf(d.people.active, d.people.total)}</p>
					{d.people.departed > 0 && (
						<p className="ps-note">{d.people.departed} {t.stats.peopleDeparted(d.people.departed)}</p>
					)}
				</section>

				<section className="ps-card">
					<h2 className="ps-card__title">{t.stats.circles}</h2>
					<p className="ps-big">{d.contracts.active}</p>
					<p className="ps-sub">{t.stats.circlesActive}</p>
				</section>

				{/* Completion. Null is not zero: a programme with no finished cycles has
				    no completion record, and reporting 0% would be a claim we can't make. */}
				<section className="ps-card">
					<h2 className="ps-card__title">{t.stats.completion}</h2>
					{d.contracts.completionRate === null ? (
						<p className="ps-empty">{t.stats.completionNone}</p>
					) : (
						<>
							<p className="ps-big">{pct(d.contracts.completionRate, t.lang)}</p>
							<p className="ps-sub">{d.contracts.completed} / {d.contracts.completed + d.contracts.abandoned}</p>
						</>
					)}
				</section>

				<section className="ps-card">
					<h2 className="ps-card__title">{t.stats.safety}</h2>
					{d.safety.verifiedShare === null ? (
						<p className="ps-empty">{t.stats.noData}</p>
					) : (
						<>
							<p className="ps-big">{pct(d.safety.verifiedShare, t.lang)}</p>
							<p className="ps-sub">{t.stats.safetyVerified}</p>
						</>
					)}
					{/* §3: a round should not open until the recipient is verified. If one
					    has, that is the page's one alarm — a fact about an ADDRESS. */}
					{d.safety.openRoundsUnverifiedRecipient > 0 ? (
						<p className="ps-alarm">
							{d.safety.openRoundsUnverifiedRecipient} {t.stats.safetyRisk}
						</p>
					) : (
						<p className="ps-note">{t.stats.safetyRiskNone}</p>
					)}
				</section>
			</div>

			{/* Discipline — proportional, never a ranking. */}
			<section className="ps-panel">
				<h2 className="ps-card__title">{t.stats.discipline}</h2>
				<p className="ps-hint">{t.stats.disciplineHint}</p>
				{d.discipline.shares === null ? (
					<p className="ps-empty">{t.discipline.none}</p>
				) : (
					<>
						<div className="ps-bar" role="img" aria-label={disciplineOrder.map((k) => `${pct(d.discipline.shares![k], t.lang)} ${t.discipline[k]}`).join(', ')}>
							{disciplineOrder.map((k) =>
								d.discipline[k] ? (
									<span key={k} className={`ps-bar__seg ps-bar__seg--${k}`} style={{ flexGrow: d.discipline[k] }} title={`${d.discipline[k]} · ${t.discipline[k]}`} />
								) : null,
							)}
						</div>
						<ul className="ps-legend">
							{disciplineOrder.map((k) => (
								<li key={k} className="ps-legend__item">
									<span className={`ps-dot ps-dot--${k}`} aria-hidden="true" />
									<b>{pct(d.discipline.shares![k], t.lang)}</b> {t.discipline[k]}
								</li>
							))}
						</ul>
						<p className="ps-note">{t.stats.judgedOf(d.discipline.judged)}</p>
					</>
				)}
			</section>

			{/* Trend by round index — the classic ROSCA question. */}
			{d.discipline.trend.length > 0 && (
				<section className="ps-panel">
					<h2 className="ps-card__title">{t.stats.trend}</h2>
					<p className="ps-hint">{t.stats.trendHint}</p>
					<ol className="ps-trend">
						{d.discipline.trend.map((r) => (
							<li key={r.roundIndex} className="ps-trend__item" title={`${t.stats.roundN(r.roundIndex)} · ${pct(r.onTimeShare, t.lang)}`}>
								<span className="ps-trend__bar">
									<span className="ps-trend__fill" style={{ height: `${Math.round(r.onTimeShare * 100)}%` }} />
								</span>
								<span className="ps-trend__label">{r.roundIndex}</span>
							</li>
						))}
					</ol>
				</section>
			)}

			<div className="ps-row">
				<section className="ps-card">
					<h2 className="ps-card__title">{t.stats.flow}</h2>
					<p className="ps-big">{num(d.flow.contributionsObservedUnits, t.lang)}</p>
					<p className="ps-sub">{t.stats.flowIn}</p>
					<p className="ps-note">{d.flow.payoutsObserved} {t.stats.flowPayouts}</p>
					<p className="ps-note ps-note--quiet">{t.stats.unitsNote}</p>
				</section>

				{/* Early withdrawals: a rate, and no names. Ever. */}
				<section className="ps-card">
					<h2 className="ps-card__title">{t.stats.withdrawals}</h2>
					{d.earlyWithdrawals.events === 0 ? (
						<p className="ps-empty">{t.stats.withdrawalsNone}</p>
					) : (
						<>
							<p className="ps-big">
								{d.earlyWithdrawals.shareOfMembers !== null ? pct(d.earlyWithdrawals.shareOfMembers, t.lang) : d.earlyWithdrawals.events}
							</p>
							<p className="ps-sub">{t.stats.withdrawalsPeople(d.earlyWithdrawals.people)}</p>
							<p className="ps-note">{num(d.earlyWithdrawals.units, t.lang)} {t.stats.withdrawalsUnits}</p>
						</>
					)}
					<p className="ps-hint ps-hint--tight">{t.stats.withdrawalsHint}</p>
				</section>

				<section className="ps-card">
					<h2 className="ps-card__title">{t.stats.ops}</h2>
					<p className="ps-empty">{t.stats.opsNotBuilt}</p>
				</section>
			</div>

			<section className="ps-export">
				{/* Aggregates only — the consented-aggregates boundary as a download. */}
				<a className="ps-export__btn" href="/api/circles/stats" download="programme-report.json">
					{t.stats.export}
				</a>
				<p className="ps-hint ps-hint--tight">{t.stats.exportHint}</p>
			</section>
		</div>
	);
}
