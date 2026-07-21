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
    id: 'faq-my-link',
    q: "J'ai reçu un lien. Que dois-je faire ?",
    a: `<p>Ouvrez-le et connectez-vous. C'est ce qui vous place dans le cercle en tant que vous-même, avec votre nom et votre place dans l'ordre.</p>
<p>Utilisez une adresse e-mail ou un compte Google que vous aurez encore dans un an. Ce compte est ce qui permet à votre cercle de savoir que c'est bien vous, alors gardez-y accès. Si vous le perdez un jour, prévenez tout de suite votre organisatrice.</p>
<p>Votre lien ne fonctionne qu'une fois et expire au bout de sept jours. S'il a expiré, demandez-en un nouveau à votre organisatrice.</p>`,
  },
  {
    id: 'faq-how-i-pay',
    q: 'Comment est-ce que je paie concrètement ?',
    a: `<p>Depuis votre portefeuille, exactement comme vous enverriez des USDC à quelqu'un. SusuFinance ne prend pas le paiement et ne peut pas le faire à votre place. Le jour venu, vous envoyez votre part à celle dont c'est le tour.</p>
<p>L'application vous indique le montant, la date et l'adresse à laquelle ce tour est versé. Vérifiez cette adresse dans l'application avant chaque envoi. Elle est figée à l'ouverture du tour, elle ne peut donc pas changer à votre insu.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: 'SusuFinance détient-il notre argent ?',
    a: `<p>Non. SusuFinance gère l'administration du cercle, pas l'argent. Il n'y a pas de cagnotte ici. Quand c'est votre tour, les autres envoient les USDC directement dans votre portefeuille.</p>
<p>Ni SusuFinance ni Almstins ne détiennent jamais les clés de votre portefeuille. Nous ne pouvons ni déplacer votre argent, ni le bloquer, ni le dépenser, parce que nous n'avons rien pour le faire.</p>
<p>L'application enregistre ce que le cercle a convenu et ce qui s'est passé, pour que chacune voie que chacune a payé. Personne d'autre dans votre cercle, y compris l'organisatrice, ne peut voir votre solde.</p>`,
  },
  {
    id: 'faq-my-screen',
    q: 'Où puis-je voir mon cercle ?',
    a: `<p>Connectez-vous et ouvrez votre panneau de compte, en haut à droite de la page. Tout ce qui vous concerne s'y trouve.</p>
<p>Pour chaque cercle où vous êtes, vous verrez votre carte, tout vote qui vous attend, et un espace pour soumettre une question au groupe. Vous y verrez aussi votre portefeuille de versement, s'il a été prouvé, et la liste de ce qui est entré et sorti.</p>
<p>Vous ne verrez le solde de personne, et personne ne voit le vôtre. Ce que vous voyez des autres, c'est ce qu'elles ont payé et quand : exactement ce qu'elles voient de vous.</p>`,
  },
  {
    id: 'faq-my-wallet-setup',
    q: "Comment configurer mon portefeuille et prouver qu'il est à moi ?",
    a: `<p>Ouvrez votre panneau de compte. Votre portefeuille de versement est en haut ; si votre organisatrice en a indiqué un pour vous, il y est déjà et vous pouvez le changer.</p>
<p>En dessous, un bouton permet de le vérifier. Le prouver consiste à vous envoyer un petit montant depuis ce portefeuille vers lui-même, puis à appuyer sur vérifier. Rien ne quitte votre portefeuille à part ce petit test, et aucune clé ne sort jamais de vos mains.</p>
<p>Deux choses à savoir. Vous avez <strong>deux semaines</strong> après avoir indiqué un portefeuille pour le prouver, sinon votre tour ne pourra pas s'ouvrir. Et si vous changez de portefeuille plus tard, les deux semaines recommencent, car c'est une nouvelle adresse que personne n'a vérifiée.</p>`,
  },
  {
    id: 'faq-my-card',
    q: 'Que signifient les marques sur ma carte ?',
    a: `<p>Votre carte, c'est votre historique dans ce cercle. La rangée de marques correspond au cycle en cours, une marque par tour, dans l'ordre :</p>
<ul>
<li><strong>★</strong> payé à temps, ou en avance</li>
<li><strong>☆</strong> payé, mais en retard, ou régularisé ensuite. Cela reste une étoile.</li>
<li><strong>◆</strong> votre tour. Le cercle vous a payée, vous ne deviez rien.</li>
<li><strong>○</strong> délai de grâce dépassé et toujours impayé</li>
<li><strong>·</strong> pas encore dû, ou encore dans le délai de grâce</li>
</ul>
<p>En dessous figurent vos totaux sur tous les cycles, qui ne sont jamais compressés ni moyennés. Il n'y a aucune note nulle part, et aucune comparaison avec les autres. C'est un relevé de ce qui s'est passé, pas un jugement sur vous.</p>`,
  },
  {
    id: 'faq-late',
    q: "Et si je paie en retard, ou que j'en saute un ?",
    a: `<p>Votre cercle fixe un nombre de jours de grâce, et pendant ces jours-là rien n'est noté contre vous. Payer après cela donne quand même une étoile, simplement creuse : la carte dit en retard, pas mauvaise.</p>
<p>Un seul état signifie une dette ouverte : délai dépassé et toujours impayé. Même alors, l'application ne fait rien contre vous. Elle ne vous facture rien, ne vous bloque pas, ne vous relance pas et ne prévient personne en dehors de votre cercle. La suite se règle entre vous et les femmes avec qui vous épargnez, comme un susu l'a toujours fait.</p>`,
  },
  {
    id: 'faq-voting',
    q: 'Quand est-ce que je vote ?',
    a: `<p>Quand le groupe doit décider au sujet d'une personne. Quelqu'un qui demande à entrer, quelqu'un qu'on retire, ou une question soulevée par une membre. Le vote apparaît dans votre panneau de compte, avec le cercle concerné.</p>
<p>Votre organisatrice ne peut ni ajouter ni retirer quelqu'un seule dans un cercle en cours. Elle peut le proposer. C'est le groupe qui décide, et vous en faites partie.</p>
<p>Vous pouvez vous-même soulever une question depuis ce même panneau, dans l'espace sous votre cercle.</p>`,
  },
  {
    id: 'faq-show-record',
    q: "Puis-je montrer mon historique à quelqu'un, par exemple un prêteur ?",
    a: `<p>Oui, et c'est bien l'intérêt de le tenir. Depuis votre panneau de compte, vous pouvez télécharger votre carte sous forme de fichier, signé par SusuFinance, pour que la personne qui le lit puisse voir qu'il n'a pas été modifié.</p>
<p>Il est à vous : à vous de l'envoyer ou non. Personne ne peut le partager à votre place, l'organisatrice ne peut pas l'exporter à votre sujet, et la signature atteste seulement que le relevé vient de nous sans modification. Ce n'est pas une note de crédit et cela ne dit pas si vous êtes un bon ou un mauvais risque. C'est la preuve de ce que vous avez fait ; ce que cela vaut, c'est à la personne qui le lit d'en juger.</p>`,
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
