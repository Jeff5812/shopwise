import { Section } from '@/components/Section';
import { Reveal } from '@/components/Reveal';

/* Adapted from the local-business hero idea. No customer claims, no testimonials,
   no market names: it only describes situations the product is built for. */

const situations = [
  {
    title: 'You take orders in chats',
    body: 'Shopwise turns WhatsApp messages into a clear order list.',
  },
  {
    title: 'Your stock lives in your head',
    body: 'Stock is tracked by product and variant, and moves with each order.',
  },
  {
    title: 'You want to see what sells',
    body: 'Follow sales by product and by day from one dashboard.',
  },
  {
    title: 'You would rather sell than type',
    body: 'Shopwise does the repetitive logging so you can focus on customers.',
  },
];

export function ForSellersSection() {
  return (
    <Section tone="sand" id="for-sellers" aria-labelledby="sellers-title">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
        <h2
          id="sellers-title"
          className="font-serif text-4xl font-semibold leading-[1.06] tracking-[-0.025em] text-foreground sm:text-[56px]"
        >
          Made for sellers who already sell on WhatsApp
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {situations.map((item, index) => (
            <Reveal className="h-full" delay={index * 90} key={item.title}>
              <article className="lift h-full rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7">
                <h3 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-base leading-7 text-muted">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
