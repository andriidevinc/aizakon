import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DeputiesTabs from '@/components/DeputiesTabs'

// Основні фракції (в порядку розміру)
const MAIN_FACTIONS = [
  'СЛУГА НАРОДУ',
  'ЄВРОПЕЙСЬКА СОЛІДАРНІСТЬ',
  'Всеукраїнське об\'єднання "Батьківщина"',
  'ГОЛОС',
  'Група "Платформа за життя та мир"',
  'Група "ДОВІРА"',
  'Група "Партія "За майбутнє"',
  'Група "Відновлення України"',
  'Позафракційні',
]

export default async function DeputiesPage() {
  const { data: deputies } = await supabase
    .from('deputies')
    .select('id, person_id, surname, firstname, patronymic, faction, photo_url')
    .order('surname')

  const all = deputies ?? []

  // Рахуємо кількість по фракціях
  const factionCounts: Record<string, number> = {}
  for (const d of all) {
    const f = d.faction ?? 'Інші'
    factionCounts[f] = (factionCounts[f] ?? 0) + 1
  }

  // Топ фракції + решта
  const factions = MAIN_FACTIONS.filter(f => factionCounts[f])
    .map(f => ({ name: f, count: factionCounts[f] ?? 0 }))

  // Ініціатори законів (не депутати)
  const { data: initiators } = await supabase
    .from('bills')
    .select('subject')
    .not('subject', 'is', null)
    .not('subject', 'like', 'Народн%')
    .not('subject', 'like', 'народн%')

  const initiatorCounts: Record<string, number> = {}
  for (const b of initiators ?? []) {
    if (b.subject) initiatorCounts[b.subject] = (initiatorCounts[b.subject] ?? 0) + 1
  }
  const topInitiators = Object.entries(initiatorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Депутати та ініціатори законів</h1>
        <p className="text-sm text-gray-500 mt-1">
          {all.length} народних депутатів IX скликання + державні органи
        </p>
      </div>

      {/* Хто подає закони */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Основні ініціатори законів</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {topInitiators.map(([name, count]) => (
            <Link
              key={name}
              href={`/initiator/${encodeURIComponent(name)}`}
              className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50 transition-all"
            >
              <p className="text-sm font-medium text-gray-900 leading-snug">{name}</p>
              <p className="text-xs text-gray-400 mt-1">{count} законопроектів</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Фракції */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Фракції та групи</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {factions.map(f => (
            <Link
              key={f.name}
              href={`/faction/${encodeURIComponent(f.name)}`}
              className="flex items-center justify-between px-4 py-3.5 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all"
            >
              <span className="text-sm font-medium text-gray-900">{f.name}</span>
              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{f.count} деп.</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Всі депутати — з вкладками/пошуком */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Всі депутати</h2>
        <DeputiesTabs deputies={all} />
      </div>
    </div>
  )
}
