export function Logo({ size = 24, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Shopwise">
        <rect width="24" height="24" rx="6" fill="#047857" />
        {/* Monoline shopping bag */}
        <path
          d="M8 9V7.5a4 4 0 0 1 8 0V9"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M6.5 9h11l0.7 9.2a1.4 1.4 0 0 1-1.4 1.5H7.2a1.4 1.4 0 0 1-1.4-1.5L6.5 9Z"
          stroke="white"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {showWordmark && (
        <span className="font-semibold text-[15px] tracking-tight text-stone-900">shopwise</span>
      )}
    </div>
  );
}
