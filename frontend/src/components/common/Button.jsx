export default function Button({ 
  children, 
  className = '', 
  loading = false, 
  disabled = false,
  variant = 'primary',
  ...props 
}) {
  const baseClasses = 'font-body font-medium flex items-center justify-center w-full transition-all mt-1 p-3.5 border rounded-2xl text-base cursor-pointer min-h-12.5 disabled:cursor-not-allowed active:scale-98'
  const variantClasses =
    variant === 'white'
      ? 'bg-white text-sage-900 border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 hover:bg-slate-50'
      : 'bg-emerald-700 text-white border-none disabled:bg-emerald-700/60 hover:bg-emerald-800'

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2.5 border-current/30 border-t-current rounded-full animate-spin" />
        </div>
      ) : (
        children
      )}
    </button>
  )
}
