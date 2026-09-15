export function Logo({ size = 24, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Shopwise">
        <rect width="24" height="24" rx="3" fill="#1C1917" />
        <rect x="6" y="14" width="5" height="4" rx="0.5" fill="white" />
        <rect x="6" y="9" width="8" height="4" rx="0.5" fill="white" fillOpacity="0.75" />
        <rect x="6" y="4" width="12" height="4" rx="0.5" fill="white" fillOpacity="0.5" />
      </svg>
      {showWordmark && (
        <span className="font-semibold text-[15px] tracking-tight text-stone-900">shopwise</span>
      )}
    </div>
  );
}
