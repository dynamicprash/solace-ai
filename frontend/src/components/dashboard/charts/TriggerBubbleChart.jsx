import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899',
  '#14b8a6', '#22c55e', '#3b82f6', '#06b6d4',
]

function CustomContent({ x, y, width, height, name, count, index }) {
  if (width < 30 || height < 20) return null
  const color = COLORS[index % COLORS.length]
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        rx={8} ry={8}
        fill={color}
        fillOpacity={0.85}
        stroke="#fff"
        strokeWidth={2}
        style={{ transition: 'all 0.3s ease' }}
      />
      {width > 55 && height > 35 && (
        <>
          <text
            x={x + width / 2} y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.min(14, width / 6)}
            fontWeight="600"
          >
            {name}
          </text>
          <text
            x={x + width / 2} y={y + height / 2 + 12}
            textAnchor="middle"
            fill="rgba(255,255,255,0.8)"
            fontSize={Math.min(11, width / 7)}
          >
            {count}×
          </text>
        </>
      )}
    </g>
  )
}

export default function TriggerBubbleChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sage-400 text-sm">
        No triggers detected yet. Chat sessions will reveal patterns.
      </div>
    )
  }

  const treeData = data.map((item, idx) => ({
    name: item.trigger.charAt(0).toUpperCase() + item.trigger.slice(1),
    size: item.count,
    count: item.count,
    index: idx,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap
        data={treeData}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="#fff"
        content={<CustomContent />}
      >
        <Tooltip
          contentStyle={{
            backgroundColor: '#fffef9',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '12px',
          }}
          formatter={(value, name) => [`${value} sessions`, 'Frequency']}
          labelFormatter={(label) => label}
        />
      </Treemap>
    </ResponsiveContainer>
  )
}
