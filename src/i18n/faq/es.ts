// FAQ — Spanish items.
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
    q: '¿Cómo podemos empezar mis amigas y yo?',
    a: `<p>Una de ustedes crea el círculo. Le pone nombre, fija cuánto USDC aporta cada una y con qué frecuencia, luego añade a todas por su nombre y envía a cada una un enlace privado.</p>
<p>Abres tu enlace, inicias sesión y ya estás en el círculo como tú misma.</p>
<p>Mientras el círculo se está formando, ella puede cambiar el orden de los turnos y añadir o quitar personas. En cuanto se abre la primera ronda, el orden queda fijado y nadie puede cambiarlo, tampoco ella.</p>`,
  },
  {
    id: 'faq-holds-money',
    q: '¿SusuFinance guarda nuestro dinero?',
    a: `<p>No. SusuFinance lleva la administración del círculo, no el dinero. Aquí no hay un bote común. Cuando llega tu turno, las demás envían los USDC directamente a tu billetera.</p>
<p>Ni SusuFinance ni Almstins tienen nunca las claves de tu billetera. No podemos mover tu dinero, ni congelarlo, ni gastarlo, porque no tenemos nada con qué hacerlo.</p>
<p>La aplicación registra lo que el círculo acordó y lo que ocurrió, para que todas vean que todas pagaron. Nadie más en tu círculo, incluida la organizadora, puede ver tu saldo.</p>`,
  },
  {
    id: 'faq-trust',
    q: '¿Cómo sé que esto no es una estafa?',
    a: `<p>La respuesta honesta es que no tienes que confiarnos nada, porque nunca tenemos tu dinero. Aquí no hay una cuenta que llenar ni un saldo que podamos congelar. Si esta aplicación desapareciera mañana, tus USDC seguirían en tu billetera.</p>
<p>Lo que sí tienes que juzgar son las personas. Un susu siempre se ha basado en saber con quién ahorras, y ninguna aplicación cambia eso. Lo que esta añade es un registro compartido que todas ven, para que una discusión sobre quién pagó qué se resuelva mirando en vez de discutiendo.</p>`,
  },
  {
    id: 'faq-someone-stops',
    q: '¿Y si alguien deja de pagar?',
    a: `<p>Lo verás. El círculo muestra lo que ocurrió y cuándo, así nadie tiene que llevar sus propias cuentas ni creer a otra integrante de palabra.</p>
<p>Qué hacer al respecto es decisión del grupo, no de la aplicación. No la perseguirá, no la multará, no la bloqueará ni la denunciará en ningún sitio. Sacar a alguien de un círculo en marcha es una votación, y la toma el grupo.</p>`,
  },
  {
    id: 'faq-organizer-vanishes',
    q: '¿Y si la persona que lo creó desaparece?',
    a: `<p>Hablen de esto con franqueza antes de empezar. Abrir cada nueva ronda solo lo puede hacer la organizadora, así que si deja de aparecer, el círculo se detiene.</p>
<p>Tu dinero no queda atrapado, porque nunca estuvo junto en un sitio. Los USDC de cada una están en su propia billetera todo el tiempo. Pero las rondas no avanzan hasta que alguien con los permisos las abra.</p>
<p>La solución es sencilla y conviene hacerla el primer día: que añada a una segunda organizadora. Dos personas que puedan mantenerlo en marcha es la diferencia entre una pausa y un círculo muerto.</p>`,
  },
  {
    id: 'faq-leave',
    q: '¿Puedo salirme de un círculo?',
    a: `<p>Antes de que empiece, sí. Mientras el círculo se está formando, la organizadora puede sacarte.</p>
<p>En cuanto se abre la primera ronda, no. No puedes sacarte a ti misma, y es a propósito, no un descuido. Las demás ordenaron sus turnos alrededor del tuyo, y algunas ya han pagado en una rotación que cuenta contigo. Salir es una votación, y la toma el grupo.</p>
<p>Esto conviene entenderlo antes de entrar, no después. Un susu es una promesa a personas, y la aplicación te sostiene en ella igual que lo haría el grupo.</p>`,
  },
  {
    id: 'faq-lose-phone',
    q: '¿Y si pierdo el teléfono?',
    a: `<p>Nada de tu círculo vive en tu teléfono, así que perderlo o romperlo no te cuesta nada. Inicia sesión en otro con la misma cuenta y todo está donde lo dejaste.</p>
<p>Lo que importa es la cuenta, no el aparato. Conserva el acceso al correo o a la cuenta de Google con la que iniciaste sesión, porque eso es lo que te identifica ante tu círculo. Si lo pierdes, avisa enseguida a tu organizadora.</p>`,
  },
  {
    id: 'faq-who-sees',
    q: '¿Quién puede ver lo que he pagado?',
    a: `<p>Las personas de tu círculo. Ese es el sentido de un susu: todas ven que todas pagaron, y eso es lo que hace que funcione sin que nadie guarde el dinero.</p>
<p>Lo que nadie ve, incluida la organizadora, es el saldo de tu billetera. La aplicación no lee saldos y no tiene forma de mostrar uno.</p>`,
  },
  {
    id: 'faq-scores',
    q: '¿La aplicación me puntúa o nos clasifica?',
    a: `<p>No. Muestra hechos, como si un pago llegó a tiempo. Nunca los convierte en una puntuación, una calificación, un nivel ni una clasificación, y nunca te compara con nadie.</p>
<p>Lo que tu círculo ya sabe de ti es lo que la aplicación muestra. No construye una reputación que te siga.</p>`,
  },
];
