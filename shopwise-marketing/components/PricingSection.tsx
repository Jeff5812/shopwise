import { Section } from '@/components/Section';
import { dashboardLoginUrl } from '@/lib/urls';

export function PricingSection() {
  return (
    <Section id="pricing" aria-labelledby="pricing-title">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
          Straightforward plans
        </p>
        <h2
          id="pricing-title"
          className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          Pricing without guesswork
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
          Start with the Free plan shown in Shopwise. Paid plan details will be
          shared here when they are confirmed.
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <article className="flex min-h-64 flex-col rounded-[var(--radius-card)] border border-border bg-card p-6 sm:p-8">
          <p className="text-sm font-medium text-muted">Current plan</p>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-foreground">
            Free
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            The plan currently shown in the Shopwise dashboard.
          </p>
          {dashboardLoginUrl ? (
            <a
              href={dashboardLoginUrl}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-brand bg-brand px-4 text-sm font-semibold text-white transition-colors hover:border-brand-hover hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Sign in to Shopwise
            </a>
          ) : null}
          <p className="mt-auto border-t border-border pt-5 text-xs leading-5 text-muted">
            Plan limits and included features are not listed here because they
            have not been confirmed.
          </p>
        </article>

        <article className="flex min-h-64 flex-col rounded-[var(--radius-card)] border border-brand bg-brand-tint p-6 sm:p-8">
          <p className="text-sm font-medium text-brand">Coming soon</p>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-foreground">
            Paid plans
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            Pricing and plan details are being finalised.
          </p>
          <p className="mt-auto border-t border-border pt-5 text-xs leading-5 text-muted">
            We will publish confirmed prices and inclusions here.
          </p>
        </article>
      </div>
    </Section>
  );
}
