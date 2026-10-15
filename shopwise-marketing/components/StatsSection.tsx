import { Section } from '@/components/Section';

const outcomes = [
  { title: 'Orders logged automatically', detail: 'Keep WhatsApp sales together' },
  { title: 'Stock updated per sale', detail: 'See inventory alongside orders' },
  { title: 'Profit per item', detail: 'Understand what each sale earns' },
  { title: 'Weekly summary in plain English', detail: 'Review the week at a glance' },
];

export function StatsSection() {
  return (
    <Section className="!py-0" aria-label="Shopwise seller tools">
      <div className="grid grid-cols-2 border-y border-border md:grid-cols-4">
        {outcomes.map((outcome, index) => (
          <div
            className={`px-4 py-5 sm:px-6 sm:py-7 ${
              index % 2 === 1 ? 'border-l border-border' : ''
            } ${index > 1 ? 'border-t border-border md:border-t-0' : ''} ${
              index === 2 ? 'md:border-l border-border' : ''
            }`}
            key={outcome.title}
          >
            <p className="font-serif text-lg font-semibold leading-6 text-foreground sm:text-xl">
              {outcome.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">
              {outcome.detail}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
