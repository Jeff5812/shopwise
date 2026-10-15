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
  const base =
    'btn-press inline-flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    // Text on green is always dark (white on #1DB954 fails contrast).
    primary: 'bg-emerald-600 text-stone-900 hover:bg-emerald-500',
    secondary: 'bg-white border border-stone-200 text-stone-900 hover:bg-stone-100',
    ghost: 'text-stone-600 hover:bg-stone-100 active:bg-stone-200',
    danger: 'bg-danger text-white hover:bg-[#8F3325]',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
