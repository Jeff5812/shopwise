import { Section } from '@/components/Section';
import { HeroDemo } from '@/components/landing/HeroDemo';
import { Icon } from '@/components/Icon';
import { dashboardLoginUrl } from '@/lib/urls';

const primaryButton =
  'btn-press btn-arrow inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand px-7 text-[15px] font-semibold text-on-brand shadow-card hover:bg-brand-hover';
const secondaryButton =
  'btn-press inline-flex min-h-[52px] items-center justify-center rounded-xl border border-foreground/25 bg-card/70 px-7 text-[15px] font-semibold text-foreground hover:bg-sand/50';

const assurances = ['English and Nigerian Pidgin', 'Paystack payments', 'Stock updates itself'];

export function HeroSection() {
  return (
    <Section
      className="hero-light overflow-hidden !pt-14 !pb-20 sm:!pt-20 sm:!pb-28"
      id="top"
      aria-labelledby="hero-title"
    >
      <div className="grid items-center gap-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
        <div>
          <h1
            id="hero-title"
            className="rise max-w-xl text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-[60px] lg:text-[62px]"
          >
            Your WhatsApp orders, sorted.{' '}
            <span className="block whitespace-nowrap text-brand-ink">Your profit, clear.</span>
          </h1>
          <p className="rise rise-2 mt-7 max-w-lg text-lg leading-8 text-muted sm:text-xl sm:leading-9">
            Customers order on WhatsApp. Shopwise logs the sale, updates stock
            and shows what you really earned.
          </p>
          <div className="rise rise-3 mt-10 flex flex-wrap items-center gap-3">
            {dashboardLoginUrl ? (
              <a href={dashboardLoginUrl} className={primaryButton}>
                Sign in to Shopwise
                <span className="arrow" aria-hidden="true">→</span>
              </a>
            ) : (
              <a href="#pricing" className={primaryButton}>
                See plans
                <span className="arrow" aria-hidden="true">→</span>
              </a>
            )}
            <a href="#how-it-works" className={secondaryButton}>
              How it works
            </a>
          </div>
          <ul className="rise rise-4 mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-foreground">
            {assurances.map((item) => (
              <li className="flex items-center gap-2" key={item}>
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-md bg-brand text-on-brand"
                >
                  <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rise rise-3">
          <HeroDemo />
        </div>
      </div>
    </Section>
  );
}
