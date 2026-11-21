/* Runs one of Connect's own server actions (app/actions.ts) for the showcase and turns what it does into JSON.

   The actions are written for Connect's own forms: they check the rules, change the database, then `redirect()` back to
   a page with ?err= or ?ok= saying what happened. Re-writing them for the showcase would mean keeping two copies of
   rules that matter (who may join a college, how a code is checked, what deleting an account erases). So the showcase's
   JSON API (app/api/account/act) calls the very same functions, with the form fields built from JSON, and reads the
   redirect they throw instead of following it:

     redirect("/onboarding?err=Wrong%20code.")  ->  { ok: false, error: "Wrong code.", to: "/onboarding" }
     redirect("/?ok=Verified.")                 ->  { ok: true,  message: "Verified.",  to: "/" }

   `to` is a path on Connect; the showcase maps it to its own page of the same purpose. Nothing here runs unless the
   route has already checked the origin and who is signed in (see lib/account-http.ts). */

export type Fields = Record<string, string | number | boolean | null | undefined>;
export type Outcome = { ok: true; message: string; to: string } | { ok: false; error: string; to: string };

/* Where a thrown redirect points, or null when the error is something else. Same format Next.js uses:
   "NEXT_REDIRECT;<replace|push>;<destination>;<status>;". */
export function redirectedTo(e: unknown): string | null {
  const d = (e as { digest?: unknown } | null)?.digest;
  if (typeof d !== "string" || !d.startsWith("NEXT_REDIRECT;")) return null;
  return d.split(";").slice(2, -2).join(";");
}

export function formOf(fields: Fields): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    // An unticked box is simply absent from a form; a ticked one is "on".
    if (v === undefined || v === null || v === false) continue;
    fd.set(k, v === true ? "on" : String(v));
  }
  return fd;
}

export function outcomeOf(dest: string | null): Outcome {
  if (dest === null) return { ok: true, message: "", to: "/" };
  const u = new URL(dest, "http://connect.invalid");
  const err = u.searchParams.get("err"), msg = u.searchParams.get("ok");
  u.searchParams.delete("err");
  u.searchParams.delete("ok");
  const to = u.pathname + u.search + u.hash;
  return err ? { ok: false, error: err, to } : { ok: true, message: msg ?? "", to };
}

export async function bridge(action: (fd: FormData) => Promise<unknown>, fields: Fields): Promise<Outcome> {
  let dest: string | null = null;
  try {
    await action(formOf(fields));
  } catch (e) {
    dest = redirectedTo(e);
    if (dest === null) throw e; // a real failure, not a redirect: let it surface as a server error
  }
  return outcomeOf(dest);
}
