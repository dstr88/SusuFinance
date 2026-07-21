# Architecture

Why SusuFinance is built the way it is, and what it refuses to do.

This document exists because the refusals are the product. Anyone can write
"non-custodial" in a README. What follows is how each guarantee is enforced in the code,
and what would have to change for it to stop being true — so a reader can check rather
than trust.

---

## The one sentence

**A breach of SusuFinance cannot move a single coin.**

Everything below follows from defending that sentence.

---

## No pot

A susu round is nine wallets paying the tenth, directly. Nothing ever commingles.

A pooled address is custody, full stop. Whoever holds its keys is a custodian and a money
transmitter operating a collective investment scheme, and the founding sentence dies the
day a pool address exists. A "trustless pot" smart contract is the same thing wearing a
costume — someone deploys it and someone holds the upgrade key.

**How it is enforced:** the place to put a pot does not exist. `contracts` has no
`receiving_address` column and no `pot_amount` column. Both were deliberately deleted
from the draft schema, because an empty column is an invitation:

> a contract-level address *is* the pot — custody in schema form; the one column whose
> existence invites someone to fill it.

The arithmetic follows. A ten-member circle at 25 a round has no "pot of 250" anywhere,
because 250 is a number that only exists in a collector's hands. The recipient does not
contribute in her own round; nine pay, and the total is 225.

**What would break it:** any column, contract, or account that holds more than one
member's money at once.

### Holding it upstream

The guarantee above covers this codebase. It cannot cover a wallet provider or a ramp
partner, who could pool without anything here noticing — the only symptom would be
contributions quietly failing to be observed, which reads as "nobody paid" rather than
"someone is holding the money". Asking a partner to promise not to is not accountability.

So the condition is monitored instead. A daily job reads the chain and looks for the two
shapes a pool makes:

- **A shared address** — several members recorded against the same one. That is what a
  custodian handing many users one deposit address looks like from outside.
- **A common destination** — one address collecting from several members while being
  nobody's payout address. In a working circle a member pays the round's recipient
  directly, so a shared sink is a collector.

Findings surface on the operator's own screen and require a written explanation to
dismiss. This is a check on the *shape of the money*, never on who anyone is, so it does
not touch the attribution line below.

**What would break it:** turning the check off, or letting findings be dismissed without
a reason.

---

## No keys

The application never creates, signs, holds, or requests a key. There is no wallet
connection and no signature flow, which is why SIWE was rejected outright — it is a
wallet connection by another name.

Control of an address is proven a different way: she sends a small amount from the wallet
to itself, and the transfer is observed. That demonstrates control without anyone
handling a secret.

**What would break it:** any code path that asks a member to connect a wallet or sign
anything.

---

## No balances

The operator cannot see what a member holds. Neither can the app.

**How it is enforced:** no query reads a balance and the schema stores none. This is not
a permission check that could be misconfigured — there is no code path to show one, and
the price-feed stack was removed permanently rather than deferred. A member's wallet app
already does that job, for whoever she chooses to show.

What the circle sees is what the circle agreed and what happened: contributions observed,
against obligations recorded.

**What would break it:** any endpoint that returns a balance, and any dependency that
would make one cheap to add.

---

## No scores

Payment history is shown as facts — on time, late, her turn, unpaid, not yet due — and
never as a rating, a tier, a level, or a leaderboard. Nothing compares one member to
another, and nothing aggregates a member across circles for anyone but herself.

The distinction the codebase holds: *facts may shine; ranks may not.*

The same numbers are her record on her screen and surveillance on someone else's. Her
card across circles is hers to export and show. The platform never assembles that view
for a third party.

**What would break it:** any number that orders members relative to each other.

---

## No attribution

The app never links an address to a person's legal identity. No KYC, no clustering, no
de-anonymization. Where a partner requires an identity check, it stays with that partner
and its result does not land here.

