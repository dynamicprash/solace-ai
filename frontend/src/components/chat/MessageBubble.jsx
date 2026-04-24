export default function MessageBubble({ message, isUser, isConclusion }) {
  // Get user initials
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
  }

  if (isConclusion) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px',
        animation: 'fadeUp 0.3s ease both',
      }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: '#e4ede4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          flexShrink: 0,
          border: '1.5px solid #c5d9c4',
        }}>
          🤖
        </div>
        <div style={{
          maxWidth: 'min(620px, 90%)',
          padding: '14px 18px',
          borderRadius: '22px',
          borderBottomLeftRadius: '4px',
          lineHeight: '1.65',
          fontSize: '0.9375rem',
          background: 'linear-gradient(135deg, #f8faf8 0%, #f4f7f2 100%)',
          border: '1.5px solid #9abf99',
        }}>
          <div style={{
            fontSize: '0.78125rem',
            fontWeight: '600',
            color: '#3a6640',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '10px',
            paddingBottom: '10px',
            borderBottom: '1px solid #9abf99',
          }}>
            Session Summary
          </div>
          <div dangerouslySetInnerHTML={{ __html: message }} style={{ color: '#4a4238' }} />
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px',
        justifyContent: 'flex-end',
        animation: 'fadeUp 0.3s ease both',
      }}>
        <div style={{
          maxWidth: 'min(480px, 80%)',
          padding: '14px 18px',
          borderRadius: '22px',
          borderBottomRightRadius: '4px',
          lineHeight: '1.65',
          fontSize: '0.9375rem',
          background: '#3a6640',
          color: 'white',
        }}>
          {message}
        </div>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: '#3a6640',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6875rem',
          fontWeight: '600',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}>
          U
        </div>
      </div>
    )
  }

  // Bot message
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '10px',
      animation: 'fadeUp 0.3s ease both',
    }}>
      <div style={{
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        background: '#e4ede4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
        flexShrink: 0,
        border: '1.5px solid #c5d9c4',
      }}>
        🤖
      </div>
      <div style={{
        maxWidth: 'min(480px, 80%)',
        padding: '14px 18px',
        borderRadius: '22px',
        borderBottomLeftRadius: '4px',
        lineHeight: '1.65',
        fontSize: '0.9375rem',
        background: '#fdfcf9',
        color: '#4a4238',
        border: '1.5px solid #e4e0d8',
        boxShadow: '0 1px 4px rgba(30, 49, 33, 0.08)',
      }}>
        {message}
      </div>
    </div>
  )
}
