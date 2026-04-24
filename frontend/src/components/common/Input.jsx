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
    <div className="flex flex-col" style={{ gap: '6px' }}>
      {label && (
        <label htmlFor={name} className="font-body font-medium text-stone-600" style={{ fontSize: '0.8125rem' }}>
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
        className="font-body w-full outline-none transition-all placeholder-stone-400"
        style={{
          padding: '12px 16px',
          fontSize: '0.9375rem',
          borderWidth: '1.5px',
          borderColor: error ? '#fca5a5' : '#e4e0d8',
          borderStyle: 'solid',
          borderRadius: '14px',
          backgroundColor: error ? '#fef2f2' : '#fdfcf9',
          color: '#4a4238',
        }}
        onFocus={(e) => {
          if (!error) {
            e.target.style.borderColor = '#6a9e69';
            e.target.style.boxShadow = '0 0 0 3px rgba(106, 158, 105, 0.12)';
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#fca5a5' : '#e4e0d8';
          e.target.style.boxShadow = 'none';
          onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <p className="font-body" style={{ fontSize: '0.875rem', color: '#b91c1c', marginTop: '2px' }}>
          {error}
        </p>
      )}
    </div>
  )
}
