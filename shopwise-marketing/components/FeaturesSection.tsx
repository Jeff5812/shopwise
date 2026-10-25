import type { ReactNode } from 'react';
import { Section } from '@/components/Section';
import { Reveal } from '@/components/Reveal';
import { Icon, type IconName } from '@/components/Icon';

type Feature = {
  icon: IconName;
  title: string;
  description: string;
  span: string;
  className: string;
  tone: string;
  iconTone: string;
  descriptionTone: string;
  art: ReactNode;
};

/* Decorative art only: no text, no figures. It hints at what each tile is about. */
function OrderListArt() {
  const rows = [
    { pill: 'bg-ink/85 w-20' },
    { pill: 'bg-ink/15 w-16' },
    { pill: 'bg-ink/15 w-[72px]' },
    { pill: 'bg-ink/15 w-16' },
    { pill: 'bg-ink/15 w-20' },
  ];
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-6 bottom-0 hidden translate-y-4 space-y-3 md:block lg:inset-x-8"
    >
      {rows.map((row, index) => (
        <div
          className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-card"
          key={index}
          style={{ marginInline: `${(index % 3) * 14}px` }}
        >
          <span className="h-8 w-8 shrink-0 rounded-full bg-sand" />
          <span className="space-y-1.5">
            <span className="block h-2 w-32 rounded-full bg-ink/20" />
            <span className="block h-2 w-20 rounded-full bg-ink/10" />
          </span>
          <span className={`ml-auto h-5 rounded-full ${row.pill}`} />
        </div>
      ))}
    </div>
  );
}

function StockArt() {
  return (
    <div aria-hidden="true" className="mt-6 space-y-2.5">
      {[100, 68, 34].map((w) => (
        <div className="h-2.5 overflow-hidden rounded-full bg-sand" key={w}>
          <div
            className={`h-full rounded-full ${w < 40 ? 'bg-ink/70' : 'bg-brand'}`}
            style={{ width: `${w}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function BarsArt() {
  const heights = [30, 46, 38, 62, 54, 80, 68];
  return (
    <div aria-hidden="true" className="mt-6 flex h-16 items-end gap-2">
      {heights.map((h, index) => (
        <span
          className={`w-full rounded-t-md ${index === heights.length - 2 ? 'bg-brand' : 'bg-sand'}`}
          key={index}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function PeopleArt() {
  const tones = ['bg-ink', 'bg-brand', 'bg-card', 'bg-ink/40'];
  return (
    <div aria-hidden="true" className="mt-6 flex -space-x-3">
      {tones.map((tone, index) => (
        <span
          className={`h-11 w-11 rounded-full ring-4 ring-sand ${tone}`}
          key={index}
        />
      ))}
    </div>
  );
}

function WeekArt() {
  const levels = ['bg-card', 'bg-brand/30', 'bg-brand/60', 'bg-brand', 'bg-brand/30', 'bg-card', 'bg-brand/60'];
  return (
    <div aria-hidden="true" className="mt-6 grid grid-cols-7 gap-2">
      {levels.map((level, index) => (
        <span className={`aspect-square rounded-lg ${level}`} key={index} />
      ))}
    </div>
  );
}

// One bold tile (brand green), the rest quiet. Tiles differ on purpose.
const features: Feature[] = [
  {
    icon: 'chat',
    title: 'Orders in one view',
    description:
      'Keep track of orders coming from WhatsApp without losing them in busy chats.',
    span: 'md:col-span-4 md:row-span-2',
    className: 'relative overflow-hidden rounded-3xl min-h-[420px]',
    tone: 'bg-brand text-on-brand shadow-card',
    iconTone: 'bg-ink/10 text-on-brand',
    descriptionTone: 'text-on-brand/80',
    art: <OrderListArt />,
  },
  {
    icon: 'box',
    title: 'Stock that stays in step',
    description: 'See inventory levels alongside the orders that move them.',
    span: 'md:col-span-2',
    className: 'rounded-2xl',
    tone: 'border border-border bg-card shadow-card',
    iconTone: 'bg-sand/60 text-foreground',
    descriptionTone: 'text-muted',
    art: <StockArt />,
  },
  {
    icon: 'trend',
    title: 'Know what you earned',
    description: 'Track sales and profit with item-level context.',
    span: 'md:col-span-2',
    className: 'rounded-2xl',
    tone: 'border border-border bg-card shadow-card',
    iconTone: 'bg-sand/60 text-foreground',
    descriptionTone: 'text-muted',
    art: <BarsArt />,
  },
  {
    icon: 'people',
    title: 'Customers, together',
    description: 'Keep customer and order details close at hand.',
    span: 'md:col-span-3',
    className: 'rounded-2xl',
    tone: 'bg-sand',
    iconTone: 'bg-card/60 text-foreground',
    descriptionTone: 'text-foreground/75',
    art: <PeopleArt />,
  },
  {
    icon: 'chart',
    title: 'A clearer week',
    description: 'Review orders, stock and performance from one dashboard.',
    span: 'md:col-span-3',
    className: 'rounded-2xl',
    tone: 'bg-sand/60',
    iconTone: 'bg-card/70 text-foreground',
    descriptionTone: 'text-foreground/75',
    art: <WeekArt />,
  },
];

export function FeaturesSection() {
  return (
    <Section id="features" aria-labelledby="features-title">
      <Reveal className="mb-12 max-w-2xl">
        <h2
          id="features-title"
          className="font-serif text-4xl font-semibold leading-[1.06] tracking-[-0.025em] text-foreground sm:text-[56px]"
        >
          The everyday work of selling, in one place
        </h2>
        <p className="mt-5 text-lg leading-8 text-muted">
          Follow an order from customer message to stock movement and profit
          review.
        </p>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-6">
        {features.map((feature, index) => (
          <Reveal
            className={`flex ${feature.span}`}
            delay={index * 80}
            key={feature.title}
          >
            <article
              className={`lift w-full p-6 sm:p-8 ${feature.className} ${feature.tone}`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconTone}`}
              >
                <Icon name={feature.icon} className="h-5 w-5" />
              </div>
              <h3 className="mt-6 font-serif text-2xl font-semibold tracking-tight sm:text-[30px]">
                {feature.title}
              </h3>
              <p className={`mt-2 max-w-sm text-base leading-7 ${feature.descriptionTone}`}>
                {feature.description}
              </p>
              {feature.art}
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
