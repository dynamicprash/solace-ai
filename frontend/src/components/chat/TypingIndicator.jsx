export default function TypingIndicator() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '10px',
      animation: 'fadeIn 0.2s ease',
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
        background: '#fdfcf9',
        border: '1.5px solid #e4e0d8',
        borderRadius: '18px',
        borderBottomLeftRadius: '4px',
        padding: '14px 20px',
        display: 'flex',
        gap: '5px',
        alignItems: 'center',
      }}>
        <span style={{
          width: '7px',
          height: '7px',
          background: '#b0a898',
          borderRadius: '50%',
          animation: 'pulse 1.2s ease infinite',
        }} />
        <span style={{
          width: '7px',
          height: '7px',
          background: '#b0a898',
          borderRadius: '50%',
          animation: 'pulse 1.2s ease infinite',
          animationDelay: '0.2s',
        }} />
        <span style={{
          width: '7px',
          height: '7px',
          background: '#b0a898',
          borderRadius: '50%',
          animation: 'pulse 1.2s ease infinite',
          animationDelay: '0.4s',
        }} />
      </div>
    </div>
  )
}
