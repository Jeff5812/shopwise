import { Section } from '@/components/Section';
import { PricingTiers } from '@/components/pricing/PricingTiers';
import { PricingEstimator } from '@/components/pricing/PricingEstimator';
import { PricingComparison } from '@/components/pricing/PricingComparison';

/* Destination: shopwise-marketing/components/PricingSection.tsx (replaces the old file) */

export function PricingSection() {
  return (
    <Section id="pricing" aria-labelledby="pricing-title">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <h2
          id="pricing-title"
          className="font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground sm:text-5xl"
        >
          Pricing in naira
        </h2>
        <p className="mt-5 text-lg leading-8 text-muted">
          Start on Starter at ₦0 a month. These are planned prices, and the final
          plans are confirmed before launch.
        </p>
      </div>

      <PricingTiers />

      <div className="mx-auto mb-6 mt-20 max-w-xl text-center">
        <h3 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
          Estimate your monthly cost
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted">
          See the plan price plus Paystack&apos;s fee for your sales.
        </p>
      </div>
      <PricingEstimator />

      <div className="mx-auto mb-6 mt-20 max-w-xl text-center">
        <h3 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
          Compare plans
        </h3>
      </div>
      <PricingComparison />
    </Section>
  );
}
