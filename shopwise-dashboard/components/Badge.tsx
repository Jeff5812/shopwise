const STATUS_STYLES: Record<string, string> = {
  new: 'bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200',
  confirmed: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100',
  processing: 'bg-[#F5EDD9] text-[#76500D] ring-1 ring-inset ring-[#E0C988]',
  shipped: 'bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200',
  delivered: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100',
  cancelled: 'bg-[#F6E8E5] text-[#842C23] ring-1 ring-inset ring-[#E5C2BC]',
  healthy: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100',
  low: 'bg-[#F5EDD9] text-[#76500D] ring-1 ring-inset ring-[#E0C988]',
  critical: 'bg-[#F6E8E5] text-[#842C23] ring-1 ring-inset ring-[#E5C2BC]',
  out_of_stock: 'bg-[#F6E8E5] text-[#842C23] ring-1 ring-inset ring-[#E5C2BC]',
  pending: 'bg-[#F5EDD9] text-[#76500D] ring-1 ring-inset ring-[#E0C988]',
  paid: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100',
};

export function Badge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11.5px] font-semibold capitalize ${style}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
