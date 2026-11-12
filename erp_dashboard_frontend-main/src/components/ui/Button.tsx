import type { ButtonHTMLAttributes } from 'react';

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const baseClasses =
  'inline-flex min-w-0 max-w-full items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60';

const variantClasses = {
  primary: 'border-transparent bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border-slate-300 bg-white text-blue-900 hover:bg-slate-100',
  danger: 'border-transparent bg-rose-600 text-white hover:bg-rose-700',
  success: 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700',
  nav: 'w-full justify-start rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-left text-slate-800 shadow-sm hover:border-slate-300 hover:bg-white',
  tab: 'border-transparent bg-blue-50 text-blue-900 hover:bg-blue-100',
};

const sizeClasses = {
  md: 'h-11',
  sm: 'min-h-8 px-2.5 py-1.5 text-xs',
};

export default function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'nav' | 'tab';
  size?: 'md' | 'sm';
}) {
  const classes = joinClassNames(
    baseClasses,
    variantClasses[variant as keyof typeof variantClasses] ?? variantClasses.primary,
    sizeClasses[size as keyof typeof sizeClasses] ?? sizeClasses.md,
    className,
  );

  return <button type={type} className={classes} {...props} />;
}
