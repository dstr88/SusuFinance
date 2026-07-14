// Changelog page — CHROME strings only (EN · ES · FR).
//
// Deliberate scope: the dated changelog ENTRIES (release-note prose) are left in
// English. The changelog is noindex and grows continuously; translating + keeping
// 3 versions of every entry in sync is high-cost / low-value for a peripheral
// dev-update log. Only the page header/nav is localized. (Cookie-based via getLang,
// since the page is noindex — no route-based /es//fr needed.) Revisit if a fully
// translated changelog is ever wanted.

import type { Lang } from '@/lib/i18n/locale';

export interface ChangelogLocale {
  lang: Lang;
  pageTitle: string;
  description: string;
  backLink: string;
  heading: string;
  sub: string;
}

export const en: ChangelogLocale = {
  lang: 'en',
  pageTitle: 'Changelog | SusuFinance',
  description: "What's new, what changed, and why — updates from the SusuFinance team.",
  backLink: '← Back to SusuFinance',
  heading: 'Changelog',
  sub: "What's new, what changed, and why.",
};

export const es: ChangelogLocale = {
  lang: 'es',
  pageTitle: 'Registro de cambios | SusuFinance',
  description: 'Qué hay de nuevo, qué cambió y por qué — novedades del equipo de SusuFinance.',
  backLink: '← Volver a SusuFinance',
  heading: 'Registro de cambios',
  sub: 'Qué hay de nuevo, qué cambió y por qué.',
};

export const fr: ChangelogLocale = {
  lang: 'fr',
  pageTitle: 'Journal des modifications | SusuFinance',
  description: "Quoi de neuf, ce qui a changé et pourquoi — les nouveautés de l'équipe SusuFinance.",
  backLink: '← Retour à SusuFinance',
  heading: 'Journal des modifications',
  sub: 'Quoi de neuf, ce qui a changé et pourquoi.',
};

const MAP: Record<Lang, ChangelogLocale> = { en, es, fr };

/** Select the Changelog locale for a language, falling back to English. */
export function getChangelog(lang: Lang): ChangelogLocale {
  return MAP[lang] ?? en;
}
