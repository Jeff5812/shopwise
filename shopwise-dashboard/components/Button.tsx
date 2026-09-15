export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold px-3.5 py-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-px';
  const variants = {
    primary: 'surface-emerald text-white hover:brightness-110',
    secondary: 'bg-white border border-stone-300 text-stone-800 shadow-[0_1px_2px_rgba(28,25,23,0.06)] hover:bg-stone-50 hover:shadow-[0_2px_6px_rgba(28,25,23,0.1)] active:bg-stone-100',
    ghost: 'text-stone-600 hover:bg-stone-100 active:bg-stone-200',
    danger: 'bg-gradient-to-b from-rose-600 to-rose-700 text-white shadow-[0_1px_2px_rgba(190,18,60,0.3),0_6px_16px_-6px_rgba(190,18,60,0.5)] hover:brightness-110',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
