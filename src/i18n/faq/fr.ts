// FAQ — French items.
//
// Written for the women who will read it. No jargon past "wallet" and "USDC", and the
// word "crypto" appears nowhere on purpose.
//
// Ordered by what someone is actually nervous about when handing money to people
// through an app, not by what the product does. The questions that decide whether
// anyone joins come first.
//
// Every claim is true of the code today. Three were checked rather than assumed:
//   · only an owner or admin can open a round, so a circle stalls if the organizer
//     goes quiet and there is no second admin
//   · there is no self-leave; the only thing that sets left_at is an expulsion vote
//   · the promise is that nobody ELSE sees your balance, never that no system
//     anywhere touches the number. The first is architecture; the second would be a
//     hostage to every future feature.
import type { FaqItem } from '../faq';

export const items: FaqItem[] = [
  {
    id: 'faq-start',
    q: 'Comment mes amies et moi pouvons-nous commencer ?',
    a: `<p>L'une de vous crée le cercle. Elle lui donne un nom, fixe le montant en USDC que chacune verse et à quelle fréquence, puis ajoute tout le monde par son nom et envoie à chacune un lien privé.</p>
<p>Vous ouvrez votre lien, vous vous connectez, et vous êtes dans le cercle en tant que vous-même.</p>
<p>Tant que le cercle se forme, elle peut changer l'ordre des tours et ajouter ou retirer des personnes. Dès que le premier tour s'ouvre, l'ordre est fixé et personne ne peut le changer, elle non plus.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: 'SusuFinance détient-il notre argent ?',
    a: `<p>Non. SusuFinance gère l'administration du cercle, pas l'argent. Il n'y a pas de cagnotte ici. Quand c'est votre tour, les autres envoient les USDC directement dans votre portefeuille.</p>
<p>Ni SusuFinance ni Almstins ne détiennent jamais les clés de votre portefeuille. Nous ne pouvons ni déplacer votre argent, ni le bloquer, ni le dépenser, parce que nous n'avons rien pour le faire.</p>
<p>L'application enregistre ce que le cercle a convenu et ce qui s'est passé, pour que chacune voie que chacune a payé. Personne d'autre dans votre cercle, y compris l'organisatrice, ne peut voir votre solde.</p>`,
  },
  {
    id: 'faq-trust',
    q: "Comment savoir que ce n'est pas une arnaque ?",
    a: `<p>La réponse honnête, c'est que vous n'avez rien à nous confier, parce que nous ne détenons jamais votre argent. Il n'y a pas de compte à alimenter ici, ni de solde que nous pourrions bloquer. Si cette application disparaissait demain, vos USDC seraient toujours dans votre portefeuille.</p>
<p>Ce qu'il vous reste à juger, ce sont les personnes. Un susu a toujours reposé sur le fait de savoir avec qui vous épargnez, et aucune application ne change cela. Ce que celle-ci ajoute, c'est un registre partagé que toutes peuvent voir, pour qu'un désaccord sur qui a payé quoi se règle en regardant plutôt qu'en discutant.</p>`,
  },
  {
    id: 'faq-someone-stops',
    q: "Que se passe-t-il si quelqu'un arrête de payer ?",
    a: `<p>Vous le verrez. Le cercle montre ce qui s'est passé et quand, pour que personne n'ait à tenir ses propres comptes ni à croire une autre membre sur parole.</p>
<p>Ce qu'il faut faire est la décision du groupe, pas celle de l'application. Elle ne la relancera pas, ne la sanctionnera pas, ne la bloquera pas et ne la signalera nulle part. Retirer quelqu'un d'un cercle en cours est un vote, et c'est le groupe qui le prend.</p>`,
  },
  {
    id: 'faq-organizer-vanishes',
    q: 'Que se passe-t-il si la personne qui a créé le cercle disparaît ?',
    a: `<p>Soyez honnêtes entre vous là-dessus avant de commencer. Seule l'organisatrice peut ouvrir chaque nouveau tour, donc si elle ne donne plus signe de vie, le cercle s'arrête.</p>
<p>Votre argent n'est pas bloqué, parce qu'il n'a jamais été rassemblé quelque part. Les USDC de chacune restent dans son propre portefeuille tout du long. Mais les tours n'avancent plus tant que quelqu'un ayant les droits ne les ouvre pas.</p>
<p>La solution est simple et vaut la peine dès le premier jour : qu'elle ajoute une deuxième organisatrice. Deux personnes capables de faire tourner le cercle, c'est la différence entre une pause et un cercle mort.</p>`,
  },
  {
    id: 'faq-leave',
    q: 'Puis-je quitter un cercle ?',
    a: `<p>Avant qu'il commence, oui. Tant que le cercle se forme, l'organisatrice peut vous en retirer.</p>
<p>Dès que le premier tour s'ouvre, non. Vous ne pouvez pas vous retirer vous-même, et c'est voulu, pas un oubli. Les autres ont organisé leurs tours autour du vôtre, et certaines ont déjà payé dans une rotation qui vous compte dedans. Partir est un vote, et c'est le groupe qui le prend.</p>
<p>Cela se comprend avant de rejoindre, pas après. Un susu est une promesse faite à des personnes, et l'application vous y tient comme le groupe le ferait.</p>`,
  },
  {
    id: 'faq-lose-phone',
    q: 'Et si je perds mon téléphone ?',
    a: `<p>Rien de votre cercle ne vit sur votre téléphone : le perdre ou le casser ne vous coûte rien. Connectez-vous depuis un autre appareil avec le même compte et tout est là où vous l'aviez laissé.</p>
<p>Ce qui compte, c'est le compte, pas l'appareil. Gardez l'accès à l'adresse e-mail ou au compte Google avec lequel vous vous êtes connectée, car c'est ce qui vous identifie auprès de votre cercle. Si vous le perdez, prévenez tout de suite votre organisatrice.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: "Qui peut voir ce que j'ai payé ?",
    a: `<p>Les personnes de votre cercle. C'est tout l'intérêt d'un susu : chacune voit que chacune a payé, et c'est ce qui permet à l'ensemble de fonctionner sans que personne ne détienne l'argent.</p>
<p>Ce que personne ne voit, y compris l'organisatrice, c'est le solde de votre portefeuille. L'application ne lit pas les soldes et n'a aucun moyen d'en afficher un.</p>`,
  },
  {
    id: 'faq-scores',
    q: "L'application me note-t-elle ou nous classe-t-elle ?",
    a: `<p>Non. Elle montre des faits, comme le fait qu'un paiement soit arrivé à temps. Elle n'en fait jamais une note, un score, un niveau ou un classement, et elle ne vous compare à personne.</p>
<p>Ce que votre cercle sait déjà de vous, c'est ce que l'application montre. Elle ne construit pas une réputation qui vous suit.</p>`,
  },
];
