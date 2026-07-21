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
];
