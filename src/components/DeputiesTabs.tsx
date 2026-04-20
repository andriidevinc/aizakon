'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Deputy {
  id: number
  person_id: number | null
  surname: string | null
  firstname: string | null
  patronymic: string | null
  faction: string | null
  photo_url: string | null
}

export default function DeputiesTabs({ deputies }: { deputies: Deputy[] }) {
  const [search, setSearch] = useState('')

  const filtered = deputies.filter(d => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      d.surname?.toLowerCase().includes(q) ||
      d.firstname?.toLowerCase().includes(q) ||
      d.patronymic?.toLowerCase().includes(q)
    )
  })

  // Групуємо по першій букві
  const grouped: Record<string, Deputy[]> = {}
  for (const d of filtered) {
    const letter = d.surname?.[0]?.toUpperCase() ?? '?'
    if (!grouped[letter]) grouped[letter] = []
    grouped[letter]!.push(d)
  }
  const letters = Object.keys(grouped).sort()

  return (
    <div>
      {/* Пошук */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Пошук депутата..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Навігація по буквах */}
      {!search && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {letters.map(l => (
            <a
              key={l}
              href={`#dl-${l}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-blue-100 hover:text-blue-700 transition-colors"
            >
              {l}
            </a>
          ))}
        </div>
      )}

      {/* Список */}
      <div className="space-y-6">
        {letters.map(letter => (
          <div key={letter} id={`dl-${letter}`}>
            {!search && (
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100 pb-1">
                {letter}
              </h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {grouped[letter]?.map(d => (
                <Link
                  key={d.id}
                  href={`/deputy/${d.person_id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                    {d.photo_url
                      ? <img src={d.photo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-500">{d.surname?.[0]}</span>
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

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">Нічого не знайдено</p>
      )}
    </div>
  )
}
