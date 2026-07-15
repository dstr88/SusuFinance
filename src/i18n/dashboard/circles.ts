// Circles — the operator vault's strings (EN · FR).
//
// FR is first-class here, not a later pass: the pilot audience is francophone-
// adjacent and the doc calls EN/FR the minimum (Creole later). Every string a
// surface renders comes from this file so the vocabulary rules below are enforced
// in one place rather than remembered at each call site.
//
// ── The words are the product ────────────────────────────────────────────────
//
// "behind" / "en retard sur ses versements" — NEVER "delinquent" / "défaillant".
// Bank-speak imports the wrong moral frame, and the operator's vocabulary becomes
// the program's culture. The DB rejects 'delinquent' as a status; discipline.ts
// refuses it as a concept; this file refuses it as a word.
//
// An early withdrawal is "her right, exercised" — never a problem, a flag, or a
// risk. A departure is a departure. Nothing here ranks, scores, or rates anyone.
//
// FR caveat, same as i18n/dashboard/common.ts: first-pass translations. Financial
// and savings-circle terminology should be reviewed by a fluent speaker — ideally
// someone who has sat in a tontine — before this ships to a member's eyes.

import type { Lang } from '@/lib/i18n/locale';

export interface CirclesLocale {
	lang: Lang;
	page: {
		title: string;
		subtitle: string;
		loading: string;
		empty: string;
		emptyHint: string;
		error: string;
		retry: string;
	};
	kind: {
		circle: string;
		targetGroup: string;
	};
	cadence: Record<'weekly' | 'biweekly' | 'monthly', string>;
	status: Record<'forming' | 'active' | 'completed' | 'abandoned', string>;
	card: {
		members: string;
		/** "Round 6 of 10" */
		round: (index: number, total: number) => string;
		roundLabel: string;
		progress: string;
		thisPeriod: string;
		/** "6 of 9 paid" */
		paidOf: (paid: number, expected: number) => string;
		nextDue: string;
		dueIn: (days: number) => string;
		dueToday: string;
		overdueBy: (days: number) => string;
		noRoundOpen: string;
		receiving: string;
		payoutVerified: string;
		payoutUnverified: string;
		payoutVerifiedHint: string;
		payoutUnverifiedHint: string;
		unitsOnly: string;
	};
	discipline: {
		early: string;
		on_time: string;
		late: string;
		behind: string;
		pending: string;
		none: string;
	};
	footnote: string;
}

const EN: CirclesLocale = {
	lang: 'en',
	page: {
		title: 'Circles',
		subtitle: 'Every circle and savings group in your programme',
		loading: 'Loading circles…',
		empty: 'No circles yet',
		emptyHint: 'A circle appears here once it is created and its members are seeded.',
		error: 'Could not load circles',
		retry: 'Try again',
	},
	kind: { circle: 'Circle', targetGroup: 'Savings group' },
	cadence: { weekly: 'Weekly', biweekly: 'Every two weeks', monthly: 'Monthly' },
	status: { forming: 'Forming', active: 'Active', completed: 'Completed', abandoned: 'Ended early' },
	card: {
		members: 'Members',
		round: (i, t) => `Round ${i} of ${t}`,
		roundLabel: 'Rotation',
		progress: 'Progress',
		thisPeriod: 'This period',
		paidOf: (p, e) => `${p} of ${e} paid`,
		nextDue: 'Next due',
		dueIn: (d) => (d === 1 ? 'in 1 day' : `in ${d} days`),
		dueToday: 'today',
		overdueBy: (d) => (d === 1 ? '1 day past due' : `${d} days past due`),
		noRoundOpen: 'No round open',
		receiving: 'Receiving',
		payoutVerified: 'Payout address verified',
		payoutUnverified: 'Payout address not verified',
		payoutVerifiedHint: 'Verified by self-send proof, and frozen for this round.',
		payoutUnverifiedHint: 'This round should not open until the address is verified.',
		unitsOnly: 'Amounts are token units — never a valuation.',
	},
	discipline: {
		early: 'Early',
		on_time: 'On time',
		late: 'Late',
		behind: 'Behind',
		pending: 'Not yet due',
		none: 'No record yet',
	},
	footnote:
		'Contributions observed on the chain. This dashboard shows the relationship — never a member’s wallet balance.',
};

const FR: CirclesLocale = {
	lang: 'fr',
	page: {
		title: 'Cercles',
		subtitle: 'Chaque cercle et groupe d’épargne de votre programme',
		loading: 'Chargement des cercles…',
		empty: 'Aucun cercle pour l’instant',
		emptyHint: 'Un cercle apparaît ici une fois créé et ses membres inscrits.',
		error: 'Impossible de charger les cercles',
		retry: 'Réessayer',
	},
	kind: { circle: 'Cercle', targetGroup: 'Groupe d’épargne' },
	cadence: { weekly: 'Chaque semaine', biweekly: 'Toutes les deux semaines', monthly: 'Chaque mois' },
	status: { forming: 'En formation', active: 'En cours', completed: 'Terminé', abandoned: 'Arrêté' },
	card: {
		members: 'Membres',
		round: (i, t) => `Tour ${i} sur ${t}`,
		roundLabel: 'Rotation',
		progress: 'Progression',
		thisPeriod: 'Cette période',
		paidOf: (p, e) => `${p} sur ${e} versés`,
		nextDue: 'Prochaine échéance',
		dueIn: (d) => (d === 1 ? 'dans 1 jour' : `dans ${d} jours`),
		dueToday: 'aujourd’hui',
		overdueBy: (d) => (d === 1 ? 'échéance dépassée d’1 jour' : `échéance dépassée de ${d} jours`),
		noRoundOpen: 'Aucun tour ouvert',
		receiving: 'Reçoit',
		payoutVerified: 'Adresse de versement vérifiée',
		payoutUnverified: 'Adresse de versement non vérifiée',
		payoutVerifiedHint: 'Vérifiée par auto-envoi, et figée pour ce tour.',
		payoutUnverifiedHint: 'Ce tour ne devrait pas s’ouvrir avant la vérification de l’adresse.',
		unitsOnly: 'Les montants sont des unités de jetons — jamais une valorisation.',
	},
	discipline: {
		// "En retard" = late. NOT "défaillant" — the FR equivalent of the bank-speak
		// the doc bans. A missed week is an unfilled slot on her own card, not a verdict.
		early: 'En avance',
		on_time: 'À temps',
		late: 'En retard',
		behind: 'Versement en attente',
		pending: 'Pas encore dû',
		none: 'Pas encore d’historique',
	},
	footnote:
		'Versements observés sur la chaîne. Ce tableau montre la relation — jamais le solde du portefeuille d’une membre.',
};

const LOCALES: Record<string, CirclesLocale> = { en: EN, fr: FR, es: EN };

/** ES falls back to EN on purpose: the doc commits to EN/FR, and a machine-guessed
 *  Spanish would be worse than an honest English string. */
export function getCirclesLocale(lang: Lang): CirclesLocale {
	return LOCALES[lang] ?? EN;
}
