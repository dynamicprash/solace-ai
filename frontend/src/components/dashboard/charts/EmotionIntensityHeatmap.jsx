const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function getColor(avgIntensity) {
  if (avgIntensity === 0) return '#f1f0ec'
  if (avgIntensity <= 1.5) return '#a7f3d0' // Emerald 200 (Low)
  if (avgIntensity <= 2.2) return '#fef08a' // Yellow 200 (Medium)
  return '#fca5a5' // Red 200 (High)
}

function getIntensityLabel(avgIntensity) {
  if (avgIntensity === 0) return 'No data'
  if (avgIntensity <= 1.5) return 'Low Intensity'
  if (avgIntensity <= 2.2) return 'Medium Intensity'
  return 'High Intensity'
}

export default function EmotionIntensityHeatmap({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sage-400 text-sm">
        No intensity data yet. Continue using chat to map distress hot-spots.
      </div>
    )
  }

  // Build grid
  const grid = {}
  const countGrid = {}
  data.forEach((item) => {
    const key = `${item.day_of_week}_${item.hour}`
    grid[key] = item.avg_intensity
    countGrid[key] = item.count
  })

  // Find peak average intensity
  let peakDay = 0, peakHour = 0, peakIntensity = 0
  data.forEach((item) => {
    if (item.avg_intensity > peakIntensity && item.count > 0) {
      peakDay = item.day_of_week
      peakHour = item.hour
      peakIntensity = item.avg_intensity
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
                  const avgVal = grid[`${dayIdx}_${hour}`] || 0
                  const count = countGrid[`${dayIdx}_${hour}`] || 0
                  return (
                    <div
                      key={hour}
                      title={`${day} ${hour}:00 — Avg Intensity: ${avgVal.toFixed(1)} (${getIntensityLabel(avgVal)}) [${count} messages]`}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        backgroundColor: getColor(avgVal),
                        borderRadius: '4px',
                        transition: 'transform 0.15s ease',
                        cursor: 'pointer',
                      }}
                      className="hover:scale-125 hover:ring-2 hover:ring-rose-300"
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend + peak indicator */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-sage-400 font-medium">None</span>
          <div className="flex gap-1">
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f1f0ec' }} title="No data" />
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#a7f3d0' }} title="Low (1.0 - 1.5)" />
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fef08a' }} title="Medium (1.5 - 2.2)" />
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fca5a5' }} title="High (2.2+)" />
          </div>
          <span className="text-[10px] text-sage-400 font-medium">High</span>
        </div>
        {peakIntensity > 0 && (
          <span className="text-xs text-sage-500">
            Peak Severity: <span className="font-medium text-sage-700">
              {DAYS[peakDay]} {peakHour}:00
            </span> ({peakIntensity.toFixed(1)})
          </span>
        )}
      </div>
    </div>
  )
}
