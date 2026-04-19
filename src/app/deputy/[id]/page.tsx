import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'

export default async function DeputyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const personId = parseInt(id)
  if (isNaN(personId)) notFound()

  const { data: deputy } = await supabase
    .from('deputies')
    .select('*')
    .eq('person_id', personId)
    .single()

  if (!deputy) notFound()

  // Законопроекти цього депутата
  const { data: initiatorRows } = await supabase
    .from('bill_initiators')
    .select('bill_id')
    .eq('person_id', personId)

  const billIds = initiatorRows?.map(r => r.bill_id) ?? []

  const { data: bills } = billIds.length > 0
    ? await supabase
        .from('bills')
        .select('id, number, title, current_phase_title, registration_date, rubric')
        .in('id', billIds)
        .order('registration_date', { ascending: false })
        .limit(50)
    : { data: [] }

  const fullName = [deputy.surname, deputy.firstname, deputy.patronymic].filter(Boolean).join(' ')

  // Статистика по статусах
  const adopted = bills?.filter(b => b.current_phase_title?.toLowerCase().includes('підписано') || b.current_phase_title?.toLowerCase().includes('прийнято')).length ?? 0

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/deputies"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Усі депутати
      </Link>

      {/* Профіль */}
      <div className="flex items-center gap-5 mb-8">
        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500 flex-shrink-0">
          {deputy.surname?.[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
          {deputy.faction && (
            <p className="text-sm text-gray-500 mt-0.5">{deputy.faction}</p>
          )}
          {deputy.convocation && (
            <p className="text-xs text-gray-400 mt-0.5">{deputy.convocation}</p>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-2xl font-bold text-gray-900">{bills?.length ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Законопроектів подано</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <p className="text-2xl font-bold text-green-700">{adopted}</p>
          <p className="text-xs text-gray-500 mt-0.5">Прийнято</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-2xl font-bold text-blue-700">
            {bills?.length ? Math.round((adopted / bills.length) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Успішність</p>
        </div>
      </div>

      {/* Список законопроектів */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Законопроекти</h2>
        {!bills?.length ? (
          <p className="text-sm text-gray-400">Немає даних</p>
        ) : (
          <div className="space-y-2">
            {bills.map(bill => (
              <Link
                key={bill.id}
                href={`/bill/${bill.id}`}
                className="block px-4 py-3.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{bill.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {bill.number && (
                        <span className="text-xs text-gray-400">№{bill.number}</span>
                      )}
                      {bill.registration_date && (
                        <span className="text-xs text-gray-400">
                          {new Date(bill.registration_date).toLocaleDateString('uk-UA')}
                        </span>
                      )}
                      {bill.rubric && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{bill.rubric}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge phase={bill.current_phase_title} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
