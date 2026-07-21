// FAQ — Spanish items.
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
// Every claim is true of the code today, except one flagged in FAQquestions.claude.md:
// nothing observes payments yet, so "the circle shows what happened" is ahead of the
// watcher. Fix the copy or ship the watcher before a pilot.
import type { FaqItem } from '../faq';

export const items: FaqItem[] = [
  {
    id: 'faq-start',
    q: '¿Cómo podemos empezar mis amigas y yo?',
    a: `<ol><li>Una de ustedes crea el círculo y le pone nombre.</li>
<li>Fija cuánto USDC paga cada una, y con qué frecuencia.</li>
<li>Añade a todas y envía un enlace a cada una.</li>
<li>Abres tu enlace e inicias sesión.</li></ol>
<p>Ya está. Estás dentro.</p>`,
  },
  {
    id: 'faq-my-link',
    q: 'Recibí un enlace. ¿Qué hago?',
    a: `<p>Ábrelo e inicia sesión. Eso te coloca en el círculo como tú misma.</p>
<p>Funciona una sola vez y caduca a los siete días. Si el tuyo caducó, pide otro.</p>`,
  },
  {
    id: 'faq-which-account',
    q: '¿Con qué correo debo iniciar sesión?',
    a: `<p>Con uno que sigas teniendo dentro de un año.</p>
<p>Esa cuenta es como tu círculo sabe que eres tú. Si la pierdes, avisa enseguida a tu organizadora.</p>`,
  },
  {
    id: 'faq-my-screen',
    q: '¿Dónde veo mi círculo?',
    a: `<p>Inicia sesión y abre tu panel de cuenta, arriba a la derecha.</p>
<p>Tu tarjeta, tu billetera y todo lo que te espera están ahí.</p>`,
  },
  {
    id: 'faq-add-wallet',
    q: '¿Cómo añado mi billetera?',
    a: `<ol><li>Abre tu panel de cuenta.</li>
<li>Busca tu billetera de pago, arriba.</li>
<li>Pega tu dirección, o cambia la que ya está.</li></ol>
<p>Ahí es donde se te paga tu turno.</p>`,
  },
  {
    id: 'faq-prove-wallet',
    q: '¿Cómo demuestro que la billetera es mía?',
    a: `<ol><li>Envía una cantidad pequeña desde esa billetera a sí misma.</li>
<li>Vuelve y pulsa comprobar.</li></ol>
<p>De tu billetera no sale nada salvo esa prueba pequeña, y ninguna clave sale de tus manos.</p>`,
  },
  {
    id: 'faq-two-weeks',
    q: '¿Por qué solo tengo dos semanas?',
    a: `<p>Porque tu turno es cuando el dinero se mueve, y debe ir a una dirección que alguien confirmó que es tuya.</p>
<p>Pasadas dos semanas, tu turno no puede abrirse hasta que esté demostrada. Si cambias de billetera, las dos semanas empiezan de nuevo.</p>`,
  },
  {
    id: 'faq-how-i-pay',
    q: '¿Cómo pago?',
    a: `<p>Desde tu billetera, como enviar USDC a cualquiera. No podemos cobrarlo por ti.</p>
<p>La aplicación te muestra cuánto, cuándo y a qué dirección paga esta ronda.</p>`,
  },
  {
    id: 'faq-check-address',
    q: '¿Debo revisar la dirección antes de enviar?',
    a: `<p>Sí. Siempre.</p>
<p>Queda congelada al abrirse la ronda, así que no puede cambiar una vez la ves. Léela en la aplicación, no en un mensaje.</p>`,
  },
  {
    id: 'faq-my-card',
    q: '¿Qué significan las marcas de mi tarjeta?',
    a: `<ul><li><strong>★</strong> pagado a tiempo</li>
<li><strong>☆</strong> pagado, pero tarde. Sigue siendo una estrella.</li>
<li><strong>◆</strong> tu turno. No debías nada.</li>
<li><strong>○</strong> pasados los días de gracia, aún sin pagar</li>
<li><strong>·</strong> aún no vence</li></ul>`,
  },
  {
    id: 'faq-late',
    q: '¿Y si pago tarde?',
    a: `<p>Tu círculo da unos días de gracia. Dentro de ellos no se marca nada.</p>
<p>Después sigues teniendo una estrella, solo que hueca. La tarjeta dice tarde, no mala.</p>`,
  },
  {
    id: 'faq-missed',
    q: '¿Y si me salto uno del todo?',
    a: `<p>Aparece como no pagado, y eso es todo lo que hace la aplicación.</p>
<p>Sin cargos, sin bloqueos, y nadie fuera de tu círculo se entera. Lo que pase después es entre tú y las mujeres con las que ahorras.</p>`,
  },
  {
    id: 'faq-voting',
    q: '¿Cuándo voto?',
    a: `<p>Cuando el grupo decide sobre una persona: alguien que entra, alguien que sale, o algo que planteó una integrante.</p>
<p>Aparece en tu panel de cuenta.</p>`,
  },
  {
    id: 'faq-show-record',
    q: '¿Puedo enseñar mi historial a un prestamista?',
    a: `<p>Sí. Descarga tu tarjeta desde tu panel de cuenta. Va firmada, para que quien la lea vea que no fue alterada.</p>
<p>Es tuya: tú decides si la envías. Nadie puede compartirla por ti.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: '¿SusuFinance guarda nuestro dinero?',
    a: `<p>No. No hay bote común. Cuando llega tu turno, las demás envían los USDC directamente a tu billetera.</p>
<p>Ni SusuFinance ni Almstins tienen tus claves. No podemos mover, congelar ni gastar tu dinero.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: '¿Quién puede ver lo que he pagado?',
    a: `<p>Las mujeres de tu círculo, igual que tú ves lo suyo.</p>
<p>Nadie ve tu saldo. Ni las demás integrantes, ni la organizadora.</p>`,
  },
  {
    id: 'faq-scores',
    q: '¿La aplicación me puntúa?',
    a: `<p>No. Muestra lo que pasó, nunca una calificación, un nivel ni una comparación.</p>`,
  },
  {
    id: 'faq-trust',
    q: '¿Cómo sé que esto no es una estafa?',
    a: `<p>Nunca nos entregas tu dinero, así que no hay nada que podamos llevarnos. Si esta aplicación desapareciera mañana, tus USDC seguirían en tu billetera.</p>
<p>Lo que sigues juzgando son las personas, como en cualquier susu.</p>`,
  },
  {
    id: 'faq-leave',
    q: '¿Puedo salirme de un círculo?',
    a: `<p>Antes de que empiece, sí. En cuanto se abre la primera ronda, no.</p>
<p>Las demás ordenaron sus turnos alrededor del tuyo y algunas ya pagaron. Salir es una votación que toma el grupo.</p>`,
  },
  {
    id: 'faq-organizer-vanishes',
    q: '¿Y si la organizadora desaparece?',
    a: `<p>El círculo se detiene. Solo ella puede abrir cada ronda nueva.</p>
<p>Tu dinero no queda atrapado, nunca estuvo junto. Pídele que añada una segunda organizadora el primer día.</p>`,
  },
  {
    id: 'faq-lose-phone',
    q: '¿Y si pierdo el teléfono?',
    a: `<p>Nada tuyo está en él. Inicia sesión en otro teléfono y todo está ahí.</p>
<p>Lo que importa es la cuenta, no el teléfono.</p>`,
  },
  {
    id: 'faq-someone-stops',
    q: '¿Y si alguien deja de pagar?',
    a: `<p>Lo verás.</p>
<p>Qué hacer es decisión del grupo. La aplicación no la perseguirá, no la multará ni la denunciará en ningún sitio.</p>`,
  },
];
