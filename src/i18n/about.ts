// About page — all user-visible strings (EN · ES · FR).
//
// Route-based i18n (see design.claude.md → "i18n Pattern — Public-Facing Pages").
// Rendered by src/components/AboutPage.astro; thin wrappers at
// src/pages/about.astro (en), /about/es.astro (es), /about/fr.astro (fr).
//
// Member-facing: it speaks to the woman signing up, not a founder story.
// Strings that carry inline <strong> are rendered with set:html in the
// component (safety.items and reach.body); everything else is plain text via
// {} auto-escaping.

import type { Lang } from '@/lib/i18n/locale';

export interface AboutContent {
  lang: Lang;
  meta: { title: string };
  hero: { p1: string; p2: string; p3: string };
  how: { heading: string; p1: string; p2: string; p3: string; p4: string };
  record: { heading: string; p1: string; p2: string; p3: string };
  safety: { heading: string; intro: string; items: string[] }; // items HTML
  cost: { heading: string; body: string };
  start: { heading: string; body: string };
  beta: { heading: string; body: string };
  close: string;
  reach: { heading: string; body: string }; // HTML
}

export const en: AboutContent = {
  lang: 'en',
  meta: { title: 'About SusuFinance — Your Susu, Kept Honest' },
  hero: {
    p1: `You already know how to save. You've done it for years, a little each day into a circle of women you trust, until it's your turn to carry the whole sum home.`,
    p2: `What you've never had is a bank that would have you. So your money sits in cedis that lose value every month, or in a paper book that can be lost, or with a collector who might not come back. You do everything right, and the system still doesn't count you.`,
    p3: `SusuFinance is your susu, kept honest. Same circle, same trust, same turn coming around. But your savings hold their value in dollars instead of leaking, the record is yours and can't be lost or disputed, and no one, not even us, can touch your money. You keep proving you're dependable. Now you finally have documentation to show for it, visible only to you and those you choose to share it with.`,
  },
  how: {
    heading: 'How it works',
    p1: `You and three to ten people you trust form a circle. You agree together on how much each person puts in, how often, and whose turn comes when. SusuFinance does not set those rules. Your circle does.`,
    p2: `Everyone contributes on schedule. When your turn comes around, the full amount is yours, all at once, to do what a slow trickle never could: pay a term of school fees, restock your table, cover an emergency, plant a season.`,
    p3: `There is no central pot. Money goes straight from each member to whoever's turn it is, so nothing sits in the middle for anyone to hold, lose, or run off with. And because your savings are kept in dollars, they hold their value while you wait for your turn, instead of shrinking a little every month.`,
    p4: `A susu does not earn interest and does not charge it. You take out what you put in. The gift is the timing: a full lump sum, when you need it, from money you saved a little at a time.`,
  },
  record: {
    heading: 'Your record belongs to you',
    p1: `Every contribution you make becomes part of your own susu card: the weeks you've paid, the cycles you've completed, a permanent record in your name.`,
    p2: `It is not a score. SusuFinance does not rank you, does not sell your record, and does not show it to anyone. It is yours. When you want to join a new circle, or show a lender that you have kept your word for years, you choose to share it. No one sees it unless you decide they should.`,
    p3: `Your discipline finally travels with you.`,
  },
  safety: {
    heading: 'Built to keep your money safe',
    intro: `SusuFinance is built around one idea: your money is yours, and no one, including us, should be able to touch it. Here is how we keep that promise.`,
    items: [
      `<strong>We do not collect what we do not need.</strong> No name, no ID, no KYC to open an account or join a circle. The app is built to hold nothing about you worth stealing.`,
      `<strong>We never hold your money or your keys.</strong> Your savings sit in your own account, secured on the blockchain (built on Base, Coinbase's network). The only key that can move your money lives on your own phone. There is no master key, and anyone can verify that on the public chain. No one at SusuFinance can move or freeze a single coin of yours.`,
      `<strong>There is no pot, no pool, no honeypot.</strong> Every member holds her own money in her own account. Nothing is ever gathered in one place, so there is nothing to steal and no interest to skim.`,
      `<strong>Lose your phone, and your circle helps you back in.</strong> Not us. Your circle. Any one member can freeze your account instantly to keep it safe, and a frozen account still holds every coin. Connecting a new phone takes a few members and a short waiting period, so an honest loss is always recoverable, and a thief can never rush it.`,
    ],
  },
  cost: {
    heading: 'What it costs',
    body: `Nothing. SusuFinance is free.`,
  },
  start: {
    heading: 'What you need to start',
    body: `A phone, and people you trust. If you do not have your own phone, borrowing one to check your card is fine. Everything else, you already have: you know how to save, and you know who to save with.`,
  },
  beta: {
    heading: 'A note while we grow',
    body: `SusuFinance is new, and some pieces described here are still reaching every circle. What never changes is the promise underneath: we never hold your money, and your record is always yours.`,
  },
  close: `For generations, women have built security out of trust and small, faithful contributions, long before any bank offered to help. SusuFinance does not replace that. It protects it. Same circle. Same trust. Now with a record that is yours, savings that hold their worth, and the certainty that no one can ever come between you and your money.`,
  reach: {
    heading: 'Questions?',
    body: `We read every message. Email us at <strong>hello@susufinance.com</strong>.`,
  },
};

