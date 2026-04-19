'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const TAGS = [
  { id: 'fop', label: 'Я підприємець / ФОП', icon: '💼' },
  { id: 'employee', label: 'Найманий працівник', icon: '👔' },
  { id: 'parent', label: 'Є діти', icon: '👨‍👩‍👧' },
  { id: 'veteran', label: 'Служу або маю рідних на службі', icon: '🎖️' },
  { id: 'pensioner', label: 'Пенсіонер або особа з інвалідністю', icon: '🏥' },
  { id: 'property', label: 'Маю нерухомість або авто', icon: '🏠' },
  { id: 'public', label: 'Медик / вчитель / держслужбовець', icon: '🏛️' },
  { id: 'business', label: 'Великий бізнес / інвестиції', icon: '📈' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      tags: selected,
    })

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Що вас стосується найбільше?</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Оберіть щоб отримувати сповіщення про релевантні закони.<br/>
            Можна змінити пізніше в профілі.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {TAGS.map(tag => (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                selected.includes(tag.id)
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{tag.icon}</span>
              <span className="text-sm font-medium">{tag.label}</span>
              {selected.includes(tag.id) && (
                <svg className="ml-auto w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { router.push('/'); router.refresh() }}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Пропустити
          </button>
          <button
            onClick={handleSave}
            disabled={loading || selected.length === 0}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Збереження...' : `Зберегти (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
