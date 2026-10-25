import { PageShell } from '@/components/PageShell';
import { LogoMark } from '@/components/Icon';

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
    <footer className="border-t border-border bg-canvas">
      <PageShell className="!px-6">
        <div className="grid gap-10 py-12 sm:grid-cols-2 sm:py-14 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <a
              href="#top"
              className="inline-flex items-center gap-2.5 font-serif text-xl font-semibold tracking-tight text-foreground"
            >
              <LogoMark size={26} />
              Shopwise
            </a>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
              WhatsApp ordering, inventory and profit tracking for small online
              sellers.
            </p>
          </div>
          {groups.map((group) => (
            <nav aria-label={group.title} key={group.title}>
              <h2 className="font-sans text-sm font-semibold text-foreground">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a
                      className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
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
        <p
          aria-hidden="true"
          className="pointer-events-none select-none overflow-hidden whitespace-nowrap pb-6 pt-8 text-center font-serif text-[22vw] font-semibold leading-[0.9] tracking-[-0.04em] text-sand/70 lg:text-[240px]"
        >
          Shopwise
        </p>
        <div className="flex flex-col gap-2 border-t border-border-soft py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Shopwise</p>
          <p>Made for the work behind every WhatsApp sale.</p>
        </div>
      </PageShell>
    </footer>
  );
}
