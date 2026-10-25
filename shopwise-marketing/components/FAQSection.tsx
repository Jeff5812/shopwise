import { Section } from '@/components/Section';

/* Destination: shopwise-marketing/components/FAQSection.tsx (replaces the old file)
   Every answer comes from the Shopwise architecture notes. Two answers say plainly
   that something is not decided yet (payouts, final prices). Edit them when it is. */

const questions = [
  {
    question: 'What is Shopwise?',
    answer:
      'Shopwise helps small online sellers run WhatsApp orders, stock and sales from one dashboard.',
  },
  {
    question: 'How do my customers order?',
    answer:
      'They message you on WhatsApp in their own words, in English or Nigerian Pidgin. Shopwise reads the message, checks it against your real catalogue and stock, and asks the customer to confirm.',
  },
  {
    question: 'Can the AI change my prices or stock by itself?',
    answer:
      'No. The AI only works out what the customer wants. Prices, stock and payment status always come from your own records, and the system checks them before anything changes.',
  },
  {
    question: 'What happens when Shopwise does not understand a message?',
    answer:
      'It does not guess. The message goes to a review list in your dashboard so you can handle it yourself.',
  },
  {
    question: 'How do customers pay?',
    answer:
      'Through a Paystack checkout link sent on WhatsApp. An order is marked paid only after the payment has been checked with Paystack.',
  },
  {
    question: 'Does Shopwise deliver my goods?',
    answer:
      'No. Delivery stays in your hands, whether that is pickup, your own delivery, a dispatch rider or a waybill. Shopwise does not run a delivery network or live tracking.',
  },
  {
    question: 'How and when do I get paid?',
    answer:
      'Payout and settlement arrangements are still being finalised, so we are not publishing a schedule yet.',
  },
  {
    question: 'How much does Shopwise cost?',
    answer:
      'Starter is planned at ₦0 a month and Growth at ₦15,000 a month. These are planned prices and will be confirmed before launch.',
  },
];

export function FAQSection() {
  return (
    <Section tone="paper" id="faq" aria-labelledby="faq-title">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <h2
            id="faq-title"
            className="font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground sm:text-5xl"
          >
            Good to know
          </h2>
        </div>
        <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-canvas shadow-card">
          {questions.map((item, index) => (
            <details className="group p-5 sm:px-6" key={item.question} open={index === 0}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xl font-normal leading-none text-muted transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>
              <p className="max-w-xl pt-2 pr-8 text-sm leading-6 text-muted">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
