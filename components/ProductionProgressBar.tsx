'use client'

interface ProductionProgressBarProps {
  producedQuantity: number
  requiredQuantity: number
  height?: number
  showLabel?: boolean
  showPercent?: boolean
  trackColor?: string
  fillColor?: string
}

export default function ProductionProgressBar({
  producedQuantity,
  requiredQuantity,
  height = 8,
  showLabel = false,
  showPercent = false,
  trackColor = '#E7EDF8',
  fillColor = '#1D2235',
}: ProductionProgressBarProps) {
  const required = Math.max(0, Math.floor(requiredQuantity || 0))
  const produced = Math.max(0, Math.floor(producedQuantity || 0))
  const percent = required === 0 ? 100 : Math.max(0, Math.min(100, Math.round((produced / required) * 100)))

  const computedFillColor = percent >= 100 ? '#1D7A72' : fillColor

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            fontSize: '13px',
            color: '#3D4460',
            fontWeight: 600,
          }}
        >
          <span>
            {produced} / {required}
          </span>
          {showPercent && <span style={{ color: '#6B7494', fontWeight: 500 }}>{percent}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso de produção: ${produced} de ${required} unidades`}
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: trackColor,
          borderRadius: `${height}px`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            backgroundColor: computedFillColor,
            transition: 'width 200ms ease-out',
          }}
        />
      </div>
    </div>
  )
}
