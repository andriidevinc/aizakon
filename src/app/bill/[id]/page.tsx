import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import AIAnalysis from '@/components/AIAnalysis'
import type { BillWithRelations } from '@/types'

function formatDate(d: string | null, withTime = false) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function getInitiatorName(ini: BillWithRelations['bill_initiators'][0]): string {
  if (ini.initiator_type === 'mp' && ini.surname) {
    return [ini.surname, ini.firstname, ini.patronymic].filter(Boolean).join(' ')
  }
  if (ini.initiator_type === 'inner') {
    const name = ini.department ?? ini.organization ?? ''
    const person = ini.surname ? ` (${ini.surname} ${ini.firstname ?? ''})`.trim() : ''
    return name + person
  }
  if (ini.initiator_type === 'outter') {
    return ini.organization ?? ini.department ?? '—'
  }
  return '—'
}

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const billId = parseInt(id)
  if (isNaN(billId)) notFound()

  const { data: bill, error } = await supabase
    .from('bills')
    .select(`
      *,
      bill_initiators (*),
      bill_passings (*)
    `)
    .eq('id', billId)
    .single()

  if (error || !bill) notFound()

  const b = bill as BillWithRelations

  // Сортуємо проходження від найновішого
  const passings = [...(b.bill_passings ?? [])].sort(
    (a, b) => new Date(b.passing_date ?? 0).getTime() - new Date(a.passing_date ?? 0).getTime()
  )

  // Статус: чи прийнятий закон остаточно
  const isAdopted = b.current_phase_title?.toLowerCase().includes('підписано') ||
    b.current_phase_title?.toLowerCase().includes('прийнято')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

      {/* Навігація назад */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Усі законопроекти
      </Link>

      {/* Заголовок */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge phase={b.current_phase_title} />
          {b.is_urgent && (
            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
              Невідкладний
            </span>
          )}
          {b.is_euro && (
            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
              Євроінтеграція
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
          {b.title}
        </h1>
      </div>

      {/* Мета-інформація */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <MetaItem label="Номер" value={b.number ? `№${b.number}` : '—'} />
        <MetaItem label="Зареєстровано" value={formatDate(b.registration_date)} />
        <MetaItem label="Сесія" value={b.session ?? '—'} />
        <MetaItem label="Категорія" value={b.rubric ?? '—'} />
        <MetaItem label="Ким внесено" value={b.subject ?? '—'} />
        {b.act_number && (
          <MetaItem label="Закон №" value={b.act_number} />
        )}
      </div>

      {/* AI Аналіз */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-medium">AI</span>
          Пояснення
        </h2>
        <AIAnalysis
          billId={b.id}
          initialSummary={b.ai_summary}
          initialImpact={b.ai_impact}
          initialKeywords={b.ai_keywords}
          initialDetailed={(b as unknown as Record<string, unknown>).ai_detailed as string | null}
        />
      </section>

      {/* Ініціатори */}
      {b.bill_initiators?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Ініціатори законопроекту
          </h2>
          <div className="space-y-2">
            {b.bill_initiators.map((ini) => (
              <div
                key={ini.id}
                className="flex items-center gap-3 py-2.5 px-4 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{getInitiatorName(ini)}</p>
                  {ini.initiator_type === 'mp' && ini.convocation && (
                    <p className="text-xs text-gray-400">{ini.convocation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Хронологія проходження */}
      {passings.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Хронологія розгляду
          </h2>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-1">
              {passings.map((p, i) => (
                <div key={p.id} className="flex gap-4 pl-8 relative">
                  <div className={`absolute left-1.5 top-3 w-3 h-3 rounded-full border-2 border-white ${
                    i === 0 ? 'bg-blue-500' : 'bg-gray-300'
                  }`} />
                  <div className="flex-1 pb-3">
                    <p className="text-sm font-medium text-gray-800">{p.title}</p>
                    <p className="text-xs text-gray-400">{formatDate(p.passing_date, true)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Посилання на офіційну сторінку */}
      <div className="border-t border-gray-100 pt-6 flex flex-wrap gap-3">
        {b.url && (
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Офіційна сторінка ВРУ ↗
          </a>
        )}
        {isAdopted && b.act_number && (
          <a
            href={`https://zakon.rada.gov.ua/laws/show/${b.act_number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Текст закону ↗
          </a>
        )}
      </div>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}
