// FAQ — French items.
//
// A guided path, not a reference. Ordered as she meets it: getting in, her wallet,
// paying, her card, then the questions to ask before joining.
//
// SHORT ANSWERS ARE THE RULE. She is reading on a phone, about money, possibly on a
// paid data bundle. Anything that needs three paragraphs is two questions. Steps go
// in a numbered list so she can follow along with the screen in front of her.
//
// No jargon past "wallet" and "USDC". The word "crypto" appears nowhere on purpose.
//
// Every claim is true of the code today, except one flagged in FAQquestions.claude.md:
// nothing observes payments yet, so "the circle shows what happened" is ahead of the
// watcher. Fix the copy or ship the watcher before a pilot.
import type { FaqItem } from '../faq';

export const items: FaqItem[] = [
  {
    id: 'faq-start',
    q: 'Comment mes amies et moi pouvons-nous commencer ?',
    a: `<ol><li>L'une de vous crée le cercle et lui donne un nom.</li>
<li>Elle fixe le montant en USDC que chacune verse, et à quelle fréquence.</li>
<li>Elle ajoute tout le monde et envoie un lien à chacune.</li>
<li>Vous ouvrez votre lien et vous vous connectez.</li></ol>
<p>C'est tout. Vous y êtes.</p>`,
  },
  {
    id: 'faq-my-link',
    q: "J'ai reçu un lien. Que dois-je faire ?",
    a: `<p>Ouvrez-le et connectez-vous. Cela vous place dans le cercle en tant que vous-même.</p>
<p>Il ne fonctionne qu'une fois et expire au bout de sept jours. S'il a expiré, demandez-en un nouveau.</p>`,
  },
  {
    id: 'faq-which-account',
    q: 'Avec quel e-mail dois-je me connecter ?',
    a: `<p>Un que vous aurez encore dans un an.</p>
<p>Ce compte est ce qui permet à votre cercle de savoir que c'est bien vous. Si vous le perdez, prévenez tout de suite votre organisatrice.</p>`,
  },
  {
    id: 'faq-my-screen',
    q: 'Où puis-je voir mon cercle ?',
    a: `<p>Connectez-vous, puis ouvrez votre panneau de compte en haut à droite.</p>
<p>Votre carte, votre portefeuille et tout ce qui vous attend s'y trouvent.</p>`,
  },
  {
    id: 'faq-add-wallet',
    q: 'Comment ajouter mon portefeuille ?',
    a: `<ol><li>Ouvrez votre panneau de compte.</li>
<li>Trouvez votre portefeuille de versement, en haut.</li>
<li>Collez votre adresse, ou modifiez celle qui s'y trouve.</li></ol>
<p>C'est là que votre tour vous est versé.</p>`,
  },
  {
    id: 'faq-prove-wallet',
    q: 'Comment prouver que le portefeuille est le mien ?',
    a: `<ol><li>Envoyez un petit montant depuis ce portefeuille vers lui-même.</li>
<li>Revenez et appuyez sur vérifier.</li></ol>
<p>Rien ne quitte votre portefeuille à part ce petit test, et aucune clé ne sort de vos mains.</p>`,
  },
  {
    id: 'faq-two-weeks',
    q: 'Pourquoi seulement deux semaines ?',
    a: `<p>Parce que votre tour est le moment où l'argent bouge, et il doit aller vers une adresse dont quelqu'un a confirmé qu'elle est la vôtre.</p>
<p>Passé deux semaines, votre tour ne peut pas s'ouvrir tant que le portefeuille n'est pas prouvé. Si vous en changez, les deux semaines recommencent.</p>`,
  },
  {
    id: 'faq-how-i-pay',
    q: 'Comment est-ce que je paie ?',
    a: `<p>Depuis votre portefeuille, comme pour envoyer des USDC à n'importe qui. Nous ne pouvons pas le faire à votre place.</p>
<p>L'application indique le montant, la date et l'adresse à laquelle ce tour est versé.</p>`,
  },
  {
    id: 'faq-check-address',
    q: "Dois-je vérifier l'adresse avant d'envoyer ?",
    a: `<p>Oui. À chaque fois.</p>
<p>Elle est figée à l'ouverture du tour : elle ne peut plus changer une fois visible. Lisez-la dans l'application, pas dans un message.</p>`,
  },
  {
    id: 'faq-my-card',
    q: 'Que signifient les marques sur ma carte ?',
    a: `<ul><li><strong>★</strong> payé à temps</li>
<li><strong>☆</strong> payé, mais en retard. Cela reste une étoile.</li>
<li><strong>◆</strong> votre tour. Vous ne deviez rien.</li>
<li><strong>○</strong> délai de grâce dépassé, toujours impayé</li>
<li><strong>·</strong> pas encore dû</li></ul>`,
  },
  {
    id: 'faq-late',
    q: 'Et si je paie en retard ?',
    a: `<p>Votre cercle accorde des jours de grâce. Pendant ces jours, rien n'est noté.</p>
<p>Après, vous avez quand même une étoile, simplement creuse. La carte dit en retard, pas mauvaise.</p>`,
  },
  {
    id: 'faq-missed',
    q: "Et si j'en saute un complètement ?",
    a: `<p>Cela apparaît comme impayé, et l'application n'en fait rien de plus.</p>
<p>Aucun frais, aucun blocage, personne en dehors de votre cercle n'est prévenu. La suite se règle entre vous et les femmes avec qui vous épargnez.</p>`,
  },
  {
    id: 'faq-voting',
    q: 'Quand est-ce que je vote ?',
    a: `<p>Quand le groupe décide au sujet d'une personne : une entrée, un départ, ou une question soulevée par une membre.</p>
<p>Cela apparaît dans votre panneau de compte.</p>`,
  },
  {
    id: 'faq-show-record',
    q: 'Puis-je montrer mon historique à un prêteur ?',
    a: `<p>Oui. Téléchargez votre carte depuis votre panneau de compte. Elle est signée, pour qu'un lecteur voie qu'elle n'a pas été modifiée.</p>
<p>Elle est à vous : à vous de l'envoyer ou non. Personne ne peut la partager à votre place.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: 'SusuFinance détient-il notre argent ?',
    a: `<p>Non. Il n'y a pas de cagnotte. Quand c'est votre tour, les autres envoient les USDC directement dans votre portefeuille.</p>
<p>Ni SusuFinance ni Almstins ne détiennent vos clés. Nous ne pouvons ni déplacer, ni bloquer, ni dépenser votre argent.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: "Qui peut voir ce que j'ai payé ?",
    a: `<p>Les femmes de votre cercle, comme vous voyez ce qu'elles ont payé.</p>
<p>Personne ne voit votre solde. Ni les autres membres, ni l'organisatrice.</p>`,
  },
  {
    id: 'faq-scores',
    q: "L'application me note-t-elle ?",
    a: `<p>Non. Elle montre ce qui s'est passé, jamais une note, un niveau, ni une comparaison.</p>`,
  },
  {
    id: 'faq-trust',
    q: "Comment savoir que ce n'est pas une arnaque ?",
    a: `<p>Vous ne nous confiez jamais votre argent : il n'y a rien à prendre. Si cette application disparaissait demain, vos USDC seraient toujours dans votre portefeuille.</p>
<p>Ce que vous jugez, ce sont les personnes, comme dans tout susu.</p>`,
  },
  {
    id: 'faq-leave',
    q: 'Puis-je quitter un cercle ?',
    a: `<p>Avant qu'il commence, oui. Dès que le premier tour s'ouvre, non.</p>
<p>Les autres ont organisé leurs tours autour du vôtre et certaines ont déjà payé. Partir est un vote que le groupe prend.</p>`,
  },
  {
    id: 'faq-organizer-vanishes',
    q: "Et si l'organisatrice disparaît ?",
    a: `<p>Le cercle s'arrête. Elle seule peut ouvrir chaque nouveau tour.</p>
<p>Votre argent n'est pas bloqué, il n'a jamais été rassemblé. Demandez-lui d'ajouter une deuxième organisatrice dès le premier jour.</p>`,
  },
  {
    id: 'faq-lose-phone',
    q: 'Et si je perds mon téléphone ?',
    a: `<p>Rien de ce qui vous appartient n'est dessus. Connectez-vous depuis un autre téléphone et tout y est.</p>
<p>C'est le compte qui compte, pas le téléphone.</p>`,
  },
  {
    id: 'faq-someone-stops',
    q: "Et si quelqu'un arrête de payer ?",
    a: `<p>Vous le verrez.</p>
<p>Ce qu'il faut faire est la décision du groupe. L'application ne la relancera pas, ne la sanctionnera pas et ne la signalera nulle part.</p>`,
  },
];
