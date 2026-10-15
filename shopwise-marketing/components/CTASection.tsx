import { Section } from '@/components/Section';
import { dashboardLoginUrl } from '@/lib/urls';

export function CTASection() {
  return (
    <Section className="!pt-0" id="get-started" aria-labelledby="cta-title">
      <div className="border border-brand bg-brand px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
          Bring your sales into focus
        </p>
        <h2
          id="cta-title"
          className="mx-auto mt-3 max-w-2xl font-serif text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Ready for a clearer view of your business?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
          Explore how Shopwise brings WhatsApp orders, inventory and profit
          together for your day-to-day selling.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {dashboardLoginUrl ? (
            <a
              href={dashboardLoginUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-card bg-card px-5 text-sm font-semibold text-brand transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
            >
              Sign in to Shopwise
            </a>
          ) : (
            <a
              href="#pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-card bg-card px-5 text-sm font-semibold text-brand transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
            >
              View plan details
            </a>
          )}
          <a
            href="#features"
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-white/60 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
          >
            Explore features
          </a>
        </div>
      </div>
    </Section>
  );
}
