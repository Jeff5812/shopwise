const STATUS_STYLES = {
  new: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  processing: 'bg-amber-50 text-amber-700',
  shipped: 'bg-blue-50 text-blue-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
  healthy: 'bg-emerald-50 text-emerald-700',
  low: 'bg-amber-50 text-amber-700',
  critical: 'bg-rose-50 text-rose-700',
  out_of_stock: 'bg-rose-50 text-rose-700',
  pending: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
};

export function Badge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-stone-100 text-stone-600';
  const label = String(status).replace('_', ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium capitalize ${style}`}>
      {label}
    </span>
  );
}
