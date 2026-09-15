import { useState } from 'react';
import { Button } from '../components/Button';
import { Switch } from '../components/Switch';

const SECTIONS = ['Business', 'Channels', 'Payments', 'Notifications', 'AI', 'Account'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SettingsPage() {
  const [active, setActive] = useState('Business');

  return (
    <div className="px-4 md:px-6 py-5 max-w-4xl">
      <h1 className="text-[19px] font-semibold tracking-tight mb-5">Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex md:flex-col gap-1 overflow-x-auto md:w-40 shrink-0 pb-2 md:pb-0">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setActive(s)}
              className={`text-left whitespace-nowrap px-3 py-2 rounded-lg text-[13px] transition-colors duration-100 ${
                active === s ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0 border border-stone-200 rounded-xl overflow-hidden bg-white">
          {active === 'Business' && <BusinessSection />}
          {active === 'Channels' && <ChannelsSection />}
          {active === 'Payments' && <PaymentsSection />}
          {active === 'Notifications' && <NotificationsSection />}
          {active === 'AI' && <AiSection />}
          {active === 'Account' && <AccountSection />}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-[12.5px] font-medium text-stone-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2 text-[13px] text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent';

function BusinessSection() {
  const [hours, setHours] = useState(Object.fromEntries(DAYS.map((d) => [d, d !== 'Sun'])));

  return (
    <div className="p-5">
      <h2 className="text-[14px] font-semibold text-stone-900 mb-4">Business</h2>
      <Field label="Store name">
        <input type="text" className={inputClass} placeholder="Ifiok's store" />
      </Field>
      <Field label="Currency">
        <select className={inputClass} defaultValue="NGN">
          <option value="NGN">NGN, Nigerian Naira</option>
          <option value="GHS">GHS, Ghanaian Cedi</option>
          <option value="KES">KES, Kenyan Shilling</option>
          <option value="USD">USD, US Dollar</option>
        </select>
      </Field>
      <Field label="Timezone">
        <select className={inputClass} defaultValue="Africa/Lagos">
          <option value="Africa/Lagos">Africa/Lagos, WAT</option>
          <option value="Africa/Accra">Africa/Accra, GMT</option>
          <option value="Africa/Nairobi">Africa/Nairobi, EAT</option>
        </select>
      </Field>
      <span className="block text-[12.5px] font-medium text-stone-700 mb-2">Business hours</span>
      <div className="flex flex-wrap gap-2 mb-5">
        {DAYS.map((d) => (
          <button
            key={d}
            onClick={() => setHours((h) => ({ ...h, [d]: !h[d] }))}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors duration-100 ${
              hours[d] ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-500'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <Button variant="primary">Save changes</Button>
    </div>
  );
}

function ChannelsSection() {
  return (
    <div className="p-5">
      <h2 className="text-[14px] font-semibold text-stone-900 mb-4">Channels</h2>
      <div className="border border-stone-200 rounded-xl p-4 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[13.5px] font-medium text-stone-800">WhatsApp</p>
          <p className="text-[12.5px] text-stone-500 mt-0.5">Not connected</p>
        </div>
        <Button variant="primary">Connect</Button>
      </div>
      <div className="border border-stone-200 rounded-xl p-4 mb-3 flex items-center justify-between opacity-60">
        <div>
          <p className="text-[13.5px] font-medium text-stone-800">Email</p>
          <p className="text-[12.5px] text-stone-500 mt-0.5">Coming soon</p>
        </div>
        <Button variant="secondary" disabled>Connect</Button>
      </div>
      <div className="border border-stone-200 rounded-xl p-4 flex items-center justify-between opacity-60">
        <div>
          <p className="text-[13.5px] font-medium text-stone-800">Other integrations</p>
          <p className="text-[12.5px] text-stone-500 mt-0.5">Coming soon</p>
        </div>
        <Button variant="secondary" disabled>Connect</Button>
      </div>
    </div>
  );
}

function PaymentsSection() {
  return (
    <div className="p-5">
      <h2 className="text-[14px] font-semibold text-stone-900 mb-4">Payments</h2>
      <Field label="Payment provider">
        <select className={inputClass} defaultValue="">
          <option value="" disabled>Select a provider</option>
          <option value="paystack">Paystack</option>
          <option value="flutterwave">Flutterwave</option>
          <option value="manual">Manual, bank transfer</option>
        </select>
      </Field>
      <Field label="Payout account name">
        <input type="text" className={inputClass} placeholder="Account holder name" />
      </Field>
      <Field label="Payout account number">
        <input type="text" className={inputClass} placeholder="0123456789" />
      </Field>
      <p className="text-[12px] text-stone-400 mb-4">Not connected yet. Saving here will not process real payouts until a provider is linked.</p>
      <Button variant="primary">Save changes</Button>
    </div>
  );
}

function NotificationsSection() {
  const [state, setState] = useState({ orders: true, payments: true, inventory: true, ai: false });
  const update = (key) => (val) => setState((s) => ({ ...s, [key]: val }));

  return (
    <div className="p-5">
      <h2 className="text-[14px] font-semibold text-stone-900 mb-2">Notifications</h2>
      <div className="divide-y divide-stone-100">
        <Switch checked={state.orders} onChange={update('orders')} label="Order notifications" description="New orders and status changes" />
        <Switch checked={state.payments} onChange={update('payments')} label="Payment notifications" description="Payments received or pending" />
        <Switch checked={state.inventory} onChange={update('inventory')} label="Inventory alerts" description="Low stock and out of stock warnings" />
        <Switch checked={state.ai} onChange={update('ai')} label="AI recommendations" description="Restock suggestions and business insights" />
      </div>
    </div>
  );
}

function AiSection() {
  const [requireApproval, setRequireApproval] = useState(true);

  return (
    <div className="p-5">
      <h2 className="text-[14px] font-semibold text-stone-900 mb-2">AI</h2>
      <p className="text-[12.5px] text-stone-500 mb-3">
        Shopwise AI can extract orders from WhatsApp messages and suggest restocking. Automated actions still need your confirmation unless you turn this off.
      </p>
      <div className="divide-y divide-stone-100">
        <Switch
          checked={requireApproval}
          onChange={setRequireApproval}
          label="Require my approval before confirming AI-detected orders"
          description="Recommended while the assistant is new to your store"
        />
      </div>
    </div>
  );
}

function AccountSection() {
  return (
    <div className="p-5">
      <h2 className="text-[14px] font-semibold text-stone-900 mb-4">Account</h2>
      <Field label="Name">
        <input type="text" className={inputClass} placeholder="Your name" />
      </Field>
      <Field label="Email">
        <input type="email" className={inputClass} placeholder="you@example.com" />
      </Field>
      <div className="border-t border-stone-100 mt-5 pt-4">
        <p className="text-[13px] font-medium text-stone-800 mb-1">Security</p>
        <p className="text-[12.5px] text-stone-500 mb-3">Change your password or set up two-factor authentication.</p>
        <Button variant="secondary">Change password</Button>
      </div>
      <div className="border-t border-stone-100 mt-5 pt-4">
        <Button variant="danger">Log out</Button>
      </div>
    </div>
  );
}
