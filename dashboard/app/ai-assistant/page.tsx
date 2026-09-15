import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';

const promptChips = [
  'Which products should I restock?',
  'What were my best-selling products this month?',
  "Which customers haven't ordered recently?",
];

export default function AiAssistantPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 xl:p-8">
      <div className="surface-card p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2.5 13.8 7l4.7 1.8-4.7 1.8L12 15.5l-1.8-4.9-4.7-1.8L10.2 7 12 2.5Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 13.5 19.2 15l1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7.7-1.5Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.05em] text-stone-900">Shopwise AI</h1>
            <p className="text-sm text-stone-500">Your store insights, recommendations, and customer trends.</p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {promptChips.map((chip) => (
            <Button key={chip} variant="secondary" className="h-9 px-3 text-sm">
              {chip}
            </Button>
          ))}
        </div>

        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 border border-dashed border-stone-200 bg-stone-50 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2.5 13.8 7l4.7 1.8-4.7 1.8L12 15.5l-1.8-4.9-4.7-1.8L10.2 7 12 2.5Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 13.5 19.2 15l1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7.7-1.5Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-stone-900">Shopwise AI is coming soon</p>
            <p className="mt-1 text-sm text-stone-500">The assistant layer is not connected yet, so we’re keeping this space intentionally empty until the backend is ready.</p>
          </div>
          <Button variant="primary" className="h-10 px-4 text-sm">Request beta access</Button>
        </div>
      </div>
    </main>
  );
}
