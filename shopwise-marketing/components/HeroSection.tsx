import { Section } from '@/components/Section';
import { dashboardLoginUrl } from '@/lib/urls';

export function HeroSection() {
  return (
    <Section className="!pt-16 sm:!pt-24" id="top" aria-labelledby="hero-title">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            WhatsApp orders, made clearer
          </p>
          <h1
            id="hero-title"
            className="mt-4 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Your WhatsApp orders, sorted. Your profit, clear.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted sm:text-lg">
            Customers order on WhatsApp. Shopwise logs the sale, updates stock
            and shows what you really earned.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {dashboardLoginUrl ? (
              <a
                href={dashboardLoginUrl}
                className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-brand bg-brand px-5 text-sm font-semibold text-white transition-colors hover:border-brand-hover hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Sign in to Shopwise
              </a>
            ) : (
              <a
                href="#pricing"
                className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-brand bg-brand px-5 text-sm font-semibold text-white transition-colors hover:border-brand-hover hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                See plans
              </a>
            )}
            <a
              href="#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              How it works
            </a>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            Built for small online sellers managing orders in Nigeria.
          </p>
        </div>

        <div
          aria-label="Illustration of Shopwise order and inventory tracking"
          className="relative"
        >
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs font-medium text-muted">Shopwise overview</p>
                <p className="mt-1 font-serif text-lg font-semibold text-foreground">
                  Ada&apos;s Thrift
                </p>
              </div>
              <span className="rounded-sm border border-brand/20 bg-brand-tint px-2 py-1 text-[11px] font-medium text-brand">
                Today
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4">
              <div className="border border-border bg-canvas p-3">
                <p className="text-xs text-muted">Today&apos;s sales</p>
                <p className="mt-2 font-serif text-xl font-semibold text-foreground">₦48,500</p>
              </div>
              <div className="border border-border bg-canvas p-3">
                <p className="text-xs text-muted">Orders</p>
                <p className="mt-2 font-serif text-xl font-semibold text-foreground">12</p>
              </div>
            </div>

            <div className="border border-border bg-white">
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <p className="text-xs font-semibold text-foreground">Recent order</p>
                <span className="rounded-sm bg-brand-tint px-2 py-1 text-[10px] font-medium text-brand">
                  Confirmed
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Linen co-ord set</p>
                  <p className="mt-1 text-xs text-muted">Customer order · dispatch</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">₦18,000</p>
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-xs">
                <span className="text-muted">Stock after sale</span>
                <span className="font-medium text-foreground">4 pieces</span>
              </div>
            </div>

            <p className="mt-3 text-[10px] leading-4 text-muted">
              Illustrative Shopwise screen; figures shown are examples.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
