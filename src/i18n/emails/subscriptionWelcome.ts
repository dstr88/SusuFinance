// Subscription welcome email (Stripe webhook) — EN · ES · FR.
//
// Email-i18n pattern: locale exposes render(args) -> { subject, text, html }; the
// webhook resolves the tenant's stored language via getTenantLang(tenantId) and
// calls render(). Bodies use template literals (backticks) so apostrophes are safe.
// Plan names stay English in all locales.
//
// Colors are inline hex because email clients strip external CSS and do not honor
// CSS variables — the token rule is an app-UI rule and cannot apply here. The accent
// is SusuFinance teal (#2dd4a8), matching --accent.

import type { Lang } from '@/lib/i18n/locale';

export interface RenderedWelcomeEmail {
  subject: string;
  text: string;
  html: string;
}

export interface SubscriptionWelcomeLocale {
  lang: Lang;
  render: (a: { planLabel: string; dashboardUrl: string; appUrl: string }) => RenderedWelcomeEmail;
}

export const en: SubscriptionWelcomeLocale = {
  lang: 'en',
  render: ({ planLabel, dashboardUrl, appUrl }) => ({
    subject: `Welcome to SusuFinance — you're on ${planLabel}!`,
    text: [
      `Hi there,`,
      ``,
      `Thanks for subscribing to SusuFinance! Your ${planLabel} plan is now active.`,
      ``,
      `Get started by heading to your dashboard:`,
      dashboardUrl,
      ``,
      `Here's what you can do right now:`,
      `  • Create a savings circle and set its rotation`,
      `  • Add members and arrange the turn order`,
      `  • Watch contributions and payouts as the chain confirms them`,
      ``,
      `If you ever have questions, reply to this email — Donnie reads every one.`,
      ``,
      `— The SusuFinance team`,
      appUrl,
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#1a1a1a;color:#f0f0f0;border-radius:10px;padding:32px;">
        <h2 style="color:#2dd4a8;margin-top:0;">Welcome to SusuFinance!</h2>
        <p style="color:#ccc;">Thanks for subscribing. Your <strong style="color:#2dd4a8;">${planLabel}</strong> plan is now active.</p>
        <a href="${dashboardUrl}" style="display:inline-block;margin:20px 0;background:#2dd4a8;color:#0a0f1a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Go to your dashboard →</a>
        <p style="color:#aaa;font-size:14px;">Here's what you can do right now:</p>
        <ul style="color:#ccc;font-size:14px;line-height:1.8;">
          <li>Create a savings circle and set its rotation</li>
          <li>Add members and arrange the turn order</li>
          <li>Watch contributions and payouts as the chain confirms them</li>
        </ul>
        <p style="color:#aaa;font-size:13px;margin-top:24px;">Questions? Just reply to this email — Donnie reads every one.</p>
        <p style="color:#555;font-size:12px;margin-top:16px;">SusuFinance · <a href="${appUrl}" style="color:#555;">${appUrl}</a></p>
      </div>
    `,
  }),
};

export const es: SubscriptionWelcomeLocale = {
  lang: 'es',
  render: ({ planLabel, dashboardUrl, appUrl }) => ({
    subject: `Bienvenido a SusuFinance — estás en el plan ${planLabel}!`,
    text: [
      `Hola,`,
      ``,
      `Gracias por suscribirte a SusuFinance. Tu plan ${planLabel} ya está activo.`,
      ``,
      `Empieza yendo a tu panel de control:`,
      dashboardUrl,
      ``,
      `Esto es lo que puedes hacer ahora mismo:`,
      `  • Crea un círculo de ahorro y define su rotación`,
      `  • Añade integrantes y organiza el orden de turnos`,
      `  • Sigue los aportes y pagos a medida que la cadena los confirma`,
      ``,
      `Si tienes alguna pregunta, responde a este correo — Donnie lee todos y cada uno.`,
      ``,
      `— El equipo de SusuFinance`,
      appUrl,
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#1a1a1a;color:#f0f0f0;border-radius:10px;padding:32px;">
        <h2 style="color:#2dd4a8;margin-top:0;">¡Bienvenido a SusuFinance!</h2>
        <p style="color:#ccc;">Gracias por suscribirte. Tu plan <strong style="color:#2dd4a8;">${planLabel}</strong> ya está activo.</p>
        <a href="${dashboardUrl}" style="display:inline-block;margin:20px 0;background:#2dd4a8;color:#0a0f1a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Ir a tu panel →</a>
        <p style="color:#aaa;font-size:14px;">Esto es lo que puedes hacer ahora mismo:</p>
        <ul style="color:#ccc;font-size:14px;line-height:1.8;">
          <li>Crea un círculo de ahorro y define su rotación</li>
          <li>Añade integrantes y organiza el orden de turnos</li>
          <li>Sigue los aportes y pagos a medida que la cadena los confirma</li>
        </ul>
        <p style="color:#aaa;font-size:13px;margin-top:24px;">¿Preguntas? Solo responde a este correo — Donnie lee todos y cada uno.</p>
        <p style="color:#555;font-size:12px;margin-top:16px;">SusuFinance · <a href="${appUrl}" style="color:#555;">${appUrl}</a></p>
      </div>
    `,
  }),
};

export const fr: SubscriptionWelcomeLocale = {
  lang: 'fr',
  render: ({ planLabel, dashboardUrl, appUrl }) => ({
    subject: `Bienvenue sur SusuFinance — vous êtes sur le plan ${planLabel} !`,
    text: [
      `Bonjour,`,
      ``,
      `Merci de vous être abonné à SusuFinance ! Votre plan ${planLabel} est maintenant actif.`,
      ``,
      `Commencez en vous rendant sur votre tableau de bord :`,
      dashboardUrl,
      ``,
      `Voici ce que vous pouvez faire dès maintenant :`,
      `  • Créez un cercle d'épargne et définissez sa rotation`,
      `  • Ajoutez des membres et organisez l'ordre de passage`,
      `  • Suivez les versements et paiements à mesure que la chaîne les confirme`,
      ``,
      `Si vous avez des questions, répondez à cet e-mail — Donnie les lit tous.`,
      ``,
      `— L'équipe SusuFinance`,
      appUrl,
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#1a1a1a;color:#f0f0f0;border-radius:10px;padding:32px;">
        <h2 style="color:#2dd4a8;margin-top:0;">Bienvenue sur SusuFinance !</h2>
        <p style="color:#ccc;">Merci de vous être abonné. Votre plan <strong style="color:#2dd4a8;">${planLabel}</strong> est maintenant actif.</p>
        <a href="${dashboardUrl}" style="display:inline-block;margin:20px 0;background:#2dd4a8;color:#0a0f1a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Accéder à votre tableau de bord →</a>
        <p style="color:#aaa;font-size:14px;">Voici ce que vous pouvez faire dès maintenant :</p>
        <ul style="color:#ccc;font-size:14px;line-height:1.8;">
          <li>Créez un cercle d'épargne et définissez sa rotation</li>
          <li>Ajoutez des membres et organisez l'ordre de passage</li>
          <li>Suivez les versements et paiements à mesure que la chaîne les confirme</li>
        </ul>
        <p style="color:#aaa;font-size:13px;margin-top:24px;">Des questions ? Répondez simplement à cet e-mail — Donnie les lit tous.</p>
        <p style="color:#555;font-size:12px;margin-top:16px;">SusuFinance · <a href="${appUrl}" style="color:#555;">${appUrl}</a></p>
      </div>
    `,
  }),
};

const MAP: Record<Lang, SubscriptionWelcomeLocale> = { en, es, fr };

export function getSubscriptionWelcome(lang: Lang): SubscriptionWelcomeLocale {
  return MAP[lang] ?? en;
}
