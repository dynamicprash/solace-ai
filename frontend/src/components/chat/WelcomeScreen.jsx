export default function WelcomeScreen({ userName, onStart }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '48px 24px',
      animation: 'fadeUp 0.5s ease both',
      maxWidth: '500px',
      margin: 'auto',
    }}>
      <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🌿</div>
      
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '2rem',
        color: '#263f2a',
        marginBottom: '14px',
        letterSpacing: '-0.02em',
      }}>
        Welcome, {userName}
      </h1>

      <p style={{
        color: '#958c7a',
        fontSize: '0.9375rem',
        lineHeight: '1.7',
        marginBottom: '28px',
      }}>
        Start a new session to share what's on your mind. 
        This is a safe, judgment-free space where your thoughts and feelings matter.
      </p>

      {/* Features */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '32px',
        width: '100%',
        maxWidth: '360px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fdfcf9',
          border: '1px solid #e4e0d8',
          borderRadius: '14px',
          padding: '10px 14px',
          fontSize: '0.8125rem',
          color: '#786e5c',
        }}>
          <span>🔒</span>
          <span>Private</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fdfcf9',
          border: '1px solid #e4e0d8',
          borderRadius: '14px',
          padding: '10px 14px',
          fontSize: '0.8125rem',
          color: '#786e5c',
        }}>
          <span>🤝</span>
          <span>Supportive</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fdfcf9',
          border: '1px solid #e4e0d8',
          borderRadius: '14px',
          padding: '10px 14px',
          fontSize: '0.8125rem',
          color: '#786e5c',
        }}>
          <span>💬</span>
          <span>Real-time</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fdfcf9',
          border: '1px solid #e4e0d8',
          borderRadius: '14px',
          padding: '10px 14px',
          fontSize: '0.8125rem',
          color: '#786e5c',
        }}>
          <span>📊</span>
          <span>Analytics</span>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={onStart}
        style={{
          padding: '15px 40px',
          background: '#3a6640',
          color: 'white',
          border: 'none',
          borderRadius: '22px',
          fontFamily: 'var(--font-body)',
          fontSize: '1rem',
          fontWeight: '500',
          cursor: 'pointer',
          minWidth: '220px',
          minHeight: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(74, 128, 80, 0.25)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#2e5133'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#3a6640'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        Start Conversation
      </button>

      {/* Disclaimer */}
      <p style={{
        marginTop: '24px',
        fontSize: '0.78125rem',
        color: '#a89f94',
        lineHeight: '1.5',
      }}>
        This is a supportive tool, not a substitute for professional mental health care.
        <br />
        If you're in crisis, please call <strong style={{ color: '#958c7a' }}>988</strong>.
      </p>
    </div>
  )
}
