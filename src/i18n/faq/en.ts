// FAQ — English source items.
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
    q: 'How can my friends and I start?',
    a: `<p>One of you sets up the circle. She names it, sets how much USDC each person puts in and how often, then adds everyone by name and sends each person a private link.</p>
<p>You open your link, sign in, and you are in the circle as yourself.</p>
<p>While the circle is still forming, she can change the order of turns and add or remove people. Once the first round opens, the order is set and nobody can change it, including her.</p>`,
  },
  {
    id: 'faq-my-link',
    q: 'I got a link. What do I do?',
    a: `<p>Open it and sign in. That is what puts you in the circle as yourself, with your name and your place in the order.</p>
<p>Use an email address or Google account you will still have in a year. That account is how your circle knows you are you, so keep it safe. If you ever lose it, tell your organizer straight away.</p>
<p>Your link works once and expires after seven days. If it has expired, ask your organizer for a new one.</p>`,
  },
  {
    id: 'faq-how-i-pay',
    q: 'How do I actually pay?',
    a: `<p>From your wallet, the same way you would send USDC to anyone. SusuFinance does not take the payment and cannot take it for you. On the day, you send your share to whoever's turn it is.</p>
<p>The app shows you how much, when it is due, and which address this round pays to. Check that address in the app before you send, every time. It is frozen when the round opens so it cannot change underneath you.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: 'Does SusuFinance hold our money?',
    a: `<p>No. SusuFinance runs the administration of the circle, not the money. There is no pot here. When it is your turn, the others send USDC directly to your wallet.</p>
<p>Neither SusuFinance nor Almstins ever holds the keys to your wallet. We cannot move your money, freeze it, or spend it, because we have nothing to move it with.</p>
<p>The app records what the circle agreed and what happened, so everyone can see that everyone paid. Nobody else in your circle, including the organizer, can see your balance.</p>`,
  },
  {
    id: 'faq-trust',
    q: 'How do I know this is not a scam?',
    a: `<p>The honest answer is that you do not have to trust us with anything, because we never hold your money. There is no account here to fund and no balance for us to freeze. If this app disappeared tomorrow, your USDC would still be in your wallet.</p>
<p>What you do still have to judge is the people. A susu has always been built on knowing who you are saving with, and no app changes that. What this one adds is a shared record everyone can see, so a disagreement about who paid what is settled by looking rather than arguing.</p>`,
  },
  {
    id: 'faq-someone-stops',
    q: 'What if someone stops paying?',
    a: `<p>You will see it. The circle shows what happened and when, so nobody has to keep their own tally or take another member's word for it.</p>
<p>What to do about it is the group's decision, not the app's. It will not chase her, fine her, lock her out, or report her anywhere. Removing someone from a running circle is a vote, and the group takes it.</p>`,
  },
  {
    id: 'faq-organizer-vanishes',
    q: 'What if the person who set it up disappears?',
    a: `<p>Be honest with yourselves about this one before you start. Opening each new round is something only the organizer can do, so if she goes quiet the circle stalls.</p>
<p>Your money is not stuck, because it was never in one place to be stuck. Everyone's USDC is in her own wallet the whole time. But the rounds stop advancing until someone with the right access opens them.</p>
<p>The fix is simple and worth doing on day one: have her add a second organizer. Two people who can keep it running is the difference between a pause and a dead circle.</p>`,
  },
  {
    id: 'faq-leave',
    q: 'Can I leave a circle?',
    a: `<p>Before it starts, yes. While a circle is still forming, the organizer can take you out of it.</p>
<p>Once the first round opens, no. You cannot remove yourself, and that is deliberate rather than an oversight. The others arranged their turns around yours, and some of them have already paid into a rotation expecting you to be in it. Leaving is a vote, and the group takes it.</p>
<p>This is worth understanding before you join, not after. A susu is a promise to people, and the app is built to hold you to it the same way the group would.</p>`,
  },
  {
    id: 'faq-lose-phone',
    q: 'What if I lose my phone?',
    a: `<p>Nothing about your circle lives on your phone, so a lost or broken phone costs you nothing. Sign in on another one with the same account and everything is where you left it.</p>
<p>What matters is the account itself, not the device. Keep access to the email address or Google account you signed in with, because that is what identifies you to your circle. If you lose that, tell your organizer straight away.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: 'Who can see what I have paid?',
    a: `<p>The people in your circle. That is the point of a susu: everyone can see that everyone paid, which is what makes it work without anyone holding the money.</p>
<p>What nobody sees, including the organizer, is your wallet balance. The app does not read balances and has no way to show one.</p>`,
  },
  {
    id: 'faq-scores',
    q: 'Does the app score me or rank us?',
    a: `<p>No. It shows facts, like whether a payment came on time. It never turns those into a score, a rating, a level, or a leaderboard, and it never compares you to anyone.</p>
<p>What your circle already knows about you is what the app shows. It does not build a reputation that follows you around.</p>`,
  },
];
