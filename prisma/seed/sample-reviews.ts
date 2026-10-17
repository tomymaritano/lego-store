/**
 * Sample reviewers and review copy for the demo catalogue. The sample users
 * have no password: they exist only to author reviews (and the past orders
 * that make some of them "compra verificada"), nobody can log in as them.
 */
import { mockReviews } from "@/stores/mockReviews";

export interface SampleUser {
  key: string;
  name: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;
}

export const sampleUsers: SampleUser[] = [
  { key: "carlos", name: "Carlos M.", email: "carlos.m@example.com", city: "Córdoba", state: "Córdoba", zipCode: "5000" },
  { key: "ana", name: "Ana L.", email: "ana.l@example.com", city: "Rosario", state: "Santa Fe", zipCode: "2000" },
  { key: "roberto", name: "Roberto G.", email: "roberto.g@example.com", city: "Mendoza", state: "Mendoza", zipCode: "5500" },
  { key: "maria", name: "María S.", email: "maria.s@example.com", city: "La Plata", state: "Buenos Aires", zipCode: "1900" },
  { key: "lucia", name: "Lucía P.", email: "lucia.p@example.com", city: "Salta", state: "Salta", zipCode: "4400" },
  { key: "diego", name: "Diego F.", email: "diego.f@example.com", city: "Neuquén", state: "Neuquén", zipCode: "8300" },
  { key: "sofia", name: "Sofía R.", email: "sofia.r@example.com", city: "Mar del Plata", state: "Buenos Aires", zipCode: "7600" },
  { key: "martin", name: "Martín B.", email: "martin.b@example.com", city: "Tucumán", state: "Tucumán", zipCode: "4000" },
];

export interface HandwrittenReview {
  productId: string;
  userKey: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verified: boolean;
}

/**
 * The reviews the mock UI ships with (src/stores/mockReviews.ts, the single
 * copy of their text), attributed to the sample user with the same name.
 */
export const handwrittenReviews: HandwrittenReview[] = mockReviews.map((review) => {
  const user = sampleUsers.find((u) => u.name === review.userName);
  if (!user) throw new Error(`mockReviews: no hay usuario de ejemplo llamado ${review.userName}.`);
  const { productId, rating, title, comment, date, verified } = review;
  return { productId, userKey: user.key, rating, title, comment, date, verified };
});

/** Generic copy by star rating; `{name}` is replaced by the product name. */
export const reviewTemplates: Record<number, { title: string; comment: string }[]> = {
  5: [
    { title: "Vale cada peso", comment: "El {name} superó lo que esperaba. Las instrucciones son clarísimas y el resultado final queda impecable." },
    { title: "Un placer de armar", comment: "Lo armé en dos tardes y disfruté cada etapa. Las piezas encajan perfecto y el diseño está muy bien pensado." },
    { title: "Regalo perfecto", comment: "Se lo regalé a mi hermano y no lo pudo soltar hasta terminarlo. Llegó rápido y muy bien embalado." },
    { title: "Detalles de colección", comment: "Los detalles del {name} son increíbles. Se nota el cuidado en cada parte, ideal para exhibir." },
    { title: "Mi set favorito", comment: "Tengo varios sets y este es el que más me gustó armar. Queda espectacular en la biblioteca." },
    { title: "Excelente calidad", comment: "Piezas de primera, colores fieles y cero faltantes. Lo recomiendo sin dudar." },
  ],
  4: [
    { title: "Muy lindo, algo caro", comment: "El {name} es hermoso y se arma con gusto. Le saco una estrella solo por el precio." },
    { title: "Muy buen set", comment: "Lindo de armar y queda muy bien. Algunas etapas son repetitivas, pero el resultado lo compensa." },
    { title: "Cumple con creces", comment: "Buena calidad y buen tamaño. Las calcomanías cuestan un poco de alinear, nada grave." },
    { title: "Recomendable", comment: "Me divirtió mucho. Me hubiera gustado una base de exhibición más grande, pero estoy conforme." },
  ],
  3: [
    { title: "Lindo pero esperaba más", comment: "El {name} está bien, aunque en fotos parecía más grande. Se arma rápido." },
    { title: "Correcto", comment: "Es un set correcto. Algunas piezas se sueltan al moverlo, mejor dejarlo quieto en la repisa." },
  ],
  2: [
    { title: "No me convenció", comment: "Esperaba más detalle por el precio. Se arma rápido y queda bastante simple." },
  ],
  1: [
    { title: "Decepcionante", comment: "No es lo que esperaba: muchas calcomanías y pocas piezas para lo que cuesta." },
  ],
};
