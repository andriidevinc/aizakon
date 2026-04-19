import { supabase } from '@/lib/supabase'
import BillCard from '@/components/BillCard'
import type { Bill } from '@/types'

const PAGE_SIZE = 20

interface SearchParams {
  page?: string
  status?: string
  search?: string
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const statusFilter = params.status ?? 'all'
  const searchQuery = params.search ?? ''
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('bills')
    .select(
      `id, number, title, type, url,
       registration_date, session, subject, rubric,
       current_phase_title, current_phase_date,
       act_number, is_urgent, is_euro,
       ai_summary, ai_keywords,
       bill_initiators (surname, firstname, initiator_type)`,
      { count: 'exact' }
    )
    .order('registration_date', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (statusFilter === 'adopted') {
    query = query.or('current_phase_title.eq.Закон підписано,current_phase_title.eq.Набрав чинності')
  } else if (statusFilter === 'in_progress') {
    query = query.not('current_phase_title', 'in', '("Закон підписано","Набрав чинності","Відхилено","Відкликано")')
  } else if (statusFilter === 'rejected') {
    query = query.eq('current_phase_title', 'Відхилено')
  }

  if (searchQuery.length >= 3) {
    query = query.ilike('title', `%${searchQuery}%`)
  }

  const { data: bills, count } = await query
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Законопроекти Верховної Ради
        </h1>
        <p className="text-gray-500 text-sm">
          З 24 лютого 2022 · Пояснення AI · Хто вніс · Статус розгляду
        </p>
      </div>

      {/* Пошук і фільтри */}
      <form method="GET" className="mb-6 space-y-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            name="search"
            defaultValue={searchQuery}
            placeholder="Пошук за назвою закону..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'Всі' },
            { value: 'adopted', label: 'Прийняті' },
            { value: 'in_progress', label: 'На розгляді' },
            { value: 'rejected', label: 'Відхилені' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="submit"
              name="status"
              value={value}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {/* Кількість */}
      {count !== null && count > 0 && (
        <p className="text-sm text-gray-400 mb-4">
          {count.toLocaleString('uk-UA')} законопроектів
        </p>
      )}

      {/* Список */}
      {!bills?.length ? (
        <EmptyState searchQuery={searchQuery} totalCount={count ?? 0} />
      ) : (
        <>
          <div className="grid gap-3">
            {(bills as unknown as (Bill & {
              bill_initiators: Array<{ surname: string | null; firstname: string | null; initiator_type: string | null }>
            })[]).map(bill => (
              <BillCard key={bill.id} bill={bill} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} searchQuery={searchQuery} statusFilter={statusFilter} />
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ searchQuery, totalCount }: { searchQuery: string; totalCount: number }) {
  if (totalCount === 0 && !searchQuery) {
    return (
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm">
        <h3 className="font-semibold text-amber-900 mb-2">База даних порожня</h3>
        <p className="text-amber-700 mb-3">
          Для завантаження даних потрібно запустити синхронізацію з Верховною Радою.
          Зверніться до адміністратора.
        </p>
      </div>
    )
  }
  return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-lg mb-2">
        {searchQuery ? 'Нічого не знайдено' : 'Законопроектів не знайдено'}
      </p>
      {searchQuery && <p className="text-sm">Спробуйте інший запит</p>}
    </div>
  )
}

function Pagination({
  page, totalPages, searchQuery, statusFilter,
}: {
  page: number; totalPages: number; searchQuery: string; statusFilter: string
}) {
  const url = (p: number) => {
    const q = new URLSearchParams()
    if (p > 1) q.set('page', String(p))
    if (searchQuery) q.set('search', searchQuery)
    if (statusFilter !== 'all') q.set('status', statusFilter)
    const s = q.toString()
    return s ? `/?${s}` : '/'
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {page > 1 && (
        <a href={url(page - 1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          ← Назад
        </a>
      )}
      <span className="text-sm text-gray-500">{page} / {totalPages}</span>
      {page < totalPages && (
        <a href={url(page + 1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Далі →
        </a>
      )}
    </div>
  )
}
