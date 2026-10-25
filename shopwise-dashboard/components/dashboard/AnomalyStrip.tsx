/* Destination: shopwise-dashboard/components/dashboard/AnomalyStrip.tsx

   Payment health: failed payments per day for the last 14 days, plus unpaid orders
   waiting more than 24 hours.

   DATA (read-only, vendor-scoped, same pattern as the other dashboard reads):
   - failedByDay: 14 numbers, oldest first. Count of payments where status = 'failed',
     grouped by created_at day.
   - unpaidOver24h: count of orders where status = 'pending_payment' and
     created_at is more than 24 hours ago. This is "unpaid orders", not "cart
     abandonment": Shopwise does not track carts.

   The alert rule lives here so it is easy to change. */

const MIN_FAILURES = 3;
const SPIKE_FACTOR = 2;

export function AnomalyStrip({
  failedByDay,
  unpaidOver24h,
}: {
  failedByDay: number[];
  unpaidOver24h: number;
}) {
  const days = failedByDay.slice(-14);
  const recent = days.slice(-7).reduce((sum, n) => sum + n, 0);
  const previous = days.slice(0, -7).reduce((sum, n) => sum + n, 0);
  const spiking = recent >= MIN_FAILURES && recent >= previous * SPIKE_FACTOR;
  const peak = Math.max(...days, 1);

  const message = spiking
    ? `Failed payments are up: ${recent} in the last 7 days, compared with ${previous} the week before.`
    : recent === 0
      ? 'No failed payments in the last 7 days.'
      : `${recent} failed ${recent === 1 ? 'payment' : 'payments'} in the last 7 days. This is within the usual range.`;

  return (
    <section
      aria-labelledby="payment-health-title"
      className={`surface-card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between ${
        spiking ? 'border-danger/60' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h2 id="payment-health-title" className="text-sm font-semibold text-stone-900">
            Payment health
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold text-stone-900 ${
              spiking ? 'bg-danger/12' : 'bg-emerald-600/20'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${spiking ? 'bg-danger' : 'bg-emerald-600'}`}
            />
            {spiking ? 'Needs attention' : 'Steady'}
          </span>
        </div>
        <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">{message}</p>
        <p className="mt-1 text-sm text-stone-600">
          Unpaid orders older than 24 hours:{' '}
          <span className="font-data font-medium text-stone-900">{unpaidOver24h}</span>
        </p>
      </div>

      <div
        role="img"
        aria-label={`Failed payments per day, last ${days.length} days`}
        className="flex h-14 shrink-0 items-end gap-1"
      >
        {days.map((count, index) => {
          const isRecent = index >= days.length - 7;
          return (
            <span
              key={index}
              title={`${count} failed`}
              className={`w-2.5 rounded-sm ${
                count === 0 ? 'bg-stone-200' : spiking && isRecent ? 'bg-danger' : 'bg-stone-400'
              }`}
              style={{ height: `${count === 0 ? 8 : Math.max((count / peak) * 100, 16)}%` }}
            />
          );
        })}
      </div>
    </section>
  );
}
