import { Icon } from '@/components/Icon';
import { COMPARISON, naira, TIERS, type Cell } from '@/lib/pricing';

/* Destination: shopwise-marketing/components/pricing/PricingComparison.tsx */

function CellValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand text-on-brand">
        <Icon name="check" className="h-3 w-3" strokeWidth={2.4} />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-muted/50" aria-label="Not included">
        –
      </span>
    );
  }
  return <span className="text-xs italic text-muted">To be confirmed</span>;
}

export function PricingComparison() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">Planned Shopwise plans compared</caption>
        <thead>
          <tr className="border-b border-border bg-sand/30 text-foreground">
            <th scope="col" className="p-4 text-left font-medium">
              Features
            </th>
            {TIERS.map((tier) => (
              <th scope="col" className="p-4 text-center font-medium" key={tier.id}>
                {tier.name}
                <span className="mt-0.5 block text-xs font-normal tabular-nums text-muted">
                  {tier.monthly === null ? 'Custom' : `${naira(tier.monthly)}/mo`}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((group) => (
            <GroupRows group={group} key={group.title} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ group }: { group: (typeof COMPARISON)[number] }) {
  return (
    <>
      <tr>
        <th
          colSpan={TIERS.length + 1}
          scope="colgroup"
          className="border-b border-border-soft bg-canvas px-4 py-2.5 text-left text-xs font-semibold text-foreground"
        >
          {group.title}
        </th>
      </tr>
      {group.rows.map((row, index) => (
        <tr
          className={`border-b border-border-soft last:border-0 ${index % 2 ? 'bg-canvas/50' : ''}`}
          key={row.label}
        >
          <th scope="row" className="p-4 text-left font-normal text-muted">
            {row.label}
          </th>
          {TIERS.map((tier) => (
            <td className="p-4 text-center" key={tier.id}>
              <CellValue value={row.values[tier.id]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