This is the line that separates a record-keeping tool from surveillance infrastructure.
Public chain data about addresses a person supplies about herself is one thing. Linking
those addresses to a legal identity is the step that turns it into something else, and
not building it is the guarantee.

**What would break it:** storing an identity document, a legal name attached to an
address, or any verified-identity flag sourced from outside.

---

## Authority: propose, never impose

A circle is arrangeable only while it is *forming*. Once the first round opens:

- the roster locks and the turn order freezes
- adding a member is an admission vote
- removing a member is an expulsion vote
- the operator can open a proposal, and the group decides it

**How it is enforced:** `contract_members` rows are inserted by exactly two paths — the
vote resolver, and organizer seeding that refuses any circle not in `forming`. The check
is server-side, not a hidden button:

> The UI will not render a drag handle on a live tin, but "the button is not on the
> screen" is not a guarantee — anyone can POST. The guarantee is the WHERE clause.

A circle needs at least three members. Two people alternating is a loan; three is a group
holding each other to something.

**What would break it:** any endpoint that changes a running circle's membership without
a vote.

---

## Anti-swap

The attack that matters here is not theft from the platform — there is nothing to steal.
It is the payment instruction. A dozen women send to whatever address the app displays,
so changing that address redirects real money without touching any account.

**How it is enforced:** when a round opens, the recipient's payout address is snapshotted
into the round and frozen. A later change to her address cannot alter a round already
open. Setting a new payout address clears its verification and restarts a two-week proof
window, so a newly claimed address cannot immediately become a destination a group pays
into.

The payment watcher matches on the frozen snapshot and on the configured token only, so a
lookalike token transfer cannot be mistaken for a contribution.

---

## Isolation

Multi-tenant, enforced in the application rather than by row-level security: every query
filters on `tenant_id` taken from the session and never from a request body. There are no
cross-tenant reads and no cross-tenant benchmarks, by design — not even aggregate ones
across a single operator's own programmes.

Two deliberate exceptions, both documented where they live:

- **Operator mail** (`mail_messages`, `mail_attachments`) carries no `tenant_id`, because
  operator correspondence belongs to no tenant. Isolation there is an admin session plus
  mailbox ownership on every path.
- **The platform admin surface** runs with no tenant context so its counts are accurate.
  That surface is gated on an explicit list of user ids, and it is not the same thing as
  being an operator of a programme.

---

## Privacy posture

Promises are written about **what other people can see**, never about what the system
knows. The first is architecture; the second is a hostage to every future feature.

So: nobody else in a circle, including the organizer, can see a member's balance. Her
contribution record is visible inside her circle, which is the enforcement mechanism a
susu has always used, and nowhere else.

Analytics store no IP addresses and no user agents — both are salted-hashed before
reaching the database, enough to count a repeat visitor and useless for identifying one.
Per-request detail is kept only for a named set of routes. A full request log of an entire
site is a surveillance artifact, and this is not a product that should be building one.

---

## What this costs

Stated plainly, because a guarantee with no cost is usually a slogan.

- **No pot means no yield.** Money that never pools cannot be deployed.
- **No balances means the operator flies partly blind.** He sees obligations and
  observations, never holdings.
- **Votes are slower than an administrator.** Removing a non-paying member takes the
  group, not a click.
- **No attribution means no compliance product.** This will never be AML tooling, and the
  refusal is permanent rather than a roadmap gap.
- **Proving an address takes time**, and a member who has not proven hers cannot receive
  her turn.

Each is a real cost, accepted knowingly, in exchange for the sentence at the top.

---

## Reviewing a change

A useful test, in order:

1. Does it create a place where more than one member's money can sit?
2. Does it ask anyone to connect a wallet or sign anything?
3. Does it make a balance visible, or make one cheap to fetch?
4. Does it rank, score, or compare members?
5. Does it attach a legal identity to an address?
6. Does it let one person change a running circle's membership alone?
7. Does it read or write across tenants?

Any yes is not a code review comment. It is a conversation about the boundary, and the
boundary usually wins.
