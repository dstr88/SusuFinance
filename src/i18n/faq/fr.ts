// FAQ — French items.
//
// Rewritten for SusuFinance. The previous 39 items were Almstins content that
// survived the carve-out: exchanges, portfolios, cost basis, a wallet checker. None
// of it described this product, and none of it was rendered anywhere.
//
// Written for the women who will actually read it. No jargon beyond "wallet" and
// "USDC", and the word "crypto" appears nowhere on purpose.
//
// Every claim here is true of the code as written. Two in particular were narrowed
// during review and should stay narrow:
//   · no custodian, no pot — members send to each other directly
//   · the promise is that nobody ELSE can see your balance, not that no system
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
    a: `<p>Non. SusuFinance gère l'administration du cercle, pas l'argent. Vos USDC restent dans votre propre portefeuille, que vous contrôlez. Il n'y a pas de cagnotte ici. Quand c'est votre tour, les autres envoient les USDC directement dans votre portefeuille.</p>
<p>L'application enregistre ce que le cercle a convenu et ce qui s'est passé, pour que chacune voie que chacune a payé. Elle ne détient jamais de fonds, et personne d'autre dans votre cercle, y compris l'organisatrice, ne peut voir votre solde. Il n'y a rien ici que quelqu'un puisse perdre ou emporter.</p>`,
  },
  {
    id: 'faq-payout-wallet',
    q: "Qu'est-ce qu'un portefeuille de versement, et pourquoi doit-il être vérifié ?",
    a: `<p>C'est là que votre tour vous est versé en USDC. Avant qu'il soit utilisé, vous prouvez que le portefeuille est le vôtre en vous envoyant un petit montant à vous-même. Cela prouve que vous le contrôlez sans donner vos clés à personne.</p>
<p>Vous avez deux semaines après avoir indiqué un portefeuille pour le prouver. D'ici là, vous verrez un rappel. Passé deux semaines, votre tour ne peut pas s'ouvrir tant que ce n'est pas prouvé. C'est voulu : votre tour est le moment où l'argent bouge, et il doit aller vers une adresse dont quelqu'un a confirmé qu'elle est la vôtre.</p>
<p>Si vous changez de portefeuille plus tard, les deux semaines recommencent, car c'est une autre adresse que personne n'a vérifiée.</p>`,
  },
  {
    id: 'faq-move-me',
    q: "L'organisatrice peut-elle me déplacer dans un autre cercle, ou m'en retirer ?",
    a: `<p>Seulement avant le début. Dès que le premier tour s'ouvre, elle ne peut plus vous déplacer, vous retirer, ni changer l'ordre.</p>
<p>Ajouter quelqu'un à un cercle en cours est un vote, et en retirer quelqu'un aussi. Elle peut proposer. C'est le groupe qui décide.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: "Qui peut voir ce que j'ai payé ?",
    a: `<p>Les personnes de votre cercle. C'est tout l'intérêt d'un susu : chacune voit que chacune a payé.</p>
<p>Ce que personne ne voit, y compris l'organisatrice, c'est le solde de votre portefeuille.</p>`,
  },
  {
    id: 'faq-scores',
    q: "L'application me note-t-elle ou nous classe-t-elle ?",
    a: `<p>Non. Elle montre des faits, comme le fait qu'un paiement soit arrivé à temps. Elle n'en fait jamais une note, un score, un niveau ou un classement. Personne n'est classée face à une autre.</p>`,
  },
  {
    id: 'faq-stops-paying',
    q: "Que se passe-t-il si quelqu'un arrête de payer ?",
    a: `<p>Vous le verrez, car le cercle montre ce qui s'est passé. Ce qu'il faut faire est la décision du groupe, pas celle de l'application. Elle ne relance personne, ne sanctionne personne et ne signale personne.</p>`,
  },
];
