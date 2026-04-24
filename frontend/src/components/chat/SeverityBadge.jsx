export default function SeverityBadge({ severity, category, confidence, visible = false }) {
  if (!visible || !severity) return null

  const severityConfig = {
    high: { color: '#c0444a', bg: '#fef9f9', icon: '⚠️', label: 'HIGH' },
    medium: { color: '#c9843a', bg: '#fefaf5', icon: '📌', label: 'MEDIUM' },
    low: { color: '#6a9e69', bg: '#f6faf6', icon: '✓', label: 'LOW' },
  }

  const config = severityConfig[severity] || severityConfig.low

  return (
    <div style={{
      background: config.bg,
      border: `1.5px solid rgba(${severity === 'high' ? '192,68,74' : severity === 'medium' ? '201,132,58' : '106,158,105'},0.3)`,
      borderRadius: '14px',
      padding: '10px 14px',
      display: 'block',
      animation: 'fadeIn 0.3s ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '1rem' }}>{config.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '0.8125rem',
            fontWeight: '500',
            color: '#4a4238',
          }}>
            {category || 'Emotional Support Needed'}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          fontSize: '0.6875rem',
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: config.color,
        }}>
          {config.label}
        </div>
        {confidence && (
          <div style={{
            fontSize: '0.6875rem',
            color: '#a89f94',
            background: '#f2f0ec',
            padding: '2px 7px',
            borderRadius: '99px',
          }}>
            {Math.round(confidence * 100)}% confidence
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: '8px' }}>
        <div style={{
          height: '5px',
          background: '#e4e0d8',
          borderRadius: '99px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: '#6a9e69',
            borderRadius: '99px',
            transition: 'width 0.5s ease',
            width: `${(confidence || 0) * 100}%`,
          }} />
        </div>
      </div>
    </div>
  )
}
