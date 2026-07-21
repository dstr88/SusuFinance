# SusuFinance

Software for running a susu — a rotating savings circle — without anyone holding the money.

A group agrees what each person pays and how often. Each round, the others pay one member
directly. She takes her turn, and the rotation moves on. Millions of people already save
this way. The hard part was never the arithmetic: it was remembering who paid, settling
disagreements about it, and trusting whoever held the pot.

SusuFinance keeps the record. It does not hold the pot, because there is no pot.

**Live:** [susufinance.com](https://susufinance.com) · **Questions:** [susufinance.com/faq](https://susufinance.com/faq)

---

## What it will not do

These are architecture, not settings. Each is enforced by the absence of the code that would
make it possible, which is why they can be stated as facts rather than promises.

**No custody, no keys, no pot.** Members send to each other directly. There is no pooled
address and no place to add one — the `receiving_address` column was deleted from the schema
precisely because an empty column invites someone to fill it. The app never creates, signs,
or holds anything.

**No balances.** Neither the organizer nor the app can see what a member holds. No query
reads a balance and the schema stores none. What the circle sees is what the circle agreed,
and what happened.

**No scores.** Payments show as facts — on time, late, her turn, unpaid — never as a rating,
a tier, or a leaderboard. Nobody is ranked against anybody.

**No attribution.** The app never links an address to a person's legal identity. Identity
checks, where a partner requires them, stay with that partner.

**The operator can propose, never impose.** A circle is arrangeable only before it starts.
Once the first round opens, the roster and turn order are fixed, and admitting or removing a
member is a vote the group takes.

---

## How a circle works

1. A circle is created and starts *forming*. It needs at least three members: two people
   alternating is a loan, three is a group holding each other to something.
2. Members are placed and the turn order set. This is the only time either can change.
3. Each member's payout wallet is recorded and proven — she sends a small amount from it to
   itself, demonstrating control without anyone handling a key. She has two weeks.
4. Round one opens. The roster locks, the turn order freezes, and the round's payout address
   is snapshotted so it cannot be swapped mid-round.
5. Each round, everyone except that round's recipient owes a contribution. A watcher reads
   the chain and marks one paid when it sees a transfer from her wallet to that round's
   frozen address.

Each member carries a susu card: her record in that circle, exportable and signed, to show a
lender if she chooses. It is hers to share, and nobody can share it for her.

---

## Stack

Astro (SSR, Node adapter) · React islands · PostgreSQL · Auth.js · deployed on Render.

Tenant isolation is enforced in the application rather than by row-level security: every
query filters on `tenant_id` taken from the session and never from a request body. There are
no cross-tenant reads and no cross-tenant benchmarks, by design.

English, French, and Spanish across the member-facing surface.

```sh
npm install
npm run dev         # needs DATABASE_URL and AUTH_SECRET
npm run db:migrate  # apply migrations — deploying does NOT run them
npm run check       # typecheck
npm run build
```

Migrations live in `migrations-pg/`, applied in order and recorded, so re-running is safe.
Correcting an applied migration means writing a new one.

---

## Status

Beta, and honest about it. Circles, members, votes, the susu card, and the payment watcher
are built. Group signup — three people naming each other to form a circle — is designed and
not yet built, so a brand new group cannot currently create itself.

`/changelog` carries what has actually shipped.
