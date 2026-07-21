// FAQ — Spanish items.
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
    q: '¿Cómo podemos empezar mis amigas y yo?',
    a: `<p>Una de ustedes crea el círculo. Le pone nombre, fija cuánto USDC aporta cada una y con qué frecuencia, luego añade a todas por su nombre y envía a cada una un enlace privado.</p>
<p>Abres tu enlace, inicias sesión y ya estás en el círculo como tú misma.</p>
<p>Mientras el círculo se está formando, ella puede cambiar el orden de los turnos y añadir o quitar personas. En cuanto se abre la primera ronda, el orden queda fijado y nadie puede cambiarlo, tampoco ella.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: '¿SusuFinance guarda nuestro dinero?',
    a: `<p>No. SusuFinance lleva la administración del círculo, no el dinero. Tus USDC se quedan en tu propia billetera, que tú controlas. Aquí no hay un bote común. Cuando llega tu turno, las demás envían los USDC directamente a tu billetera.</p>
<p>La aplicación registra lo que el círculo acordó y lo que ocurrió, para que todas vean que todas pagaron. Nunca guarda fondos, y nadie más en tu círculo, incluida la organizadora, puede ver tu saldo. Aquí no hay nada que alguien pueda perder ni llevarse.</p>`,
  },
  {
    id: 'faq-payout-wallet',
    q: '¿Qué es una billetera de pago y por qué hay que verificarla?',
    a: `<p>Es donde se te paga tu turno en USDC. Antes de usarla, demuestras que la billetera es tuya enviándote a ti misma una cantidad pequeña. Eso prueba que la controlas sin darle tus claves a nadie.</p>
<p>Tienes dos semanas desde que indicas una billetera para demostrarlo. Hasta entonces verás un recordatorio. Pasadas dos semanas, tu turno no puede abrirse hasta que esté demostrado. Es a propósito: tu turno es el momento en que el dinero se mueve, y debe ir a una dirección que alguien confirmó que es tuya.</p>
<p>Si cambias de billetera más adelante, las dos semanas empiezan de nuevo, porque es otra dirección que nadie ha verificado.</p>`,
  },
  {
    id: 'faq-move-me',
    q: '¿La organizadora puede pasarme a otro círculo o sacarme de uno?',
    a: `<p>Solo antes de que empiece. En cuanto se abre la primera ronda, no puede moverte, sacarte ni cambiar el orden.</p>
<p>Añadir a alguien a un círculo en marcha es una votación, y sacar a alguien también. Ella puede proponer. El grupo decide.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: '¿Quién puede ver lo que he pagado?',
    a: `<p>Las personas de tu círculo. Ese es el sentido de un susu: todas ven que todas pagaron.</p>
<p>Lo que nadie ve, incluida la organizadora, es el saldo de tu billetera.</p>`,
  },
  {
    id: 'faq-scores',
    q: '¿La aplicación me puntúa o nos clasifica?',
    a: `<p>No. Muestra hechos, como si un pago llegó a tiempo. Nunca los convierte en una puntuación, una calificación, un nivel ni una clasificación. Nadie queda clasificada frente a otra.</p>`,
  },
  {
    id: 'faq-stops-paying',
    q: '¿Y si alguien deja de pagar?',
    a: `<p>Lo verás, porque el círculo muestra lo que ocurrió. Qué hacer al respecto es decisión del grupo, no de la aplicación. No persigue, no sanciona y no denuncia a nadie.</p>`,
  },
];
