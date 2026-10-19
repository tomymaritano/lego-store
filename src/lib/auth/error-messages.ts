/**
 * Auth.js sends failed sign-ins (mostly Google) back to /login?error=<type>.
 * The message shown for each; unknown types get the generic one.
 */
const messages: Record<string, string> = {
  OAuthAccountNotLinked:
    "Ya existe una cuenta con ese email. Ingresa con tu contraseña: por seguridad no la unimos a Google automáticamente.",
  AccessDenied: "No pudimos verificar tu cuenta de Google. Usa una cuenta con el email verificado.",
  CredentialsSignin: "El email o la contraseña no son correctos.",
  AccountBlocked: "Tu cuenta está bloqueada. Si crees que es un error, escríbenos desde la página de contacto.",
  Configuration: "El ingreso no está disponible en este momento. Vuelve a intentarlo más tarde.",
};

const GENERIC = "No pudimos iniciar tu sesión. Vuelve a intentarlo.";

export function authErrorMessage(type: unknown): string | undefined {
  if (typeof type !== "string" || !type) return undefined;
  return Object.hasOwn(messages, type) ? messages[type] : GENERIC;
}
