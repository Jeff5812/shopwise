/* ShopWise mark: the approved logo, inlined so it needs no network request.
   Ids are prefixed (swm-) so several instances on one page never collide. */
function MarkArt() {
  return (
    <>
<defs>
<linearGradient id="swm-plat" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stopColor="#F6F8FA"/><stop offset=".34" stopColor="#CDD2D9"/>
  <stop offset=".62" stopColor="#8E959F"/><stop offset="1" stopColor="#E3E6EA"/>
</linearGradient>
<linearGradient id="swm-platEdge" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stopColor="#9AA1AB"/><stop offset="1" stopColor="#4A5058"/>
</linearGradient>
<linearGradient id="swm-shine" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stopColor="#fff" stopOpacity=".95"/><stop offset=".55" stopColor="#fff" stopOpacity=".25"/>
  <stop offset="1" stopColor="#fff" stopOpacity=".7"/>
</linearGradient>
<linearGradient id="swm-glass" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stopColor="#2BE39A" stopOpacity=".48"/><stop offset="1" stopColor="#047A4E" stopOpacity=".62"/>
</linearGradient>
<linearGradient id="swm-emerald" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stopColor="#47F0B0"/><stop offset=".5" stopColor="#10B36F"/><stop offset="1" stopColor="#067047"/>
</linearGradient>
<linearGradient id="swm-sheen" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stopColor="#fff" stopOpacity="0"/><stop offset=".5" stopColor="#fff" stopOpacity=".26"/>
  <stop offset="1" stopColor="#fff" stopOpacity="0"/>
</linearGradient>
<radialGradient id="swm-glow" cx=".5" cy=".5" r=".5">
  <stop offset="0" stopColor="#10B36F" stopOpacity=".30"/><stop offset="1" stopColor="#10B36F" stopOpacity="0"/>
</radialGradient>
<radialGradient id="swm-bg" cx=".5" cy=".42" r=".75">
  <stop offset="0" stopColor="#171B23"/><stop offset=".6" stopColor="#0A0C10"/><stop offset="1" stopColor="#050608"/>
</radialGradient>
<clipPath id="swm-basketClip"><path d="M34.3 42 H107 L99 69 C98 72.8 95.5 75 91.5 75 H48.5 C44.5 75 42 72.8 41 69 Z"/></clipPath>
</defs>
<rect width="600" height="600" rx="132" fill="url(#swm-bg)"/>
<g transform="translate(21.70 17.10) scale(4.6)">
  <ellipse cx="62" cy="62" rx="62" ry="40" fill="url(#swm-glow)"/>
  <path d="M34.3 42 H107 L99 69 C98 72.8 95.5 75 91.5 75 H48.5 C44.5 75 42 72.8 41 69 Z" fill="url(#swm-glass)"/>
  <g clipPath="url(#swm-basketClip)"><path d="M52 40 H66 L56 78 H42 Z" fill="url(#swm-sheen)"/></g>
  <path d="M10 30 H26 C29.5 30 31.8 32.2 32.8 36 L41 69 C42 72.8 44.5 75 48.5 75 H91.5 C95.5 75 98 72.8 99 69 L107 42 H34.3" fill="none" stroke="url(#swm-platEdge)" strokeWidth="6.8" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M10 30 H26 C29.5 30 31.8 32.2 32.8 36 L41 69 C42 72.8 44.5 75 48.5 75 H91.5 C95.5 75 98 72.8 99 69 L107 42 H34.3" fill="none" stroke="url(#swm-plat)" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M10 30 H26 C29.5 30 31.8 32.2 32.8 36 L41 69 C42 72.8 44.5 75 48.5 75 H91.5 C95.5 75 98 72.8 99 69 L107 42 H34.3" fill="none" stroke="url(#swm-shine)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(-.5 -.9)"/>
  <circle cx="54" cy="92" r="5.6" fill="url(#swm-emerald)"/><circle cx="52.4" cy="90.2" r="1.7" fill="#fff" fillOpacity=".75"/>
  <circle cx="86" cy="92" r="5.6" fill="url(#swm-emerald)"/><circle cx="84.4" cy="90.2" r="1.7" fill="#fff" fillOpacity=".75"/>
</g>
    </>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 600 600" role="img" aria-label="Shopwise">
      <MarkArt />
    </svg>
  );
}

export function Logo({
  size = 28,
  showWordmark = true,
  inverted = false,
}: {
  size?: number;
  showWordmark?: boolean;
  inverted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className={`font-serif text-[18px] font-semibold tracking-tight ${
            inverted ? 'text-stone-50' : 'text-stone-900'
          }`}
        >
          Shopwise
        </span>
      )}
    </div>
  );
}
