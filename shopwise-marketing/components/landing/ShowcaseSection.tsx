import type { ReactNode } from 'react';
import { Section } from '@/components/Section';
import { Reveal } from '@/components/Reveal';
import { Icon } from '@/components/Icon';

/* Alternating rows on a dark band. Every phone screen is an illustrative example,
   labelled as such. It only shows steps Shopwise really takes: read message,
   customer confirms, vendor confirms or cancels, Paystack link, payment verified. */

function Phone({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <figure className="relative mx-auto w-full max-w-[320px]">
      <div className="phone-glow absolute -inset-20" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[2.75rem] border-[10px] border-[#141414] bg-canvas shadow-lift ring-1 ring-white/15">
        <div className="flex h-7 items-center justify-center bg-[#141414]" aria-hidden="true">
          <span className="h-1.5 w-16 rounded-full bg-white/20" />
        </div>
        <div className="flex min-h-[500px] flex-col bg-sand/35">{children}</div>
      </div>
      <figcaption className="relative mt-5 text-center text-xs text-cream/60">{caption}</figcaption>
    </figure>
  );
}

function ChatHeader({ name, status }: { name: string; status: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-cream">
        {name.charAt(0)}
      </span>
      <div>
        <p className="text-[13px] font-semibold leading-4 text-foreground">{name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-3 text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
          {status}
        </p>
      </div>
    </div>
  );
}

function ChatInput() {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-3" aria-hidden="true">
      <span className="h-9 flex-1 rounded-full bg-canvas px-4 text-[12px] leading-9 text-muted">
        Message
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-on-brand">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.5L15 12 3.39 13.9z" />
        </svg>
      </span>
    </div>
  );
}

function Incoming({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[84%] rounded-2xl rounded-tl-md bg-card px-3.5 py-2.5 text-[13px] leading-5 text-foreground shadow-card">
      {children}
    </div>
  );
}

function Outgoing({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto max-w-[84%] rounded-2xl rounded-tr-md bg-brand/30 px-3.5 py-2.5 text-[13px] leading-5 text-foreground">
      {children}
    </div>
  );
}

function OrderChatScreen() {
  return (
    <Phone caption="Example conversation">
      <ChatHeader name="Chioma" status="on WhatsApp" />
      <div className="flex-1 space-y-3 p-4">
        <Incoming>Good afternoon, I wan buy 2 bags of rice and 1 crate of eggs</Incoming>
        <Outgoing>
          Got it: 2 bags of rice and 1 crate of eggs. Please confirm so we can continue.
        </Outgoing>
        <Incoming>Yes, confirm</Incoming>
        <Outgoing>Thank you. Your order is waiting for the seller to confirm.</Outgoing>
      </div>
      <ChatInput />
    </Phone>
  );
}

function VendorScreen() {
  const tabs = [
    { icon: 'box', label: 'Orders', active: true },
    { icon: 'chat', label: 'Inbox' },
    { icon: 'people', label: 'Customers' },
    { icon: 'chart', label: 'Analytics' },
  ] as const;
  return (
    <Phone caption="Example dashboard view">
      <div className="border-b border-border bg-card px-4 py-3.5">
        <p className="font-serif text-lg font-semibold text-foreground">Orders</p>
      </div>
      <div className="flex-1 space-y-3 p-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-foreground">New order</p>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-sand px-2.5 py-1 text-[10.5px] font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
              Awaiting confirmation
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-muted">
            <li>2 × Bag of rice</li>
            <li>1 × Crate of eggs</li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <span className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand text-[12px] font-semibold text-on-brand">
              Confirm order
            </span>
            <span className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border text-[12px] font-semibold text-foreground">
              Cancel order
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-border-soft bg-card/70 p-4 opacity-70">
          <div className="flex items-center justify-between gap-2">
            <span className="h-2.5 w-24 rounded-full bg-ink/15" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/25 px-2.5 py-1 text-[10.5px] font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              Confirmed
            </span>
          </div>
          <span className="mt-3 block h-2.5 w-36 rounded-full bg-ink/10" />
        </div>
      </div>
      <div className="grid grid-cols-4 border-t border-border bg-card py-2.5" aria-hidden="true">
        {tabs.map((tab) => (
          <span
            className={`flex flex-col items-center gap-1 text-[10px] ${
              'active' in tab && tab.active ? 'font-semibold text-foreground' : 'text-muted'
            }`}
            key={tab.label}
          >
            <Icon name={tab.icon} className="h-4 w-4" />
            {tab.label}
          </span>
        ))}
      </div>
    </Phone>
  );
}

function PaymentScreen() {
  return (
    <Phone caption="Example conversation">
      <ChatHeader name="Shopwise" status="order assistant" />
      <div className="flex-1 space-y-3 p-4">
        <Outgoing>Your order is ready for payment. Pay securely with the link below.</Outgoing>
        <div className="ml-auto max-w-[84%] rounded-2xl border border-border bg-card px-3.5 py-3 shadow-card">
          <p className="text-[12px] text-muted">Paystack checkout</p>
          <span className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-brand px-5 text-[12px] font-semibold text-on-brand">
            Pay now
          </span>
        </div>
        <Outgoing>Payment received. Your order is confirmed.</Outgoing>
      </div>
      <ChatInput />
    </Phone>
  );
}

const rows: {
  step: string;
  title: string;
  body: string;
  points: string[];
  screen: ReactNode;
  flip: boolean;
}[] = [
  {
    step: '01',
    title: 'Customers order the way they talk',
    body: 'Shopwise reads the message, checks it against your real catalogue and stock, then asks the customer to confirm.',
    points: [
      'Understands English and Nigerian Pidgin',
      'Unclear messages go to your review list instead of being guessed',
    ],
    screen: <OrderChatScreen />,
    flip: false,
  },
  {
    step: '02',
    title: 'You stay in control',
    body: 'Every order lands in your dashboard. Confirm it or cancel it, and your stock stays accurate.',
    points: ['Confirm or cancel from the dashboard', 'Cancelling puts the stock back'],
    screen: <VendorScreen />,
    flip: true,
  },
  {
    step: '03',
    title: 'Paid through Paystack, then confirmed',
    body: 'Customers get a Paystack checkout link on WhatsApp. Shopwise checks the payment with Paystack before the order is marked paid.',
    points: [
      'Hosted Paystack checkout, so no card details are typed into the chat',
      'Order status and payment status are tracked separately',
    ],
    screen: <PaymentScreen />,
    flip: false,
  },
];

export function ShowcaseSection() {
  return (
    <Section tone="ink" id="showcase" aria-labelledby="showcase-title">
      <Reveal className="mb-20 max-w-2xl">
        <h2
          id="showcase-title"
          className="font-serif text-4xl font-semibold leading-[1.06] tracking-[-0.025em] text-cream sm:text-[56px]"
        >
          From message to confirmed order
        </h2>
        <p className="mt-5 text-lg leading-8 text-cream/70">
          Shopwise handles the conversation. Your catalogue, stock and payments stay
          the source of truth.
        </p>
      </Reveal>

      <div className="space-y-28 lg:space-y-36">
        {rows.map((row) => (
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20" key={row.title}>
            <Reveal className={row.flip ? 'lg:order-2' : 'lg:order-1'}>
              <p className="font-serif text-7xl font-semibold leading-none text-brand" aria-hidden="true">
                {row.step}
              </p>
              <h3 className="mt-6 font-serif text-3xl font-semibold leading-tight tracking-tight text-cream sm:text-[38px]">
                {row.title}
              </h3>
              <p className="mt-4 max-w-md text-lg leading-8 text-cream/70">{row.body}</p>
              <ul className="mt-7 space-y-4 text-base text-cream/90">
                {row.points.map((point) => (
                  <li className="flex items-start gap-3 leading-6" key={point}>
                    <span
                      aria-hidden="true"
                      className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand"
                    >
                      <Icon name="check" className="h-3 w-3" strokeWidth={2.4} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal className={row.flip ? 'lg:order-1' : 'lg:order-2'} delay={120}>
              {row.screen}
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  );
}
