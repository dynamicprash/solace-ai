const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function getColor(count, maxCount) {
  if (count === 0) return '#f1f0ec'
  const intensity = count / maxCount
  if (intensity > 0.75) return '#4338ca'
  if (intensity > 0.5) return '#6366f1'
  if (intensity > 0.25) return '#a5b4fc'
  return '#c7d2fe'
}

export default function EngagementHeatmap({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sage-400 text-sm">
        No engagement data yet. Start chatting to see your patterns.
      </div>
    )
  }

  // Build grid
  const grid = {}
  let maxCount = 1
  data.forEach((item) => {
    const key = `${item.day_of_week}_${item.hour}`
    grid[key] = item.count
    if (item.count > maxCount) maxCount = item.count
  })

  // Find peak
  let peakDay = 0, peakHour = 0, peakCount = 0
  data.forEach((item) => {
    if (item.count > peakCount) {
      peakDay = item.day_of_week
      peakHour = item.hour
      peakCount = item.count
    }
  })

  const cellSize = 18
  const gap = 3

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-[520px]">
          {/* Hour labels */}
          <div className="flex items-end mb-1 ml-10">
            {HOURS.filter((h) => h % 3 === 0).map((h) => (
              <span
                key={h}
                className="text-[10px] text-sage-400"
                style={{ width: `${(cellSize + gap) * 3}px`, textAlign: 'left' }}
              >
                {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
              </span>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-0" style={{ marginBottom: `${gap}px` }}>
              <span className="text-[11px] text-sage-500 w-10 text-right pr-2 font-medium">
                {day}
              </span>
              <div className="flex" style={{ gap: `${gap}px` }}>
                {HOURS.map((hour) => {
                  const count = grid[`${dayIdx}_${hour}`] || 0
                  return (
                    <div
                      key={hour}
                      title={`${day} ${hour}:00 — ${count} messages`}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        backgroundColor: getColor(count, maxCount),
                        borderRadius: '4px',
                        transition: 'transform 0.15s ease',
                        cursor: 'pointer',
                      }}
                      className="hover:scale-125 hover:ring-2 hover:ring-indigo-300"
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend + insight */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-sage-400">Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
            <div
              key={i}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '3px',
                backgroundColor: intensity === 0 ? '#f1f0ec'
                  : intensity <= 0.25 ? '#c7d2fe'
                  : intensity <= 0.5 ? '#a5b4fc'
                  : intensity <= 0.75 ? '#6366f1'
                  : '#4338ca',
              }}
            />
          ))}
          <span className="text-[10px] text-sage-400">More</span>
        </div>
        {peakCount > 0 && (
          <span className="text-xs text-sage-500">
            Peak: <span className="font-medium text-sage-700">
              {DAYS[peakDay]} {peakHour}:00
            </span> ({peakCount} msgs)
          </span>
        )}
      </div>
    </div>
  )
}
