import { Section } from '@/components/Section';

const questions = [
  {
    question: 'What is Shopwise?',
    answer:
      'Shopwise helps small online sellers manage WhatsApp orders, inventory and profit from a web dashboard.',
  },
  {
    question: 'Who is Shopwise for?',
    answer:
      'It is designed for small online sellers who take orders through WhatsApp and need a clearer way to follow sales and stock.',
  },
  {
    question: 'How does Shopwise help with stock?',
    answer:
      'Shopwise brings inventory and orders together so sellers can follow stock changes alongside sales.',
  },
  {
    question: 'What does the Free plan include?',
    answer:
      'The dashboard currently displays a Free plan. Specific plan limits and inclusions have not been confirmed here yet.',
  },
  {
    question: 'Where can I find paid plan pricing?',
    answer:
      'Paid plan pricing has not been confirmed yet. This page will be updated when the details are ready.',
  },
];

export function FAQSection() {
  return (
    <Section id="faq" aria-labelledby="faq-title">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Common questions
          </p>
          <h2
            id="faq-title"
            className="mt-3 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Good to know
          </h2>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {questions.map((item) => (
            <details className="group py-5" key={item.question}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-lg font-normal text-brand transition-transform group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>
              <p className="max-w-xl pt-3 pr-8 text-sm leading-6 text-muted">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
