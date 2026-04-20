import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default async function DeputiesPage() {
  const { data: deputies } = await supabase
    .from('deputies')
    .select('id, person_id, surname, firstname, patronymic, faction, convocation, photo_url')
    .order('surname')

  const grouped: Record<string, typeof deputies> = {}
  for (const d of deputies ?? []) {
    const letter = d.surname?.[0]?.toUpperCase() ?? '?'
    if (!grouped[letter]) grouped[letter] = []
    grouped[letter]!.push(d)
  }
  const letters = Object.keys(grouped).sort()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Депутати</h1>
        <p className="text-sm text-gray-500 mt-1">
          {deputies?.length ?? 0} народних депутатів — які закони подавали і за що голосували
        </p>
      </div>

      {/* Навігація по буквах */}
      <div className="flex flex-wrap gap-1.5 mb-8">
        {letters.map(l => (
          <a
            key={l}
            href={`#letter-${l}`}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-blue-100 hover:text-blue-700 transition-colors"
          >
            {l}
          </a>
        ))}
      </div>

      {/* Список по буквах */}
      <div className="space-y-8">
        {letters.map(letter => (
          <div key={letter} id={`letter-${letter}`}>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
              {letter}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {grouped[letter]?.map(d => (
                <Link
                  key={d.id}
                  href={`/deputy/${d.person_id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {(d as any).photo_url
                      ? <img src={(d as any).photo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-sm font-semibold text-gray-500">{d.surname?.[0]}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {[d.surname, d.firstname, d.patronymic].filter(Boolean).join(' ')}
                    </p>
                    {d.faction && (
                      <p className="text-xs text-gray-400 truncate">{d.faction}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
