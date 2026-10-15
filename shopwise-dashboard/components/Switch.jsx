export function Switch({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="pr-4">
        <p className="text-[13.5px] font-medium text-stone-800">{label}</p>
        {description && <p className="text-[12.5px] text-stone-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${
          checked ? 'bg-emerald-700' : 'bg-stone-300'
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform duration-150 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
