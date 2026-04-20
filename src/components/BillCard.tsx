import Link from 'next/link'
import StatusBadge from './StatusBadge'
import { getBillStatus } from '@/types'
import type { Bill } from '@/types'

interface Props {
  bill: Bill & {
    bill_initiators?: Array<{
      surname: string | null
      firstname: string | null
      initiator_type: string | null
    }>
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getInitiatorLabel(bill: Props['bill']): string {
  if (!bill.bill_initiators?.length) return bill.subject ?? ''

  const firstInitiator = bill.bill_initiators[0]
  if (firstInitiator.initiator_type === 'mp' && firstInitiator.surname) {
    const total = bill.bill_initiators.length
    const name = `${firstInitiator.surname} ${firstInitiator.firstname ?? ''}`.trim()
    return total > 1 ? `${name} та ще ${total - 1}` : name
  }

  return bill.subject ?? ''
}

export default function BillCard({ bill }: Props) {
  return (
    <Link href={`/bill/${bill.id}`} className="block group">
      <article className="border border-gray-200 rounded-xl p-5 hover:border-gray-400 hover:shadow-sm transition-all duration-150 bg-white">
        {/* Верхня частина: статус + дата */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <StatusBadge phase={bill.current_phase_title} small />
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
            {bill.is_urgent && (
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                Невідкладний
              </span>
            )}
            {bill.is_euro && (
              <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                Євроінтеграція
              </span>
            )}
            {getBillStatus(bill.current_phase_title) === 'adopted' && bill.current_phase_date ? (
              <span>Прийнято {formatDate(bill.current_phase_date)}</span>
            ) : (
              <span>{formatDate(bill.registration_date)}</span>
            )}
          </div>
        </div>

        {/* Назва */}
        <h2 className="text-gray-900 font-medium text-base leading-snug group-hover:text-black mb-3 line-clamp-3">
          {bill.title}
        </h2>

        {/* AI резюме якщо є */}
        {bill.ai_summary && (
          <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-3">
            {bill.ai_summary}
          </p>
        )}

        {/* Нижня частина: категорія + ініціатор */}
        <div className="flex items-center justify-between gap-3 mt-auto">
          <div className="flex items-center gap-2 flex-wrap">
            {bill.rubric && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {bill.rubric}
              </span>
            )}
            {bill.number && (
              <span className="text-xs text-gray-400">
                №{bill.number}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 text-right flex-shrink-0 max-w-[160px] truncate">
            {getInitiatorLabel(bill)}
          </span>
        </div>
      </article>
    </Link>
  )
}
