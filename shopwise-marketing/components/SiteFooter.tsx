import { PageShell } from '@/components/PageShell';

const groups = [
  {
    title: 'Product',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#faq', label: 'FAQs' },
    ],
  },
  {
    title: 'For sellers',
    links: [
      { href: '#how-it-works', label: 'How it works' },
      { href: '#top', label: 'Back to top' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <PageShell className="!px-6">
        <div className="grid gap-10 py-10 sm:grid-cols-2 sm:py-12 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <a
              href="#top"
              className="font-serif text-2xl font-semibold tracking-tight text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Shopwise
            </a>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
              WhatsApp ordering, inventory and profit tracking for small online
              sellers.
            </p>
          </div>
          {groups.map((group) => (
            <nav aria-label={group.title} key={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a
                      className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-border py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Shopwise</p>
          <p>Made for the work behind every WhatsApp sale.</p>
        </div>
      </PageShell>
    </footer>
  );
}
