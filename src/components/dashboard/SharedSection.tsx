'use client';

export function SharedSection() {
  return (
    <section>
      <div className="text-center py-16 bg-card/50 rounded-xl border border-border">
        <div className="text-5xl mb-4">👥</div>
        <p className="text-muted-foreground">
          Shared projects will appear here when collaboration is enabled.
        </p>
      </div>
    </section>
  );
}
