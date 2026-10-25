import { Icon } from '@/components/Icon';
import { naira, TIERS, type Tier } from '@/lib/pricing';
import { dashboardLoginUrl } from '@/lib/urls';

/* Destination: shopwise-marketing/components/pricing/PricingTiers.tsx
   Only Starter has a button: there is no billing or contact flow yet. */

function Price({ tier, dark }: { tier: Tier; dark: boolean }) {
  const main = dark ? 'text-cream' : 'text-foreground';
  const sub = dark ? 'text-cream/70' : 'text-muted';
  if (tier.monthly === null) {
    return <p className={`mt-5 font-serif text-4xl font-semibold ${main}`}>Custom</p>;
  }
  return (
    <p className="mt-5 flex items-baseline gap-1.5">
      <span className={`font-serif text-4xl font-semibold tabular-nums ${main}`}>
        {naira(tier.monthly)}
      </span>
      <span className={`text-sm ${sub}`}>/month</span>
    </p>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const dark = Boolean(tier.featured);
  return (
    <article
      className={
        dark
          ? 'lift on-dark relative flex flex-col rounded-3xl bg-ink p-7 text-cream shadow-lift sm:p-8'
          : 'lift flex flex-col rounded-2xl border border-border bg-card p-7 shadow-card sm:p-8'
      }
    >
      {dark && (
        <span className="absolute right-6 top-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-on-brand">
          Planned
        </span>
      )}
      <h3 className={`font-serif text-xl font-semibold ${dark ? 'text-cream' : 'text-foreground'}`}>
        {tier.name}
      </h3>
      <p className={`mt-1 text-sm leading-6 ${dark ? 'text-cream/70' : 'text-muted'}`}>
        {tier.tagline}
      </p>
      <Price tier={tier} dark={dark} />

      {tier.id === 'starter' && dashboardLoginUrl ? (
        <a
          href={dashboardLoginUrl}
          className="btn-press mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-on-brand hover:bg-brand-hover"
        >
          Sign in to Shopwise
        </a>
      ) : (
        <p className={`mt-6 text-sm ${dark ? 'text-cream/70' : 'text-muted'}`}>
          Details confirmed before launch
        </p>
      )}

      <ul className={`mt-6 space-y-3 border-t pt-6 text-sm ${dark ? 'border-white/15' : 'border-border-soft'}`}>
        {tier.features.map((feature) => (
          <li className="flex items-start gap-3 leading-5" key={feature}>
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                dark ? 'bg-brand text-on-brand' : 'bg-sand text-foreground'
              }`}
            >
              <Icon name="check" className="h-3 w-3" strokeWidth={2.4} />
            </span>
            <span className={dark ? 'text-cream/90' : 'text-muted'}>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PricingTiers() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {TIERS.map((tier) => (
        <TierCard tier={tier} key={tier.id} />
      ))}
    </div>
  );
}
