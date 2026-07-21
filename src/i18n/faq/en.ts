// FAQ — English source items.
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
// Two audiences in one list, split by `audience`. Member items (the default) render
// in the footer, which puts them on every page including the lobby. Admin items render
// on /admin. Keeping them in one file means a question can move audience by editing
// one word, which is what happens the first time it is asked on the wrong page.
//
// Every claim is true of the code today, except one flagged in FAQquestions.claude.md:
// nothing observes payments yet, so "the circle shows what happened" is ahead of the
// watcher. Fix the copy or ship the watcher before a pilot.
import type { FaqItem } from '../faq';

export const items: FaqItem[] = [
  {
    id: 'faq-start',
    q: 'How can my friends and I start?',
    a: `<ol><li>One of you sets up the circle and names it.</li>
<li>She sets how much USDC each person pays, and how often.</li>
<li>She adds everyone and sends each of you a link.</li>
<li>You open your link and sign in.</li></ol>
<p>That is it. You are in.</p>`,
  },
  {
    id: 'faq-my-link',
    q: 'I got a link. What do I do?',
    a: `<p>Open it and sign in. That puts you in the circle as yourself.</p>
<p>It works once, and it expires after seven days. If yours has expired, ask for a new one.</p>`,
  },
  {
    id: 'faq-which-account',
    q: 'Which email should I sign in with?',
    a: `<p>One you will still have in a year.</p>
<p>That account is how your circle knows you are you. If you lose it, tell your organizer straight away.</p>`,
  },
  {
    id: 'faq-my-screen',
    q: 'Where do I see my circle?',
    a: `<p>Sign in, then open your account panel at the top right.</p>
<p>Your card, your wallet, and anything waiting for you are all there.</p>`,
  },
  {
    id: 'faq-add-wallet',
    q: 'How do I add my wallet?',
    a: `<ol><li>Open your account panel.</li>
<li>Find your payout wallet near the top.</li>
<li>Paste your address, or change the one already there.</li></ol>
<p>This is where your turn gets paid.</p>`,
  },
  {
    id: 'faq-prove-wallet',
    q: 'How do I prove the wallet is mine?',
    a: `<ol><li>Send a small amount from that wallet back to itself.</li>
<li>Come back and press check.</li></ol>
<p>Nothing leaves your wallet but that small test, and no key ever leaves your hands.</p>`,
  },
  {
    id: 'faq-two-weeks',
    q: 'Why do I only have two weeks?',
    a: `<p>Because your turn is when money moves, and it should go to an address someone confirmed is yours.</p>
<p>After two weeks, your turn cannot open until the wallet is proven. Change your wallet and the two weeks start again.</p>`,
  },
  {
    id: 'faq-how-i-pay',
    q: 'How do I pay?',
    a: `<p>From your wallet, like sending USDC to anyone. We cannot take it for you.</p>
<p>The app shows how much, when, and which address this round pays to.</p>`,
  },
  {
    id: 'faq-check-address',
    q: 'Should I check the address before I send?',
    a: `<p>Yes. Every time.</p>
<p>It is frozen when the round opens, so it cannot change once you can see it. Read it in the app, not from a message.</p>`,
  },
  {
    id: 'faq-my-card',
    q: 'What do the marks on my card mean?',
    a: `<ul><li><strong>★</strong> paid on time</li>
<li><strong>☆</strong> paid, but late. Still a star.</li>
<li><strong>◆</strong> your turn. You owed nothing.</li>
<li><strong>○</strong> past the grace days, still unpaid</li>
<li><strong>·</strong> not due yet</li></ul>`,
  },
  {
    id: 'faq-late',
    q: 'What if I pay late?',
    a: `<p>Your circle allows some grace days. Inside them, nothing is marked.</p>
<p>After that you still get a star, just a hollow one. The card says late, not bad.</p>`,
  },
  {
    id: 'faq-missed',
    q: 'What if I miss one completely?',
    a: `<p>It shows as unpaid, and that is all the app does.</p>
<p>No charge, no lockout, nobody outside your circle is told. What happens next is between you and the women you save with.</p>`,
  },
  {
    id: 'faq-voting',
    q: 'When do I vote?',
    a: `<p>When the group decides about a person: someone joining, someone leaving, or something a member raised.</p>
<p>It appears in your account panel.</p>`,
  },
  {
    id: 'faq-show-record',
    q: 'Can I show my record to a lender?',
    a: `<p>Yes. Download your card from your account panel. It is signed, so a reader can tell it has not been altered.</p>
<p>It is yours to send or not. Nobody can share it for you.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: 'Does SusuFinance hold our money?',
    a: `<p>No. There is no pot. When it is your turn, the others send USDC straight to your wallet.</p>
<p>Neither SusuFinance nor Almstins holds your keys. We cannot move, freeze, or spend your money.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: 'Who can see what I have paid?',
    a: `<p>The women in your circle, the same way you see theirs.</p>
<p>Nobody sees your balance. Not the other members, not the organizer.</p>`,
  },
  {
    id: 'faq-scores',
    q: 'Does the app score me?',
    a: `<p>No. It shows what happened, never a rating, a level, or a comparison to anyone.</p>`,
  },
  {
    id: 'faq-trust',
    q: 'How do I know this is not a scam?',
    a: `<p>You never hand us your money, so there is nothing for us to take. If this app vanished tomorrow, your USDC would still be in your wallet.</p>
<p>What you still judge is the people, the same as any susu.</p>`,
  },
  {
    id: 'faq-leave',
    q: 'Can I leave a circle?',
    a: `<p>Before it starts, yes. Once the first round opens, no.</p>
<p>The others arranged their turns around yours and some have already paid. Leaving is a vote the group takes.</p>`,
  },
  {
    id: 'faq-organizer-vanishes',
    q: 'What if the organizer disappears?',
    a: `<p>The circle stalls. Only she can open each new round.</p>
<p>Your money is not stuck, because it was never pooled. Ask her to add a second organizer on day one.</p>`,
  },
  {
    id: 'faq-lose-phone',
    q: 'What if I lose my phone?',
    a: `<p>Nothing of yours is on it. Sign in on another phone and everything is there.</p>
<p>It is the account that matters, not the phone.</p>`,
  },
  {
    id: 'faq-someone-stops',
    q: 'What if someone stops paying?',
    a: `<p>You will see it.</p>
<p>What to do is the group's decision. The app will not chase her, fine her, or report her anywhere.</p>`,
  },
  {
    id: 'faq-admin-create',
    audience: 'admin',
    q: 'How do I start a circle?',
    a: `<ol><li>Open the Circles page and choose New circle.</li>
<li>Name it, set the amount each person pays and how often.</li></ol>
<p>It starts as forming, which is the only time you can arrange it.</p>`,
  },
  {
    id: 'faq-admin-place',
    audience: 'admin',
    q: 'How do I put someone in a circle?',
    a: `<p>Drag her from “Waiting to be placed” onto the tin.</p>
<p>Anyone who has signed up but is not in a circle waits there.</p>`,
  },
  {
    id: 'faq-admin-order',
    audience: 'admin',
    q: 'How do I set the turn order?',
    a: `<p>Drag the cards inside the tin into the order the group agreed.</p>
<p>Do it before you open round one. After that the order is fixed for everyone, including you.</p>`,
  },
  {
    id: 'faq-admin-wallet',
    audience: 'admin',
    q: "How do I set someone's payout wallet?",
    a: `<p>Open her card and set the address. She can change it herself once she has signed in.</p>
<p>She then has two weeks to prove it, or her turn will not open.</p>`,
  },
  {
    id: 'faq-admin-links',
    audience: 'admin',
    q: 'How does she get into the app?',
    a: `<p>Send her the link from her card. It works once and expires in seven days.</p>
<p>It binds her login to her place in the circle, so she arrives as herself.</p>`,
  },
  {
    id: 'faq-admin-open',
    audience: 'admin',
    q: 'What happens when I open round one?',
    a: `<p>Forming ends. The roster locks, the turn order freezes, this round's payout address is fixed so it cannot be swapped, and everyone except the recipient gets a payment due.</p>`,
  },
  {
    id: 'faq-admin-remove',
    audience: 'admin',
    q: "Why can't I remove someone from a running circle?",
    a: `<p>Because the others arranged their turns around her and some have already paid.</p>
<p>You can propose it. Adding and removing are both votes the group takes.</p>`,
  },
  {
    id: 'faq-admin-second',
    audience: 'admin',
    q: 'What happens if I am unavailable?',
    a: `<p>The circle stalls. Only an organizer can open each new round.</p>
<p>Nobody's money is stuck, because it was never pooled. Add a second organizer on day one.</p>`,
  },
  {
    id: 'faq-admin-balances',
    audience: 'admin',
    q: "Why can't I see a member's balance?",
    a: `<p>There is no way to show one. The app does not read balances and the database does not store them.</p>
<p>You see what was agreed and what happened. What she holds is hers.</p>`,
  },
  {
    id: 'faq-admin-unpaid',
    audience: 'admin',
    q: 'Why does everyone show as unpaid?',
    a: `<p>Because nothing watches the chain yet. Opening a round records what each member owes, and no payment is ever marked received.</p>
<p>Do not read it as anyone being late. This is being built.</p>`,
  },
];
