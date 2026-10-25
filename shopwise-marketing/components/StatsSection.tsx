import { Section } from '@/components/Section';

const outcomes = [
  { title: 'Orders logged automatically', detail: 'Keep WhatsApp sales together' },
  { title: 'Stock updated per sale', detail: 'See inventory alongside orders' },
  { title: 'Profit per item', detail: 'Understand what each sale earns' },
  { title: 'Weekly summary in plain English', detail: 'Review the week at a glance' },
];

export function StatsSection() {
  return (
    <Section tone="brand" className="!py-12 sm:!py-16" aria-label="Shopwise seller tools">
      <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:divide-x md:divide-ink/15">
        {outcomes.map((outcome, index) => (
          <div
            className={`pr-4 md:px-8 ${index === 0 ? 'md:pl-0' : ''} ${
              index === outcomes.length - 1 ? 'md:pr-0' : ''
            }`}
            key={outcome.title}
          >
            <p className="font-serif text-2xl font-semibold leading-snug tracking-tight text-on-brand sm:text-[28px]">
              {outcome.title}
            </p>
            <p className="mt-2.5 text-base leading-6 text-on-brand/75">{outcome.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