export const es: AboutContent = {
  lang: 'es',
  meta: { title: 'Sobre SusuFinance — Tu susu, con un registro honesto' },
  hero: {
    p1: `Ya sabes ahorrar. Lo has hecho durante años, un poco cada día en un círculo de mujeres en las que confías, hasta que llega tu turno de llevarte la suma completa a casa.`,
    p2: `Lo que nunca has tenido es un banco que te acepte. Así que tu dinero se queda en cedis que pierden valor cada mes, o en un cuaderno de papel que se puede perder, o con un cobrador que quizás no regrese. Haces todo bien, y el sistema aun así no te cuenta.`,
    p3: `SusuFinance es tu susu, con un registro honesto. El mismo círculo, la misma confianza, el mismo turno que vuelve. Pero tus ahorros mantienen su valor en dólares en lugar de escurrirse, el registro es tuyo y no se puede perder ni disputar, y nadie, ni siquiera nosotros, puede tocar tu dinero. Sigues demostrando que eres confiable. Ahora por fin tienes constancia de ello, visible solo para ti y para quienes tú decidas mostrársela.`,
  },
  how: {
    heading: 'Cómo funciona',
    p1: `Tú y entre tres y diez personas de confianza forman un círculo. Acuerdan juntas cuánto aporta cada una, con qué frecuencia y a quién le toca cuándo. SusuFinance no fija esas reglas. Tu círculo lo hace.`,
    p2: `Todas aportan según lo acordado. Cuando llega tu turno, el monto completo es tuyo, todo de una vez, para hacer lo que un goteo lento nunca podría: pagar un trimestre de colegiatura, reabastecer tu puesto, cubrir una emergencia, sembrar una temporada.`,
    p3: `No hay un fondo central. El dinero va directo de cada integrante a quien le toca el turno, así que nada queda en medio para que alguien lo guarde, lo pierda o se lo lleve. Y como tus ahorros se mantienen en dólares, conservan su valor mientras esperas tu turno, en vez de encogerse un poco cada mes.`,
    p4: `Un susu no gana intereses ni los cobra. Sacas lo que pones. El regalo es el momento oportuno: una suma completa, cuando la necesitas, de un dinero que ahorraste poco a poco.`,
  },
  record: {
    heading: 'Tu registro te pertenece',
    p1: `Cada aporte que haces pasa a formar parte de tu propia tarjeta susu: las semanas que has pagado, los ciclos que has completado, un registro permanente a tu nombre.`,
    p2: `No es una calificación. SusuFinance no te clasifica, no vende tu registro y no se lo muestra a nadie. Es tuyo. Cuando quieras unirte a un nuevo círculo, o mostrarle a un prestamista que has cumplido tu palabra durante años, tú eliges compartirlo. Nadie lo ve a menos que tú lo decidas.`,
    p3: `Tu disciplina por fin viaja contigo.`,
  },
  safety: {
    heading: 'Hecho para mantener tu dinero seguro',
    intro: `SusuFinance se construye sobre una sola idea: tu dinero es tuyo, y nadie, incluidos nosotros, debería poder tocarlo. Así cumplimos esa promesa.`,
    items: [
      `<strong>No recopilamos lo que no necesitamos.</strong> Sin nombre, sin identificación, sin KYC para abrir una cuenta o unirte a un círculo. La aplicación está hecha para no guardar nada tuyo que valga la pena robar.`,
      `<strong>Nunca guardamos tu dinero ni tus llaves.</strong> Tus ahorros están en tu propia cuenta, protegidos en la blockchain (construida sobre Base, la red de Coinbase). La única llave que puede mover tu dinero vive en tu propio teléfono. No hay llave maestra, y cualquiera puede verificarlo en la cadena pública. Nadie en SusuFinance puede mover ni congelar una sola moneda tuya.`,
      `<strong>No hay fondo, ni bolsa común, ni honeypot.</strong> Cada integrante guarda su propio dinero en su propia cuenta. Nada se junta nunca en un solo lugar, así que no hay nada que robar ni intereses que descontar.`,
      `<strong>Si pierdes tu teléfono, tu círculo te ayuda a volver.</strong> Nosotros no. Tu círculo. Cualquier integrante puede congelar tu cuenta al instante para protegerla, y una cuenta congelada conserva cada moneda. Conectar un teléfono nuevo requiere a varias integrantes y un breve período de espera, de modo que una pérdida honesta siempre se puede recuperar, y un ladrón nunca puede apresurarlo.`,
    ],
  },
  cost: {
    heading: 'Cuánto cuesta',
    body: `Nada. SusuFinance es gratis.`,
  },
  start: {
    heading: 'Qué necesitas para empezar',
    body: `Un teléfono, y personas en las que confíes. Si no tienes tu propio teléfono, pedir uno prestado para revisar tu tarjeta está bien. Todo lo demás ya lo tienes: sabes ahorrar y sabes con quién ahorrar.`,
  },
  beta: {
    heading: 'Una nota mientras crecemos',
    body: `SusuFinance es nuevo, y algunas de las partes descritas aquí todavía están llegando a todos los círculos. Lo que nunca cambia es la promesa de fondo: nunca guardamos tu dinero, y tu registro siempre es tuyo.`,
  },
  close: `Durante generaciones, las mujeres han construido seguridad a partir de la confianza y de aportes pequeños y constantes, mucho antes de que algún banco se ofreciera a ayudar. SusuFinance no reemplaza eso. Lo protege. El mismo círculo. La misma confianza. Ahora con un registro que es tuyo, ahorros que conservan su valor y la certeza de que nadie podrá jamás interponerse entre tú y tu dinero.`,
  reach: {
    heading: '¿Preguntas?',
    body: `Leemos cada mensaje. Escríbenos a <strong>hello@susufinance.com</strong>.`,
  },
};

