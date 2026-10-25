/* Hero product story. A looping, pure-CSS demo (see globals.css, .demo-*):
   customer messages, Shopwise types and replies, customer confirms, the order appears
   in the dashboard, the vendor confirms, stock moves, two small notes pop in.
   It is an illustrative example and says so. With reduced motion it shows the
   finished state and does not move. */

export function HeroDemo() {
  return (
    <figure className="relative isolate mx-auto w-full max-w-[560px]">
      {/* flat colour behind the product: the energy of the hero */}
      <div
        className="absolute left-[56%] top-[50%] -z-10 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
        aria-hidden="true"
      />
      <div
        className="absolute -left-4 bottom-10 -z-10 h-20 w-20 rounded-full border-[9px] border-ink/90"
        aria-hidden="true"
      />

      <div className="relative pb-24 sm:pb-28">
        <div className="relative rounded-[2rem] bg-sand p-4 shadow-lift ring-1 ring-ink/5 sm:p-6">
          <div className="rounded-2xl border border-border-soft bg-card p-5 pb-20 shadow-card">
            <div className="flex items-center justify-between border-b border-border-soft pb-4">
              <div>
                <p className="text-xs font-medium text-muted">Shopwise overview</p>
                <p className="mt-1 font-serif text-lg font-semibold text-foreground">
                  Ada&apos;s Thrift
                </p>
              </div>
              <span className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-muted">
                Today
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="rounded-xl bg-canvas p-4">
                <p className="text-xs text-muted">Today&apos;s sales</p>
                <p className="mt-2 font-serif text-2xl font-semibold tabular-nums text-foreground">
                  ₦48,500
                </p>
              </div>
              <div className="rounded-xl bg-canvas p-4">
                <p className="text-xs text-muted">Orders</p>
                <p className="mt-2 font-serif text-2xl font-semibold tabular-nums text-foreground">
                  12
                </p>
              </div>
            </div>

            <div className="demo-row mt-4 overflow-hidden rounded-xl border border-border-soft">
              <div className="flex items-center justify-between gap-3 border-b border-border-soft bg-canvas/60 px-4 py-2.5">
                <p className="text-xs font-semibold text-foreground">New order</p>
                <span className="relative block h-6 w-[158px]">
                  <span className="demo-await absolute right-0 top-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-sand px-2.5 py-1 text-[11px] font-medium text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
                    Awaiting confirmation
                  </span>
                  <span className="demo-done absolute right-0 top-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand/25 px-2.5 py-1 text-[11px] font-medium text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                    Confirmed
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm font-medium text-foreground">2 × Bag of rice</p>
                <p className="flex items-center gap-2 text-xs text-muted">
                  In stock
                  <span className="relative inline-block h-5 w-7 text-right">
                    <span className="demo-stock-old absolute right-0 top-0 text-sm font-semibold tabular-nums text-foreground">
                      20
                    </span>
                    <span className="demo-stock-new absolute right-0 top-0 text-sm font-semibold tabular-nums text-foreground">
                      18
                    </span>
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* floating notes that pop in as the story progresses */}
        <div className="float-a absolute -left-3 top-3 sm:-left-8 sm:top-6">
          <div className="demo-chip-a flex items-center gap-2 rounded-xl bg-card px-3.5 py-2.5 text-[12.5px] font-semibold text-foreground shadow-lift ring-1 ring-ink/5">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            Stock updated
          </div>
        </div>
        <div className="float-b absolute -right-3 top-[34%] sm:-right-9">
          <div className="demo-chip-b flex items-center gap-2 rounded-xl bg-card px-3.5 py-2.5 text-[12.5px] font-semibold text-foreground shadow-lift ring-1 ring-ink/5">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            Paystack link sent
          </div>
        </div>

        {/* WhatsApp conversation, overlapping the dashboard for depth */}
        <div className="absolute bottom-0 left-0 w-[74%] rounded-2xl border border-border bg-card p-3.5 shadow-lift sm:-left-8 sm:w-[68%]">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-cream">
              C
            </span>
            <div>
              <p className="text-[12px] font-semibold leading-3 text-foreground">Chioma</p>
              <p className="mt-1 flex items-center gap-1.5 text-[10.5px] leading-3 text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                on WhatsApp
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="demo-b1 max-w-[90%] rounded-2xl rounded-tl-md bg-canvas px-3 py-2 text-[12.5px] leading-5 text-foreground">
              Good afternoon, I wan buy 2 bags of rice
            </p>
            <div className="relative">
              <span className="demo-typing absolute right-0 top-0 flex items-center gap-1 rounded-2xl rounded-tr-md bg-brand/25 px-3.5 py-3">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-foreground/70" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-foreground/70" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-foreground/70" />
              </span>
              <p className="demo-b2 ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-brand/25 px-3 py-2 text-[12.5px] leading-5 text-foreground">
                Got it: 2 bags of rice. Please confirm so we can continue.
              </p>
            </div>
            <p className="demo-b3 max-w-[60%] rounded-2xl rounded-tl-md bg-canvas px-3 py-2 text-[12.5px] leading-5 text-foreground">
              Yes, confirm
            </p>
          </div>
        </div>

        <div className="demo-toast absolute bottom-3 right-0 flex items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-cream shadow-lift sm:-right-4">
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
          Order confirmed
        </div>
      </div>
      <figcaption className="mt-2 px-1 text-xs leading-4 text-muted">
        Illustrative Shopwise screen; names and figures are examples.
      </figcaption>
    </figure>
  );
}
