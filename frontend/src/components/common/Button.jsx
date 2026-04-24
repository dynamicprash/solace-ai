export default function Button({ 
  children, 
  className = '', 
  loading = false, 
  disabled = false,
  ...props 
}) {
  return (
    <button
      disabled={disabled || loading}
      className="font-body font-medium text-white flex items-center justify-center w-full transition-all"
      style={{
        marginTop: '4px',
        padding: '14px',
        backgroundColor: disabled || loading ? 'rgba(58, 102, 64, 0.6)' : '#3a6640',
        border: 'none',
        borderRadius: '14px',
        fontSize: '0.9375rem',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        minHeight: '50px',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = '#2e5133';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = '#3a6640';
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = 'scale(0.98)';
        }
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div 
            style={{
              width: '20px',
              height: '20px',
              border: '2.5px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} 
          />
        </div>
      ) : (
        children
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}
