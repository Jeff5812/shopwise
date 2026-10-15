import { Section } from '@/components/Section';

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
      className={`border p-6 sm:p-8 ${
        improved
          ? 'border-brand bg-brand text-white'
          : 'border-dashed border-border bg-card text-foreground'
      }`}
    >
      <p
        className={`inline-flex border px-2.5 py-1 text-xs font-semibold ${
          improved
            ? 'border-white/30 bg-white/10 text-white'
            : 'border-border bg-canvas text-muted'
        }`}
      >
        {title}
      </p>
      <ul className="mt-6 space-y-4">
        {items.map((item) => (
          <li className="flex items-start gap-3 text-sm leading-6" key={item}>
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-xs ${
                improved
                  ? 'border-white/40 text-white'
                  : 'border-border text-muted'
              }`}
            >
              {improved ? '✓' : '×'}
            </span>
            <span className={improved ? 'text-white' : 'text-muted'}>{item}</span>
          </li>
        ))}
      </ul>
      {improved && (
        <p className="mt-7 border-t border-white/20 pt-4 text-xs leading-5 text-white/85">
          One clearer view of orders, stock and profit.
        </p>
      )}
    </article>
  );
}

export function WorkflowSection() {
  return (
    <Section
      className="!pt-0"
      id="how-it-works"
      aria-labelledby="workflow-title"
    >
      <div className="mx-auto mb-10 max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
          A simpler routine
        </p>
        <h2
          id="workflow-title"
          className="mt-3 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          Less guesswork between order and profit
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <WorkflowList title="Without a clear system" items={before} />
        <WorkflowList title="With Shopwise" items={after} improved />
      </div>
    </Section>
  );
}
