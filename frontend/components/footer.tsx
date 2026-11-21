import Link from "next/link";
import { app } from "@/lib/api";
import { Clock } from "./clock";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-mark" aria-hidden="true">connect<span className="wordmark-dot" /></div>
      <div className="footer-bar">
        <Clock />
        <span className="mono">© {new Date().getFullYear()} Connect</span>
        <nav className="footer-links mono" aria-label="Legal">
          <Link href={app.rules}>Credit rules</Link>
          <Link href={app.privacy}>Privacy</Link>
          <Link href={app.terms}>Terms</Link>
          <Link href={app.cookies}>Cookies</Link>
          <Link href="/colleges">Colleges</Link>
        </nav>
      </div>
    </footer>
  );
}
