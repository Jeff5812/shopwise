import { Section } from '@/components/Section';

const features = [
  {
    number: '01',
    title: 'Orders in one view',
    description:
      'Keep track of orders coming from WhatsApp without losing them in busy chats.',
    className: 'md:col-span-4 md:row-span-2',
  },
  {
    number: '02',
    title: 'Stock that stays in step',
    description: 'See inventory levels alongside the orders that move them.',
    className: 'md:col-span-2',
  },
  {
    number: '03',
    title: 'Know what you earned',
    description: 'Track sales and profit with item-level context.',
    className: 'md:col-span-2',
  },
  {
    number: '04',
    title: 'Customers, together',
    description: 'Keep customer and order details close at hand.',
    className: 'md:col-span-3',
  },
  {
    number: '05',
    title: 'A clearer week',
    description: 'Review orders, stock and performance from one dashboard.',
    className: 'md:col-span-3',
  },
];

export function FeaturesSection() {
  return (
    <Section id="features" aria-labelledby="features-title">
      <div className="mb-10 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
          Less chasing, more clarity
        </p>
        <h2
          id="features-title"
          className="mt-3 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          The everyday work of selling, in one place
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
          Follow an order from customer message to stock movement and profit
          review.
        </p>
      </div>

      <div className="grid gap-3 md:auto-rows-[180px] md:grid-cols-6">
        {features.map((feature) => (
          <article
            className={`min-h-48 border border-border bg-card p-5 sm:p-7 ${feature.className}`}
            key={feature.number}
          >
            <p className="font-data text-xs text-brand">{feature.number}</p>
            <h3 className="mt-8 font-serif text-xl font-semibold text-foreground sm:text-2xl">
              {feature.title}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
              {feature.description}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
