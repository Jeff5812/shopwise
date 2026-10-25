import { Section } from '@/components/Section';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';

const before = [
  'Orders buried in chats.',
  'Stock counted by memory.',
  'Profit is a guess.',
];

const after = [
  'Every order in one list.',
  'Stock moves by itself.',
  'Profit shown per item.',
];

function WorkflowList({
  title,
  items,
  improved = false,
}: {
  title: string;
  items: string[];
  improved?: boolean;
}) {
  return (
    <article
      className={
        improved
          ? 'lift h-full rounded-3xl border border-border bg-card p-7 shadow-card ring-1 ring-brand/30 sm:p-9'
          : 'h-full rounded-2xl border border-dashed border-border bg-sand/30 p-7 text-foreground sm:p-9'
      }
    >
      <p
        className={
          improved
            ? 'inline-flex rounded-full bg-brand/25 px-3.5 py-1 text-sm font-semibold text-foreground'
            : 'text-sm font-medium text-muted'
        }
      >
        {title}
      </p>
      <ul className="mt-7 space-y-5">
        {items.map((item) => (
          <li
            className={`flex items-start gap-3.5 leading-6 ${
              improved ? 'text-lg font-medium text-foreground' : 'text-lg text-muted'
            }`}
            key={item}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                improved ? 'bg-brand text-on-brand' : 'bg-sand text-muted'
              }`}
            >
              <Icon name={improved ? 'check' : 'x'} className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            {item}
          </li>
        ))}
      </ul>
      {improved && (
        <p className="mt-8 border-t border-border-soft pt-5 text-base leading-6 text-muted">
          One clearer view of orders, stock and profit.
        </p>
      )}
    </article>
  );
}

export function WorkflowSection() {
  return (
    <Section id="how-it-works" aria-labelledby="workflow-title">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h2
          id="workflow-title"
          className="font-serif text-4xl font-semibold leading-[1.06] tracking-[-0.025em] text-foreground sm:text-[56px]"
        >
          Less guesswork between order and profit
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Reveal className="h-full">
          <WorkflowList title="Without a clear system" items={before} />
        </Reveal>
        <Reveal className="h-full" delay={120}>
          <WorkflowList title="With Shopwise" items={after} improved />
        </Reveal>
      </div>
    </Section>
  );
}
