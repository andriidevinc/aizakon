import { getBillStatus, STATUS_LABELS, STATUS_COLORS } from '@/types'

interface Props {
  phase: string | null
  small?: boolean
}

export default function StatusBadge({ phase, small = false }: Props) {
  const status = getBillStatus(phase)
  const label = STATUS_LABELS[status]
  const color = STATUS_COLORS[status]

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${color} ${
      small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    }`}>
      {label}
    </span>
  )
}
