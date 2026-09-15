const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
  confirmed: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  processing: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
  shipped: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
  delivered: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200',
  healthy: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  low: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
  critical: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200',
  out_of_stock: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200',
  pending: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
};

export function Badge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11.5px] font-semibold capitalize ${style}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
