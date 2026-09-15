type ProfitPoint = {
  label: string;
  profit: number;
};

export function ProfitTrendChart({ data }: { data: ProfitPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-2 border border-dashed border-stone-200 bg-stone-50 px-4 py-10 text-center">
        <p className="text-sm font-medium text-stone-700">No sales data yet</p>
        <p className="max-w-xs font-serif text-sm text-stone-500">Orders placed through WhatsApp will appear here once your store starts selling.</p>
      </div>
    );
  }

  const max = Math.max(...data.map((point) => point.profit), 1);

  return (
    <div className="flex h-36 items-end gap-2 sm:gap-3">
      {data.map((point) => {
        const height = Math.max((point.profit / max) * 100, point.profit > 0 ? 18 : 10);
        return (
          <div key={`${point.label}-${point.profit}`} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end justify-center">
              <div
                className="w-full max-w-10 rounded-none bg-stone-800"
                style={{ height: `${height}%` }}
                title={`${point.label}: ₦${point.profit}`}
              />
            </div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-stone-400">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}
