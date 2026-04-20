import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default async function FactionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const factionName = decodeURIComponent(name)

  const { data: deputies } = await supabase
    .from('deputies')
    .select('id, person_id, surname, firstname, patronymic, photo_url, faction')
    .eq('faction', factionName)
    .order('surname')

  if (!deputies?.length) notFound()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/deputies"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Депутати
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{factionName}</h1>
        <p className="text-sm text-gray-500 mt-1">{deputies.length} депутатів</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {deputies.map(d => (
          <Link
            key={d.id}
            href={`/deputy/${d.person_id}`}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
              {d.photo_url
                ? <img src={d.photo_url} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-500">{d.surname?.[0]}</span>
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {[d.surname, d.firstname, d.patronymic].filter(Boolean).join(' ')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
