// SusuFinance Terms of Service v2.0 (draft) — replaces the inherited Almstins-derived
// agreement in full. Product-true: circles coordination, non-custodial money model,
// sanctions clause ported from Almstins A.2, local-law responsibility incl. ROSCA
// regimes, condensed Verify surface terms. EN is authoritative; ES/FR carry a
// governing-language note until proper legal translations are prepared.
//
// `body` is developer-controlled HTML rendered with set:html.

import type { Lang } from '@/lib/i18n/locale';

export interface TermsLocale {
  lang: Lang;
  /** <summary> toggle text for the inline <details> variant. */
  summaryLabel: string;
  /** aria-label for the footer modal dialog. */
  ariaLabel: string;
  /** Full agreement body — HTML, rendered with set:html. */
  body: string;
}

const EN_BODY = `
<h1>SUSUFINANCE TERMS OF SERVICE</h1>

<p><strong>Effective Date:</strong> July 15, 2026 &nbsp;·&nbsp; <strong>Version:</strong> 2.0 (draft)<br/>
<strong>Operator:</strong> SusuFinance ("SusuFinance," "we," "us," "our") &nbsp;·&nbsp; The Service is in BETA.</p>

<h2>1. Who we are, and what this Service is</h2>
<p><strong>1.1</strong> SusuFinance (the "Service") is coordination and record-keeping software for community savings circles and personal savings goals. The Service maintains records — membership, turn order, contribution status, goal progress — by observing public blockchain data and information supplied by its users.</p>
<p><strong>1.2</strong> The Service is <strong>not a party to any savings circle.</strong> A circle is a private arrangement among its members. We provide the book; the members provide everything else.</p>
<p><strong>1.3</strong> By creating an account or using the Service you agree to these Terms. If you do not agree, do not use the Service.</p>

<h2>2. Not a bank. Not a custodian. Not a money transmitter.</h2>
<p><strong>2.1</strong> The Service is <strong>not</strong> a bank, credit institution, custodian, wallet provider, money transmitter, money services business, payment processor, virtual asset service provider (VASP), exchange, broker, investment scheme, fund, or lender, and performs no activity requiring licensure as such.</p>
<p><strong>2.2</strong> The Service <strong>never</strong> holds, receives, transmits, converts, or controls user funds or digital assets; never holds, generates, or has access to private keys or seed phrases; never initiates, signs, executes, reverses, or freezes any transaction; and requests no wallet connection or signing permission of any kind.</p>
<p><strong>2.3</strong> All value moves <strong>directly between members' own wallets</strong>, on rails the members choose, under the members' sole control. Any "pot," "balance," "jar," or "progress" shown by the Service is a record derived from observing public blockchain data — a description of money, never possession of it.</p>
<p><strong>2.4</strong> Because of 2.2, the Service has no ability to recover, return, reverse, or reissue funds sent by any member to any address for any reason, including mistake or fraud. Verify destination addresses before sending.</p>

<h2>3. Eligibility, Sanctions &amp; Geographic Restrictions</h2>
<p><strong>3.1</strong> You must be 18+ and legally permitted to use the Service in your jurisdiction.</p>
<p><strong>3.2</strong> You represent and warrant that you are not a person with whom transactions are prohibited under economic or trade sanctions laws (including U.S. OFAC programs), that you are not acting on behalf of, and are not owned or controlled by, any such person, and that you are not located in, ordinarily resident in, or accessing the Service from any comprehensively sanctioned jurisdiction — <strong>including Cuba, Iran, North Korea, Syria, or the Crimea, Sevastopol, Donetsk, Luhansk, Kherson, or Zaporizhzhia regions of Ukraine.</strong></p>
<p><strong>3.3</strong> We do not offer the Service to, or conduct business with, any individual, entity, or jurisdiction restricted under applicable sanctions laws. Access from a sanctioned location is prohibited and will be refused.</p>
<p><strong>3.4</strong> We apply geographic access controls — including IP-based geo-blocking of comprehensively sanctioned jurisdictions. IP geolocation is imperfect and can be circumvented (for example, by VPN); these controls supplement, and do not replace, your representations in 3.2.</p>

<h2>4. Your Local Law Is Your Responsibility</h2>
<p><strong>4.1</strong> Community savings arrangements are regulated differently in different places — including, without limitation, rules governing rotating savings and credit associations (such as chit-fund statutes, susu-collector licensing regimes, and equivalent frameworks), virtual asset regulations, foreign-exchange controls, and tax obligations.</p>
<p><strong>4.2</strong> You are solely responsible for ensuring that your participation in any circle, your organizing of any circle, your use of digital assets, and your reporting of any resulting income or gains comply with the laws of your jurisdiction. Organizers who operate circles commercially are solely responsible for any registration or licensure their activity requires.</p>
<p><strong>4.3</strong> The Service is offered as software, from the United States. Nothing in the Service is an offer, solicitation, or promotion of any financial product or arrangement in any jurisdiction.</p>

<h2>5. Circles Are Private Arrangements Among Members</h2>
<p><strong>5.1</strong> Each circle's rules — membership, admission, turn order, contribution amounts, settlement of departures, treatment of arrears, and any forgiveness of them — are set and governed by its members. The Service records outcomes; it does not enforce rules, adjudicate disputes, or guarantee any member's performance.</p>
<p><strong>5.2</strong> Participation in a circle involves inherent risk, including the risk that another member fails to contribute or departs. <strong>You alone assess the trustworthiness of the people you save with.</strong> The Service provides records that make a circle checkable; it does not make any member creditworthy.</p>
<p><strong>5.3</strong> Disputes between members are between members. We may provide the circle's records to its members but will not arbitrate.</p>
<p><strong>5.4</strong> The Service assigns no scores, ratings, or rankings to any person and maintains no cross-circle reputation system.</p>

<h2>6. Records, Accuracy, and the BETA Notice</h2>
<p><strong>6.1</strong> Records are derived from public blockchain observation and user-supplied information, on a best-effort basis. Blockchains reorganize, data providers err, and observation can lag. Records are provided for information and coordination; <strong>verify independently before relying on any record for a legal, tax, or financial purpose.</strong></p>
<p><strong>6.2</strong> The Service is in BETA and intended for exploration; it should not be your sole source of financial truth.</p>
<p><strong>6.3</strong> Signed exports attest that a record has not been altered since export. They do not, by themselves, attest completeness.</p>

<h2>7. No Advice</h2>
<p>The Service does not provide, and expressly disclaims, financial, investment, tax, legal, or accounting advice. Nothing in the Service is a recommendation to save, spend, join any circle, or acquire any digital asset. Consult a qualified professional.</p>

<h2>8. Accounts, Identity, and Deletion</h2>
<p><strong>8.1</strong> Accounts use a chosen display name; email is optional. We do not require or collect legal names or identity documents.</p>
<p><strong>8.2</strong> You are responsible for safeguarding access to your account and your own wallet. We can never recover wallets or keys (see 2.2).</p>
<p><strong>8.3</strong> You may delete your account at any time, without approval. Deletion erases your identifiers; records belonging to a circle's shared ledger are retained in pseudonymized form so the circle's book remains whole.</p>

<h2>9. Acceptable Use</h2>
<p>You will not, and will not attempt to: (a) provide false or misleading information; (b) use the Service in violation of any law or to facilitate illegal activity, money laundering, terrorist financing, fraud, or sanctions evasion; (c) impersonate any person or misrepresent your affiliation; (d) access or tamper with non-public areas or other users' or circles' data; (e) interfere with, disrupt, or degrade the Service or circumvent rate limits or access controls; (f) use automated means to access the Service or extract data except as expressly permitted; or (g) use the Service to monitor, profile, or surveil any person. Unauthorized use terminates the licenses granted herein.</p>

<h2>10. Your Data, Our Code</h2>
<p><strong>10.1</strong> Your records are yours. We claim no ownership of them, and you may export your complete history at any time.</p>
<p><strong>10.2</strong> The Service's source code is published openly at <a href="https://github.com/dstr88/SusuFinance">github.com/dstr88/SusuFinance</a>. Open-source components are governed by their licenses. The SusuFinance name and marks remain ours; no trademark license is granted.</p>

<h2>11. SusuFinance Verify — Self-Disclosed Address Verification</h2>
<p><strong>11.1</strong> Where offered, Verify lets an entity or member publish and prove control of their <strong>own</strong> receiving addresses so that others can check a destination before sending. Verification is <strong>self-disclosure by the owner — never SusuFinance attributing an address to anyone.</strong> SusuFinance links no address to any legal identity and performs no KYC.</p>
<p><strong>11.2</strong> Verified status means only that, at the relevant time, the registrant demonstrated control and published the address as their own, and our automated checks passed. It is <strong>not</strong> a guarantee of safety, legitimacy, or outcome; not a statement that funds sent will be safe or arrive; not advice; and not an endorsement. Exercise your own judgment before transacting.</p>
<p><strong>11.3</strong> Verification, re-verification, caching, and display are best-effort and may be suspended, refused, or revoked at our discretion. The registrant's own published record is the source of truth, and registrants are solely responsible for their domain, DNS, and record security. Registering addresses you do not control, or using Verify to impersonate anyone, is a material breach.</p>

<h2>12. Disclaimers; Limitation of Liability; Indemnity</h2>
<p><strong>12.1</strong> THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT.</p>
<p><strong>12.2</strong> TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, OR ANY LOSS OF FUNDS, PROFITS, DATA, OR GOODWILL, ARISING FROM OR RELATING TO THE SERVICE — including losses caused by another member's default, a mistaken or fraudulent transfer, blockchain or wallet failures, or reliance on any record or verified status. OUR TOTAL LIABILITY FOR ALL CLAIMS SHALL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US$100).</p>
<p><strong>12.3</strong> You will indemnify and hold us harmless from claims arising out of your use of the Service, your circles, or your breach of these Terms.</p>

<h2>13. Termination; Changes; General</h2>
<p><strong>13.1</strong> You may stop using the Service at any time. We may suspend or terminate access for breach of these Terms. Sections that by their nature survive (2, 4–7, 10–14) survive termination.</p>
<p><strong>13.2</strong> We may update these Terms; material changes will carry a new effective date on this page and a note on the <a href="/changelog">changelog</a>. Continued use after changes is acceptance.</p>
<p><strong>13.3</strong> If any provision is unenforceable it will be reformed to the minimum extent necessary; the remainder stays in effect. You may not assign this Agreement; we may. Failure to enforce is not waiver. This Agreement (with the Privacy Policy) is the entire agreement.</p>

<h2>14. Governing Law; Contact</h2>
<p><strong>14.1</strong> These Terms are governed by the laws of the State of Tennessee, USA, without regard to conflict-of-law rules.</p>
<p><strong>14.2</strong> Questions: <a href="mailto:support@susufinance.com">support@susufinance.com</a>.</p>
`;

export const en: TermsLocale = {
  lang: 'en',
  summaryLabel: 'Terms of Service',
  ariaLabel: 'Terms of Service',
  body: EN_BODY,
};

export const es: TermsLocale = {
  lang: 'es',
  summaryLabel: 'Términos del servicio',
  ariaLabel: 'Términos del servicio',
  body: `<p><em>Versión en borrador: el texto en inglés a continuación es la versión vigente. La traducción al español está en preparación.</em></p>` + EN_BODY,
};

export const fr: TermsLocale = {
  lang: 'fr',
  summaryLabel: "Conditions d'utilisation",
  ariaLabel: "Conditions d'utilisation",
  body: `<p><em>Version provisoire : le texte anglais ci-dessous fait foi. La traduction française est en préparation.</em></p>` + EN_BODY,
};

const MAP: Record<Lang, TermsLocale> = { en, es, fr };

/** Select the agreement locale for a language, falling back to English. */
export function getTerms(lang: Lang): TermsLocale {
  return MAP[lang] ?? en;
}
