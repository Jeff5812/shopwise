export function Button({ variant = 'primary', className = '', children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium px-4 py-2 transition-all duration-150 ease-out active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';

  const variants = {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900',
    secondary: 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 active:bg-stone-100',
    ghost: 'text-stone-600 hover:bg-stone-100 active:bg-stone-200',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
