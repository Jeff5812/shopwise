/* Destination: shopwise-dashboard/components/dashboard/Leaderboard.tsx

   Top products by sales, with rank movement against the previous period.

   DATA (read-only, vendor-scoped):
   - rows: sorted best first. { name, sales, previousRank? }. sales = sum of
     order_items quantity * unit_price for orders with a 'paid' payment in the
     current period. previousRank = 1-based rank in the previous period of the
     same length, or undefined if the product had no paid sales then.
   Sales only. Profit is not shown: cost data is not complete for every product. */

type Row = { name: string; sales: number; previousRank?: number };

function naira(value: number) {
  return `₦${Math.round(value).toLocaleString('en-NG')}`;
}

function Movement({ rank, previousRank }: { rank: number; previousRank?: number }) {
  if (previousRank === undefined) {
    return (
      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-900">
        New
      </span>
    );
  }
  const change = previousRank - rank; // positive = moved up
  if (change === 0) {
    return (
      <span className="text-xs text-stone-500" aria-label="No change in rank">
        –
      </span>
    );
  }
  const up = change > 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-stone-900"
      aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(change)}`}
    >
      <span
        aria-hidden="true"
        className={`h-0 w-0 border-x-[4px] border-x-transparent ${
          up ? 'border-b-[6px] border-b-emerald-600' : 'border-t-[6px] border-t-danger'
        }`}
      />
      {Math.abs(change)}
    </span>
  );
}

export function Leaderboard({ rows, title = 'Top products' }: { rows: Row[]; title?: string }) {
  const top = Math.max(...rows.map((row) => row.sales), 1);

  return (
    <section aria-labelledby="leaderboard-title" className="surface-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="leaderboard-title" className="text-sm font-semibold text-stone-900">
          {title}
        </h2>
        <span className="text-xs text-stone-500">Sales, with rank change since last period</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-stone-500">No paid sales to rank yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-stone-100">
          {rows.map((row, index) => (
            <li className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 py-3" key={row.name}>
              <span className="font-serif text-lg font-semibold tabular-nums text-stone-500">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-900">{row.name}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200/70">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${Math.max((row.sales / top) * 100, 4)}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-data text-sm text-stone-900">{naira(row.sales)}</span>
                <Movement rank={index + 1} previousRank={row.previousRank} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
