import { Section } from '@/components/Section';
import { Reveal } from '@/components/Reveal';
import { dashboardLoginUrl } from '@/lib/urls';

const primary =
  'btn-press btn-arrow inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand px-7 text-[15px] font-semibold text-on-brand hover:bg-brand-hover';
const ghost =
  'btn-press inline-flex min-h-[52px] items-center justify-center rounded-xl border border-cream/30 px-7 text-[15px] font-semibold text-cream hover:bg-white/10';

export function CTASection() {
  return (
    <Section id="get-started" aria-labelledby="cta-title">
      <Reveal>
        <div className="on-dark relative overflow-hidden rounded-[2rem] bg-ink px-7 py-16 shadow-lift sm:px-14 sm:py-24">
          {/* flat shapes: colour and depth without gradients */}
          <div
            className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-brand sm:-right-16 sm:h-[26rem] sm:w-[26rem]"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-32 right-24 hidden h-64 w-64 rounded-full border-[36px] border-white/[0.06] sm:block"
            aria-hidden="true"
          />
          <div className="relative max-w-2xl">
            <h2
              id="cta-title"
              className="font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.025em] text-cream sm:text-6xl"
            >
              Ready for a clearer view of your business?
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-cream/70">
              Explore how Shopwise brings WhatsApp orders, inventory and profit
              together for your day-to-day selling.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              {dashboardLoginUrl ? (
                <a href={dashboardLoginUrl} className={primary}>
                  Sign in to Shopwise
                  <span className="arrow" aria-hidden="true">→</span>
                </a>
              ) : (
                <a href="#pricing" className={primary}>
                  View plan details
                  <span className="arrow" aria-hidden="true">→</span>
                </a>
              )}
              <a href="#features" className={ghost}>
                Explore features
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
