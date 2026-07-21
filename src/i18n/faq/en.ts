// FAQ — English source items.
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
    q: 'How can my friends and I start?',
    a: `<p>One of you sets up the circle. She names it, sets how much USDC each person puts in and how often, then adds everyone by name and sends each person a private link.</p>
<p>You open your link, sign in, and you are in the circle as yourself.</p>
<p>While the circle is still forming, she can change the order of turns and add or remove people. Once the first round opens, the order is set and nobody can change it, including her.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: 'Does SusuFinance hold our money?',
    a: `<p>No. SusuFinance runs the administration of the circle, not the money. Your USDC stays in your own wallet, which you control. There is no pot here. When it is your turn, the others send USDC directly to your wallet.</p>
<p>The app records what the circle agreed and what happened, so everyone can see that everyone paid. It never holds funds, and nobody else in your circle, including the organizer, can see your balance. There is nothing here for anyone to lose or run off with.</p>`,
  },
  {
    id: 'faq-payout-wallet',
    q: 'What is a payout wallet, and why does mine need checking?',
    a: `<p>It is where your turn gets paid in USDC. Before it is used, you prove the wallet is yours by sending a small amount from it to itself. That proves you control it without giving anyone your keys.</p>
<p>You have two weeks from setting a wallet to prove it. Until then you will see a reminder. After two weeks, your turn cannot open until it is proven. That is deliberate: your turn is the moment money moves, and it should go to an address someone confirmed is yours.</p>
<p>If you change your wallet later, the two weeks start again, because it is a different address nobody has checked.</p>`,
  },
  {
    id: 'faq-move-me',
    q: 'Can the organizer move me into a different circle, or out of one?',
    a: `<p>Only before it starts. Once the first round opens, she cannot move you, remove you, or change the order.</p>
<p>Adding someone to a running circle is a vote, and so is removing someone. She can propose. The group decides.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: 'Who can see what I have paid?',
    a: `<p>The people in your circle. That is the point of a susu: everyone can see that everyone paid.</p>
<p>What nobody sees, including the organizer, is your wallet balance.</p>`,
  },
  {
    id: 'faq-scores',
    q: 'Does the app score me or rank us?',
    a: `<p>No. It shows facts, like whether a payment came on time. It never turns those into a score, a rating, a tier, or a leaderboard. Nobody is ranked against anybody.</p>`,
  },
  {
    id: 'faq-stops-paying',
    q: 'What if someone stops paying?',
    a: `<p>You will see it, because the circle shows what happened. What to do about it is the group's decision, not the app's. It will not chase, penalize, or report anyone.</p>`,
  },
];
