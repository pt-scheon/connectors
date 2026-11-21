/* A legal page: a dark title, then the text on cream. */
export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <>
      <section className="sec dark page-top">
        <h1 className="mega">{title}</h1>
        {updated && <p className="lead page-lead">Last updated {updated}</p>}
      </section>
      <section className="sec light">
        <div className="legal">{children}</div>
      </section>
    </>
  );
}