export const fr: AboutContent = {
  lang: 'fr',
  meta: { title: 'À propos de SusuFinance — Votre susu, avec un registre honnête' },
  hero: {
    p1: `Vous savez déjà épargner. Vous le faites depuis des années, un peu chaque jour dans un cercle de femmes en qui vous avez confiance, jusqu'à ce que ce soit votre tour de rapporter toute la somme à la maison.`,
    p2: `Ce que vous n'avez jamais eu, c'est une banque qui veuille de vous. Alors votre argent dort dans des cedis qui perdent de la valeur chaque mois, ou dans un cahier en papier qui peut se perdre, ou chez un collecteur qui ne reviendra peut-être pas. Vous faites tout comme il faut, et le système ne vous compte toujours pas.`,
    p3: `SusuFinance, c'est votre susu, avec un registre honnête. Le même cercle, la même confiance, le même tour qui revient. Mais votre épargne garde sa valeur en dollars au lieu de fondre, le registre est le vôtre et ne peut être ni perdu ni contesté, et personne, pas même nous, ne peut toucher à votre argent. Vous continuez de prouver que vous êtes fiable. Vous en avez enfin une preuve, visible seulement par vous et par ceux à qui vous choisissez de la montrer.`,
  },
  how: {
    heading: 'Comment ça marche',
    p1: `Vous et trois à dix personnes de confiance formez un cercle. Vous décidez ensemble combien chacune verse, à quelle fréquence, et à qui revient chaque tour. SusuFinance ne fixe pas ces règles. Votre cercle le fait.`,
    p2: `Chacune verse selon le calendrier convenu. Quand vient votre tour, la somme entière est à vous, d'un seul coup, pour faire ce qu'un filet lent ne permettrait jamais : payer un trimestre de frais de scolarité, réapprovisionner votre étal, faire face à une urgence, semer une saison.`,
    p3: `Il n'y a pas de caisse centrale. L'argent va directement de chaque membre à celle dont c'est le tour, donc rien ne reste au milieu pour que quelqu'un le garde, le perde ou l'emporte. Et comme votre épargne est conservée en dollars, elle garde sa valeur pendant que vous attendez votre tour, au lieu de diminuer un peu chaque mois.`,
    p4: `Un susu ne rapporte pas d'intérêts et n'en prélève pas. Vous retirez ce que vous versez. Le cadeau, c'est le moment : une somme entière, quand vous en avez besoin, d'un argent que vous avez épargné petit à petit.`,
  },
  record: {
    heading: 'Votre registre vous appartient',
    p1: `Chaque versement que vous faites vient s'ajouter à votre propre carte susu : les semaines où vous avez payé, les cycles que vous avez terminés, un registre permanent à votre nom.`,
    p2: `Ce n'est pas une note. SusuFinance ne vous classe pas, ne vend pas votre registre et ne le montre à personne. Il est à vous. Quand vous voulez rejoindre un nouveau cercle, ou montrer à un prêteur que vous avez tenu parole pendant des années, c'est vous qui choisissez de le partager. Personne ne le voit à moins que vous ne le décidiez.`,
    p3: `Votre discipline voyage enfin avec vous.`,
  },
  safety: {
    heading: 'Conçu pour garder votre argent en sécurité',
    intro: `SusuFinance repose sur une seule idée : votre argent est le vôtre, et personne, nous compris, ne devrait pouvoir y toucher. Voici comment nous tenons cette promesse.`,
    items: [
      `<strong>Nous ne collectons pas ce dont nous n'avons pas besoin.</strong> Pas de nom, pas de pièce d'identité, pas de KYC pour ouvrir un compte ou rejoindre un cercle. L'application est conçue pour ne rien détenir de vous qui vaille la peine d'être volé.`,
      `<strong>Nous ne détenons jamais votre argent ni vos clés.</strong> Votre épargne se trouve dans votre propre compte, sécurisée sur la blockchain (construite sur Base, le réseau de Coinbase). La seule clé qui peut déplacer votre argent se trouve sur votre propre téléphone. Il n'y a pas de clé maîtresse, et n'importe qui peut le vérifier sur la chaîne publique. Personne chez SusuFinance ne peut déplacer ni geler une seule de vos pièces.`,
      `<strong>Il n'y a pas de caisse, pas de pot commun, pas de honeypot.</strong> Chaque membre garde son propre argent dans son propre compte. Rien n'est jamais rassemblé au même endroit, donc il n'y a rien à voler ni d'intérêts à prélever.`,
      `<strong>Si vous perdez votre téléphone, votre cercle vous aide à revenir.</strong> Pas nous. Votre cercle. N'importe quelle membre peut geler votre compte à l'instant pour le protéger, et un compte gelé conserve chaque pièce. Connecter un nouveau téléphone demande quelques membres et un court délai d'attente, de sorte qu'une perte honnête est toujours récupérable, et qu'un voleur ne peut jamais la précipiter.`,
    ],
  },
  cost: {
    heading: 'Combien ça coûte',
    body: `Rien. SusuFinance est gratuit.`,
  },
  start: {
    heading: `Ce qu'il vous faut pour commencer`,
    body: `Un téléphone, et des personnes de confiance. Si vous n'avez pas votre propre téléphone, en emprunter un pour consulter votre carte convient très bien. Tout le reste, vous l'avez déjà : vous savez épargner, et vous savez avec qui.`,
  },
  beta: {
    heading: 'Un mot pendant que nous grandissons',
    body: `SusuFinance est récent, et certaines parties décrites ici arrivent encore dans tous les cercles. Ce qui ne change jamais, c'est la promesse au fond : nous ne détenons jamais votre argent, et votre registre est toujours le vôtre.`,
  },
  close: `Depuis des générations, les femmes bâtissent leur sécurité à partir de la confiance et de petites contributions fidèles, bien avant qu'une banque ne propose son aide. SusuFinance ne remplace pas cela. Il le protège. Le même cercle. La même confiance. Désormais avec un registre qui est le vôtre, une épargne qui garde sa valeur, et la certitude que personne ne pourra jamais s'interposer entre vous et votre argent.`,
  reach: {
    heading: 'Des questions ?',
    body: `Nous lisons chaque message. Écrivez-nous à <strong>hello@susufinance.com</strong>.`,
  },
};
