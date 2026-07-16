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
	/** Arranging a forming tin: the cards, the drag, the copy square. */
	arrange: {
		/** Sits under a forming tin's heading — says what he may do, and until when. */
		hint: string;
		/** The empty tin. Not an error: a tin with room is the ordinary start. */
		empty: string;
		/** Tooltip on the corner square. */
		copyHint: string;
		/** Screen-reader name for the square. Takes her name because "copy" alone,
		 *  read aloud out of context, names no one. */
		copyLabel: (name: string) => string;
		/** "Turn 3" — her slot in the order the group agreed. */
		turn: (n: number) => string;
		/** She is in the tin but has no slot yet. */
		noTurn: string;
		/** Flash after a successful drop. */
		moved: (name: string, tin: string) => string;
		copied: (name: string, tin: string) => string;
		/** Why a drop was refused. Keyed by the API's error string. */
		err: {
			tin_started: string;
			already_in_tin: string;
			slot_taken: string;
			demo_readonly: string;
			generic: string;
		};
	};
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
		repaid: string;
		behind: string;
		pending: string;
		none: string;
	};
	footnote: string;
	/** The lobby — the splash you land in, and the two doors out of it. */
	lobby: {
		welcome: string;
		admin: string;
		invitedBy: string;
	};
	/** The programme, in aggregate. No member ever appears here. */
	stats: {
		title: string;
		subtitle: string;
		loading: string;
		error: string;
		people: string;
		/** Count-aware: FR inflects, and "1 parties" is visibly wrong. */
		peopleActive: (n: number) => string;
		peopleDeparted: (n: number) => string;
		peopleTotal: string;
		activeOf: (a: number, t: number) => string;
		circles: string;
		circlesActive: string;
		completion: string;
		completionNone: string;
		discipline: string;
		disciplineHint: string;
		judgedOf: (n: number) => string;
		trend: string;
		trendHint: string;
		roundN: (n: number) => string;
		flow: string;
		flowIn: string;
		flowPayouts: string;
		unitsNote: string;
		withdrawals: string;
		withdrawalsHint: string;
		withdrawalsPeople: (n: number) => string;
		withdrawalsUnits: string;
		withdrawalsNone: string;
		safety: string;
		safetyVerified: string;
		safetyRisk: string;
		safetyRiskNone: string;
		ops: string;
		opsNotBuilt: string;
		export: string;
		exportHint: string;
		noData: string;
	};
	/** The tin, opened: the cards inside it. */
	drill: {
		back: string;
		loading: string;
		error: string;
		membersHeading: string;
		membersHint: string;
		memberSince: string;
		turnOf: (n: number, total: number) => string;
		noTurn: string;
		departed: string;
		departedOn: (d: string) => string;
		herTurnNow: string;
		uuidOnly: string;
		statusIn: string;
		statusLeft: string;
		actorOrganizer: string;
		roundsHeading: string;
		roundsHint: string;
		payoutObserved: string;
		payoutPending: string;
		eventsHeading: string;
		eventsHint: string;
		action: Record<string, string>;
	};
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
	arrange: {
		hint: 'Drag a card to move her to another tin. Drag the corner square to copy her into a second one. Once round 1 opens, the tin is set.',
		empty: 'Nobody yet. Drag a card in.',
		copyHint: 'Drag this square to copy her into a second tin — she stays in this one',
		copyLabel: (name) => `Copy ${name} into a second tin`,
		turn: (n) => `Turn ${n}`,
		noTurn: 'No turn yet',
		moved: (name, tin) => `${name} moved to ${tin}.`,
		copied: (name, tin) => `${name} copied into ${tin} — she is in both.`,
		err: {
			tin_started: 'That circle has already started. Its turn order is set.',
			already_in_tin: 'She is already in that tin.',
			slot_taken: 'That turn was just taken. Try again.',
			demo_readonly: 'Sign up free to arrange your own circles.',
			generic: 'That did not save. Try again.',
		},
	},
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
		repaid: 'Repaid',
		behind: 'Behind',
		pending: 'Not yet due',
		none: 'No record yet',
	},
	footnote:
		'Contributions observed on the chain. This dashboard shows the relationship — never a member’s wallet balance.',
	drill: {
		back: 'All circles',
		loading: 'Loading cards…',
		error: 'Could not load this circle',
		membersHeading: 'Cards',
		membersHint:
			'Who is in this circle, and where each turn sits. Payment records belong to the member and live on her own screen — the circle sees them, and the circle enforces.',
		memberSince: 'Member since',
		turnOf: (n, total) => `Turn ${n} of ${total}`,
		noTurn: 'No turn — saves at her own pace',
		departed: 'Left the circle',
		departedOn: (d) => `Left ${d}`,
		herTurnNow: 'Receiving this round',
		uuidOnly: 'This member chose no display name.',
		statusIn: 'In the group',
		statusLeft: 'Left',
		actorOrganizer: 'Organizer',
		roundsHeading: 'Rotation',
		roundsHint: 'Each round’s payout address is frozen when the round opens.',
		payoutObserved: 'Payout observed',
		payoutPending: 'Not yet paid out',
		eventsHeading: 'Circle log',
		eventsHint:
			'Append-only. Members can read this too — it is how they check the organizer. Ballots never appear here.',
		action: {
			contract_created: 'Circle created',
			turn_order_recorded: 'Turn order recorded',
			round_opened: 'Round opened',
			payout_observed: 'Payout observed',
			member_departed: 'A member left',
			member_replaced: 'Member replaced',
			early_withdrawal: 'Early withdrawal',
		},
	},
	lobby: {
		// The brand name does not translate; the sentence around it does.
		welcome: 'Welcome to SusuFinance',
		admin: 'admin',
		invitedBy: 'Invited by',
	},
	stats: {
		title: 'Programme',
		subtitle: 'How the programme is doing — never how any one member is doing',
		loading: 'Loading…',
		error: 'Could not load the programme figures',
		people: 'People',
		peopleActive: () => 'active',
		peopleDeparted: () => 'departed',
		peopleTotal: 'total',
		activeOf: (a, t) => `${a} of ${t} active`,
		circles: 'Circles & groups',
		circlesActive: 'running now',
		completion: 'Completion',
		completionNone: 'No cycle has finished yet — there is no completion record to report.',
		discipline: 'Contribution discipline',
		disciplineHint:
			'Across every contribution the programme expected. Contributions still inside their grace window are not counted — nobody is anything until the window the group agreed has closed.',
		judgedOf: (n) => `${n} contributions counted`,
		trend: 'Discipline by round',
		trendHint: 'Does discipline hold late in a rotation? The oldest question about savings circles, answered for this programme.',
		roundN: (n) => `Round ${n}`,
		flow: 'Money observed',
		flowIn: 'contributed',
		flowPayouts: 'payouts observed',
		unitsNote: 'Token units — never a valuation.',
		withdrawals: 'Early withdrawals',
		withdrawalsHint:
			'Her right, exercised. A high rate means emergencies or a product that does not fit — something to learn from, never to sanction. No member is named here, by design.',
		withdrawalsPeople: (n) => (n === 1 ? '1 member' : `${n} members`),
		withdrawalsUnits: 'withdrawn',
		withdrawalsNone: 'None yet.',
		safety: 'Safety',
		safetyVerified: 'payout addresses verified',
		safetyRisk: 'open rounds whose recipient is not verified',
		safetyRiskNone: 'Every open round has a verified recipient.',
		ops: 'Reminders',
		opsNotBuilt: 'Notifications are not built yet — nothing has been sent.',
		export: 'Export programme report',
		exportHint: 'Aggregates only. No member rows leave this programme.',
		noData: '—',
	},
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
	arrange: {
		hint: 'Faites glisser une carte pour la déplacer vers une autre boîte. Faites glisser le carré du coin pour la copier dans une deuxième. Dès l’ouverture du tour 1, la boîte est fixée.',
		empty: 'Personne pour l’instant. Faites glisser une carte ici.',
		copyHint: 'Faites glisser ce carré pour la copier dans une deuxième boîte — elle reste dans celle-ci',
		copyLabel: (name) => `Copier ${name} dans une deuxième boîte`,
		turn: (n) => `Tour ${n}`,
		noTurn: 'Pas encore de tour',
		moved: (name, tin) => `${name} déplacée vers ${tin}.`,
		copied: (name, tin) => `${name} copiée dans ${tin} — elle est dans les deux.`,
		err: {
			tin_started: 'Ce cercle a déjà commencé. Son ordre de passage est fixé.',
			already_in_tin: 'Elle est déjà dans cette boîte.',
			slot_taken: 'Ce tour vient d’être pris. Réessayez.',
			demo_readonly: 'Inscrivez-vous gratuitement pour organiser vos propres cercles.',
			generic: 'L’enregistrement a échoué. Réessayez.',
		},
	},
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
		repaid: 'Régularisé',
		behind: 'Versement en attente',
		pending: 'Pas encore dû',
		none: 'Pas encore d’historique',
	},
	footnote:
		'Versements observés sur la chaîne. Ce tableau montre la relation — jamais le solde du portefeuille d’une membre.',
	drill: {
		back: 'Tous les cercles',
		loading: 'Chargement des cartes…',
		error: 'Impossible de charger ce cercle',
		membersHeading: 'Cartes',
		membersHint:
			'Qui est dans ce cercle, et la place de chaque tour. L’historique des versements appartient à la membre et vit sur son propre écran — le cercle les voit, et le cercle fait respecter.',
		memberSince: 'Membre depuis',
		turnOf: (n, total) => `Tour ${n} sur ${total}`,
		noTurn: 'Sans tour — épargne à son rythme',
		departed: 'A quitté le cercle',
		departedOn: (d) => `Partie le ${d}`,
		herTurnNow: 'Reçoit ce tour-ci',
		uuidOnly: 'Cette membre n’a pas choisi de nom affiché.',
		statusIn: 'Dans le groupe',
		statusLeft: 'Partie',
		actorOrganizer: 'Organisateur',
		roundsHeading: 'Rotation',
		roundsHint: 'L’adresse de versement de chaque tour est figée à l’ouverture du tour.',
		payoutObserved: 'Versement observé',
		payoutPending: 'Pas encore versé',
		eventsHeading: 'Journal du cercle',
		eventsHint:
			'Ajout seul. Les membres peuvent le lire aussi — c’est ainsi qu’elles vérifient l’organisateur. Les bulletins n’y figurent jamais.',
		action: {
			contract_created: 'Cercle créé',
			turn_order_recorded: 'Ordre des tours enregistré',
			round_opened: 'Tour ouvert',
			payout_observed: 'Versement observé',
			member_departed: 'Une membre est partie',
			member_replaced: 'Membre remplacée',
			early_withdrawal: 'Retrait anticipé',
		},
	},
	lobby: {
		welcome: 'Bienvenue à SusuFinance',
		admin: 'admin',
		invitedBy: 'Invité par',
	},
	stats: {
		title: 'Programme',
		subtitle: 'Comment va le programme — jamais comment va une membre en particulier',
		loading: 'Chargement…',
		error: 'Impossible de charger les chiffres du programme',
		people: 'Personnes',
		peopleActive: (n) => (n > 1 ? 'actives' : 'active'),
		peopleDeparted: (n) => (n > 1 ? 'parties' : 'partie'),
		peopleTotal: 'au total',
		activeOf: (a, t) => `${a} ${a > 1 ? 'actives' : 'active'} sur ${t}`,
		circles: 'Cercles et groupes',
		circlesActive: 'en cours',
		completion: 'Cycles terminés',
		completionNone: 'Aucun cycle n’est encore terminé — il n’y a rien à rapporter.',
		discipline: 'Discipline des versements',
		disciplineHint:
			'Sur tous les versements attendus par le programme. Les versements encore dans leur délai de grâce ne sont pas comptés — personne n’est rien tant que le délai convenu par le groupe n’est pas écoulé.',
		judgedOf: (n) => `${n} versements comptés`,
		trend: 'Discipline par tour',
		trendHint: 'La discipline tient-elle en fin de rotation ? La plus vieille question sur les cercles d’épargne, répondue pour ce programme.',
		roundN: (n) => `Tour ${n}`,
		flow: 'Argent observé',
		flowIn: 'versés',
		flowPayouts: 'versements observés',
		unitsNote: 'Unités de jetons — jamais une valorisation.',
		withdrawals: 'Retraits anticipés',
		withdrawalsHint:
			'Son droit, exercé. Un taux élevé signale des urgences ou un produit inadapté — quelque chose à comprendre, jamais à sanctionner. Aucune membre n’est nommée ici, par conception.',
		withdrawalsPeople: (n) => (n === 1 ? '1 membre' : `${n} membres`),
		withdrawalsUnits: 'retirés',
		withdrawalsNone: 'Aucun pour l’instant.',
		safety: 'Sécurité',
		safetyVerified: 'adresses de versement vérifiées',
		safetyRisk: 'tours ouverts dont la bénéficiaire n’est pas vérifiée',
		safetyRiskNone: 'Chaque tour ouvert a une bénéficiaire vérifiée.',
		ops: 'Rappels',
		opsNotBuilt: 'Les notifications ne sont pas encore construites — rien n’a été envoyé.',
		export: 'Exporter le rapport du programme',
		exportHint: 'Agrégats uniquement. Aucune ligne de membre ne quitte ce programme.',
		noData: '—',
	},
};

