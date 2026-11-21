import Link from "next/link";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { currentUser, demoMode, devLogin } from "@/lib/auth";
import { readyProviders } from "@/lib/oauth";
import { devSignIn } from "../actions";
import { Av } from "../ui";
import { SignInButtons } from "./buttons";
import "./signin.css";

export const metadata = { title: "Sign in" };

/* Sign in, in the showcase's look (frontend/): red light falling into black, the CONNECT wordmark, big light type
   and mono captions. It covers the whole window, so the app's own header and footer stay out of the way. */
export default async function SignIn() {
  if (await currentUser()) redirect("/");
  const people = devLogin ? all("SELECT u.*, c.name college FROM users u LEFT JOIN colleges c ON c.id=u.college_id WHERE u.suspended=0 ORDER BY c.name, u.role DESC, u.name LIMIT 40") : [];
  const missing = devLogin && !demoMode && readyProviders().length < 2;
  const home = process.env.SHOWCASE_URL || "/";
  return (
    <div className="sx">
      <header className="sx-top">
        <a className="sx-mark" href={home}>connect<span>.</span></a>
        <Link className="sx-pill" href="/rules">How credit works</Link>
      </header>
      <div className="sx-word" aria-hidden="true">CONNECT</div>
      <main className="sx-main">
        <h1>Sign in.</h1>
        <p className="sx-lead">Credit only for what ships. Students build it, teammates sign it.</p>
        <div className="sx-buttons"><SignInButtons /></div>
        <p className="sx-mono">We get your name, photo and email. Members then confirm a college or work email. By continuing you agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.</p>
        <details className="sx-help">
          <summary>Trouble signing in?</summary>
          <p><b>Forgot your password?</b> Connect has no password of its own. Reset it with <a href="https://accounts.google.com/signin/recovery" target="_blank" rel="noopener noreferrer">Google</a> or <a href="https://www.linkedin.com/uas/request-password-reset" target="_blank" rel="noopener noreferrer">LinkedIn</a>, then come back.</p>
          <p><b>No code in your email?</b> Check spam, wait a minute, then send a new code.</p>
          <p><b>Landed on an empty new account?</b> Sign out and choose the account you joined with.</p>
          <p><b>Lost a phone?</b> On a device you trust, open Settings and press <b>Sign out of all other devices</b>.</p>
        </details>
        {missing && <p className="sx-mono">Development note: a button without keys in <code>.env.local</code> sends you back here with a message.</p>}
        {devLogin && (
          <section className="sx-people" aria-label="Sample people">
            <p className="sx-mono">{demoMode ? "Test site: sign in as an invented person. Nothing here is real." : "Development only: sign in as a sample person."}</p>
            {people.length === 0 && <p className="sx-mono">No sample people yet. Run <code>npm run seed</code>.</p>}
            {people.map((u) => (
              <form key={u.id} action={devSignIn} className="sx-person">
                <input type="hidden" name="id" value={u.id} />
                <span className="sx-who"><Av u={u} /><span>{u.name} <span className="sx-dim">{u.college ?? "no community yet"}</span></span></span>
                <button className="sx-pill">Sign in</button>
              </form>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
