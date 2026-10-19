import { isAuthConfigured } from "@/lib/auth";
import { FormAlert } from "./FormAlert";

/** On /login and /register: says why nobody can sign in when AUTH_SECRET is missing (nothing otherwise). */
export function AuthNotConfigured() {
  if (isAuthConfigured()) return null;
  return (
    <FormAlert className="mb-6">
      El ingreso no está configurado en este servidor: falta la variable AUTH_SECRET (ver .env.example y el README, «Inicio rápido»).
    </FormAlert>
  );
}
