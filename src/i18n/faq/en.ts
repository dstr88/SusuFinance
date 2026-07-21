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
];
