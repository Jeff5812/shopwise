type Tone = 'neutral' | 'success' | 'warn' | 'danger';

const TONES: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: 'bg-stone-200 text-stone-900', dot: 'bg-stone-500' },
  success: { pill: 'bg-emerald-600/20 text-stone-900', dot: 'bg-emerald-600' },
  warn: { pill: 'bg-warn/15 text-stone-900', dot: 'bg-warn' },
  danger: { pill: 'bg-danger/12 text-stone-900', dot: 'bg-danger' },
};

// Real order states: awaiting_confirmation, pending_payment, confirmed, canceled.
// Real payment states: pending, paid, failed, cancelled, refunded.
const STATUS_TONE: Record<string, Tone> = {
  new: 'neutral',
  awaiting_confirmation: 'neutral',
  shipped: 'neutral',
  refunded: 'neutral',
  processing: 'warn',
  pending: 'warn',
  pending_payment: 'warn',
  low: 'warn',
  confirmed: 'success',
  delivered: 'success',
  healthy: 'success',
  paid: 'success',
  cancelled: 'danger',
  canceled: 'danger',
  failed: 'danger',
  critical: 'danger',
  out_of_stock: 'danger',
};

export function Badge({ status }: { status: string }) {
  const tone = TONES[STATUS_TONE[status] ?? 'neutral'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold capitalize ${tone.pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
