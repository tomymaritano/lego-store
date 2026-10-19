import Image from "next/image";
import { Button } from "@/components/ui";

/** "Continuar con Google": its own small form, posting to the Google sign-in Server Action. */
export function GoogleSignIn({ action, callbackUrl }: { action: (formData: FormData) => Promise<void>; callbackUrl: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-caption font-semibold tracking-wider text-fg-muted uppercase">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />o<span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <form action={action}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          {/* Google's "G" in its official colours (a static file: brand colours never follow the theme). */}
          <Image src="/images/google-g.svg" alt="" width={20} height={20} unoptimized className="size-5" />
          Continuar con Google
        </Button>
      </form>
    </div>
  );
}
