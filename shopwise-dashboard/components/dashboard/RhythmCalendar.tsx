/* Destination: shopwise-dashboard/components/dashboard/RhythmCalendar.tsx

   Sales rhythm: which days of the week sell best, over the last 5 weeks.

   DATA (read-only, vendor-scoped):
   - days: exactly 35 entries, oldest first, ending today. One entry per calendar
     day, { date: 'YYYY-MM-DD', sales: number }. sales = total_amount of orders that
     have a payment with status 'paid' on that day. Use 0 for days with no sales.
   This is gross sales, not profit, and the card says so. */

type Day = { date: string; sales: number };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LEVELS = [
  'bg-stone-100',
  'bg-emerald-100',
  'bg-emerald-200',
  'bg-emerald-500',
  'bg-emerald-600',
];

function naira(value: number) {
  return `₦${Math.round(value).toLocaleString('en-NG')}`;
}

/** Monday = 0 ... Sunday = 6, from a YYYY-MM-DD string (no timezone drift). */
function mondayIndex(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function RhythmCalendar({ days }: { days: Day[] }) {
  const peak = Math.max(...days.map((day) => day.sales), 0);
  const level = (sales: number) =>
    sales <= 0 || peak <= 0 ? 0 : Math.min(4, Math.ceil((sales / peak) * 4));

  // Lay days into week columns, padding the first week so rows are Monday to Sunday.
  const offset = days.length ? mondayIndex(days[0].date) : 0;
  const cells: (Day | null)[] = [...Array(offset).fill(null), ...days];
  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const byWeekday = WEEKDAYS.map((_, index) =>
    days.filter((day) => mondayIndex(day.date) === index).reduce((sum, day) => sum + day.sales, 0),
  );
  const bestIndex = byWeekday.indexOf(Math.max(...byWeekday));
  const hasSales = peak > 0;

  return (
    <section aria-labelledby="rhythm-title" className="surface-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rhythm-title" className="text-sm font-semibold text-stone-900">
          Sales rhythm
        </h2>
        <span className="text-xs text-stone-500">Last 5 weeks, gross sales from paid orders</span>
      </div>

      <div className="mt-5 flex gap-3 overflow-x-auto">
        <div className="grid grid-rows-7 gap-1.5 pt-0 text-[11px] text-stone-500" aria-hidden="true">
          {WEEKDAYS.map((label) => (
            <span className="flex h-6 items-center" key={label}>
              {label}
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          {weeks.map((week, weekIndex) => (
            <div className="grid grid-rows-7 gap-1.5" key={weekIndex}>
              {Array.from({ length: 7 }, (_, row) => {
                const day = week[row];
                return day ? (
                  <span
                    key={day.date}
                    title={`${day.date}: ${naira(day.sales)}`}
                    className={`h-6 w-6 rounded-md ${LEVELS[level(day.sales)]}`}
                  />
                ) : (
                  <span className="h-6 w-6" key={`empty-${row}`} />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          {hasSales
            ? `${WEEKDAYS[bestIndex]} has been your strongest day.`
            : 'No paid orders in this period yet.'}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-stone-500" aria-hidden="true">
          Less
          {LEVELS.map((cls) => (
            <span className={`h-3 w-3 rounded-sm ${cls}`} key={cls} />
          ))}
          More
        </div>
      </div>
    </section>
  );
}
