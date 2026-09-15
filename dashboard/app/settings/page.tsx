import { Button } from '@/components/Button';

const groups = [
  {
    title: 'Business',
    fields: [
      { label: 'Store name', value: 'Shopwise Studio' },
      { label: 'Business type', value: 'Fashion & accessories' },
      { label: 'Default currency', value: 'NGN' },
    ],
  },
  {
    title: 'Channels',
    fields: [
      { label: 'WhatsApp Business', value: 'Connected' },
      { label: 'Instagram', value: 'Not connected' },
      { label: 'Facebook Shop', value: 'Not connected' },
    ],
  },
  {
    title: 'Payments',
    fields: [
      { label: 'Preferred payout', value: 'Bank transfer' },
      { label: 'Settlement schedule', value: 'Every Friday' },
      { label: 'Tax status', value: 'Not set' },
    ],
  },
  {
    title: 'Notifications',
    fields: [
      { label: 'Order alerts', value: 'Enabled' },
      { label: 'Low stock alerts', value: 'Enabled' },
      { label: 'Payment reminders', value: 'Disabled' },
    ],
  },
  {
    title: 'AI',
    fields: [
      { label: 'AI assistant', value: 'Coming soon' },
      { label: 'Order extraction', value: 'Preview' },
      { label: 'Inbox summarisation', value: 'Preview' },
    ],
  },
  {
    title: 'Account',
    fields: [
      { label: 'Owner', value: 'Ada Johnson' },
      { label: 'Email', value: 'ada@shopwise.app' },
      { label: 'Plan', value: 'Free' },
    ],
  },
];

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 xl:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-stone-900">Settings</h1>
        </div>
        <Button variant="primary" className="h-10 px-4 text-sm">Save changes</Button>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.title} className="surface-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-stone-900">{group.title}</h2>
              {group.title === 'Account' ? <Button variant="danger" className="h-9 px-3 text-sm">Delete account</Button> : null}
            </div>

            <div className="space-y-3">
              {group.fields.map((field) => (
                <div key={field.label} className="flex flex-col gap-2 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-stone-500">{field.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-data text-sm text-stone-800">{field.value}</span>
                    <button
                      type="button"
                      className="text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