const ES: CirclesLocale = {
	lang: 'es',
	page: {
		title: 'Círculos',
		subtitle: 'Cada círculo y grupo de ahorro de su programa',
		loading: 'Cargando los círculos…',
		empty: 'Todavía no hay círculos',
		emptyHint: 'Un círculo aparece aquí una vez creado y con sus integrantes inscritas.',
		error: 'No se pudieron cargar los círculos',
		retry: 'Reintentar',
	},
	kind: { circle: 'Círculo', targetGroup: 'Grupo de ahorro' },
	cadence: { weekly: 'Cada semana', biweekly: 'Cada dos semanas', monthly: 'Cada mes' },
	status: { forming: 'En formación', completed: 'Terminado', active: 'En curso', abandoned: 'Detenido' },
	arrange: {
		hint: 'Arrastre una tarjeta para moverla a otra lata. Arrastre el cuadrado de la esquina para copiarla en una segunda. Cuando se abra la ronda 1, la lata queda fijada.',
		empty: 'Todavía nadie. Arrastre una tarjeta aquí.',
		copyHint: 'Arrastre este cuadrado para copiarla en una segunda lata — ella sigue en esta',
		copyLabel: (name) => `Copiar a ${name} en una segunda lata`,
		turn: (n) => `Turno ${n}`,
		noTurn: 'Sin turno todavía',
		moved: (name, tin) => `${name} pasó a ${tin}.`,
		copied: (name, tin) => `${name} copiada en ${tin} — está en las dos.`,
		err: {
			tin_started: 'Ese círculo ya empezó. Su orden de turnos está fijado.',
			already_in_tin: 'Ella ya está en esa lata.',
			slot_taken: 'Ese turno acaba de ocuparse. Inténtelo de nuevo.',
			demo_readonly: 'Regístrese gratis para organizar sus propios círculos.',
			generic: 'No se guardó. Inténtelo de nuevo.',
		},
	},
	card: {
		members: 'Integrantes',
		round: (i, t) => `Ronda ${i} de ${t}`,
		roundLabel: 'Rotación',
		progress: 'Progreso',
		thisPeriod: 'Este período',
		paidOf: (p, e) => `${p} de ${e} aportaron`,
		nextDue: 'Próximo vencimiento',
		dueIn: (d) => (d === 1 ? 'en 1 día' : `en ${d} días`),
		dueToday: 'hoy',
		overdueBy: (d) => (d === 1 ? 'venció hace 1 día' : `venció hace ${d} días`),
		noRoundOpen: 'Ninguna ronda abierta',
		receiving: 'Recibe',
		payoutVerified: 'Dirección de pago verificada',
		payoutUnverified: 'Dirección de pago sin verificar',
		payoutVerifiedHint: 'Verificada por auto-envío, y fijada para esta ronda.',
		payoutUnverifiedHint: 'Esta ronda no debería abrirse hasta verificar la dirección.',
		unitsOnly: 'Los montos son unidades de token — nunca una valoración.',
	},
	discipline: {
		// "morosa" is the Spanish for delinquent and it is BANNED here, exactly as
		// "delinquent" and "défaillant" are: bank-speak imports the wrong moral frame,
		// and the operator's vocabulary becomes the programme's culture. `behind` means
		// only "she owes, now" — an aporte still awaited, not a verdict on a person.
		early: 'Anticipado',
		on_time: 'A tiempo',
		late: 'Con retraso',
		repaid: 'Regularizado',
		behind: 'Aporte en espera',
		pending: 'Aún no vence',
		none: 'Todavía sin historial',
	},
	footnote:
		'Aportes observados en la cadena. Este panel muestra la relación — nunca el saldo de la billetera de una integrante.',
	lobby: {
		welcome: 'Bienvenida a SusuFinance',
		admin: 'admin',
		invitedBy: 'Invitada por',
	},
	drill: {
		back: 'Todos los círculos',
		loading: 'Cargando las tarjetas…',
		error: 'No se pudo cargar este círculo',
		membersHeading: 'Tarjetas',
		membersHint:
			'Quién está en este círculo, y dónde va cada turno. El historial de aportes pertenece a la integrante y vive en su propia pantalla — el círculo lo ve, y el círculo hace cumplir.',
		memberSince: 'Integrante desde',
		turnOf: (n, total) => `Turno ${n} de ${total}`,
		noTurn: 'Sin turno — ahorra a su propio ritmo',
		departed: 'Dejó el círculo',
		departedOn: (d) => `Se fue el ${d}`,
		herTurnNow: 'Recibe esta ronda',
		uuidOnly: 'Esta integrante no eligió un nombre para mostrar.',
		statusIn: 'En el grupo',
		statusLeft: 'Se fue',
		actorOrganizer: 'Organizador',
		roundsHeading: 'Rotación',
		roundsHint: 'La dirección de pago de cada ronda se fija al abrir la ronda.',
		payoutObserved: 'Pago observado',
		payoutPending: 'Aún sin pagar',
		eventsHeading: 'Registro del círculo',
		eventsHint:
			'Solo se añade. Las integrantes también pueden leerlo — así verifican al organizador. Los votos nunca aparecen aquí.',
		action: {
			contract_created: 'Círculo creado',
			turn_order_recorded: 'Orden de turnos registrado',
			round_opened: 'Ronda abierta',
			payout_observed: 'Pago observado',
			member_departed: 'Una integrante se fue',
			member_replaced: 'Integrante reemplazada',
			early_withdrawal: 'Retiro anticipado',
		},
	},
	stats: {
		title: 'Programa',
		subtitle: 'Cómo va el programa — nunca cómo va una integrante en particular',
		loading: 'Cargando…',
		error: 'No se pudieron cargar las cifras del programa',
		people: 'Personas',
		peopleActive: (n) => (n > 1 ? 'activas' : 'activa'),
		peopleDeparted: (n) => (n > 1 ? 'se fueron' : 'se fue'),
		peopleTotal: 'en total',
		activeOf: (a, t) => `${a} ${a > 1 ? 'activas' : 'activa'} de ${t}`,
		circles: 'Círculos y grupos',
		circlesActive: 'en curso',
		completion: 'Ciclos terminados',
		completionNone: 'Ningún ciclo ha terminado todavía — no hay nada que reportar.',
		discipline: 'Disciplina de aportes',
		disciplineHint:
			'Sobre cada aporte que el programa esperaba. Los aportes que siguen dentro de su plazo de gracia no se cuentan — nadie es nada hasta que cierre el plazo que el grupo acordó.',
		judgedOf: (n) => `${n} aportes contados`,
		trend: 'Disciplina por ronda',
		trendHint: '¿Se sostiene la disciplina al final de una rotación? La pregunta más vieja sobre los círculos de ahorro, respondida para este programa.',
		roundN: (n) => `Ronda ${n}`,
		flow: 'Dinero observado',
		flowIn: 'aportados',
		flowPayouts: 'pagos observados',
		unitsNote: 'Unidades de token — nunca una valoración.',
		withdrawals: 'Retiros anticipados',
		withdrawalsHint:
			'Su derecho, ejercido. Una tasa alta señala emergencias o un producto que no encaja — algo para entender, nunca para sancionar. Aquí no se nombra a ninguna integrante, por diseño.',
		withdrawalsPeople: (n) => (n === 1 ? '1 integrante' : `${n} integrantes`),
		withdrawalsUnits: 'retirados',
		withdrawalsNone: 'Ninguno todavía.',
		safety: 'Seguridad',
		safetyVerified: 'direcciones de pago verificadas',
		safetyRisk: 'rondas abiertas cuya receptora no está verificada',
		safetyRiskNone: 'Cada ronda abierta tiene una receptora verificada.',
		ops: 'Recordatorios',
		opsNotBuilt: 'Las notificaciones aún no están construidas — no se ha enviado nada.',
		export: 'Exportar el informe del programa',
		exportHint: 'Solo agregados. Ninguna fila de integrante sale de este programa.',
		noData: '—',
	},
};

const LOCALES: Record<string, CirclesLocale> = { en: EN, fr: FR, es: ES };

/** Three languages, because the app's own switcher offers three. An `es: EN` fallback
 *  meant clicking ES silently served English — the switcher lying about itself, which
 *  is worse than a missing translation because nothing tells you anything is absent. */
export function getCirclesLocale(lang: Lang): CirclesLocale {
	return LOCALES[lang] ?? EN;
}
