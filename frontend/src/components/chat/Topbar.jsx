import SeverityBadge from './SeverityBadge'

export default function Topbar({ 
  isSidebarOpen, 
  onToggleSidebar, 
  severity, 
  category, 
  confidence,
  onNewChat 
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '10px 20px',
      background: '#fdfcf9',
      borderBottom: '1px solid #e4e0d8',
      minHeight: '60px',
      flexShrink: 0,
      flexWrap: 'wrap',
    }}>
      {/* Menu Button */}
      <button
        onClick={onToggleSidebar}
        style={{
          width: '36px',
          height: '36px',
          background: '#f2f0ec',
          border: '1px solid #e4e0d8',
          borderRadius: '8px',
          fontSize: '0.9rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#e4e0d8'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#f2f0ec'
        }}
        title="Toggle sidebar"
      >
        ☰
      </button>

      {/* Center Area - Title or empty */}
      <div style={{ flex: 1 }} />

      {/* New Chat Button */}
      <button
        onClick={onNewChat}
        style={{
          padding: '8px 16px',
          background: '#3a6640',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          fontWeight: '500',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#2e5133'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#3a6640'
        }}
      >
        + New Chat
      </button>

      {/* Severity Badge */}
      {severity && (
        <div style={{ width: '100%' }}>
          <SeverityBadge 
            severity={severity}
            category={category}
            confidence={confidence}
            visible={true}
          />
        </div>
      )}
    </div>
  )
}
