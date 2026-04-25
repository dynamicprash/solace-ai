export default function Input({
  label,
  error,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  name,
  required = false,
  autoComplete,
  className = '',
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={name} className="font-body font-medium text-stone-600 text-sm">
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={`font-body w-full outline-none transition-all placeholder-stone-400 p-3 px-4 text-base border-2 rounded-2xl bg-white text-stone-800 focus:border-sage-600 focus:ring-2 focus:ring-sage-600/12 ${error ? 'border-red-300 bg-red-50' : 'border-stone-300'}`}
        {...props}
      />
      {error && (
        <p className="font-body text-xs text-red-700 mt-0.5">
          {error}
        </p>
      )}
    </div>
  )
}
