type PreloaderProps = {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'slate';
};

export default function Preloader({ size = 'md', color = 'blue' }: PreloaderProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-2',
  };

  const colorClasses = {
    blue: 'border-slate-300 border-t-blue-500',
    slate: 'border-[#c9d8f8] border-t-[#2d6ff7]',
  };

  return (
    <div className='flex items-center justify-center'>
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
      />
    </div>
  );
}
