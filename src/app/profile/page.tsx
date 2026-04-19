'use client'

import { useState, useEffect } from 'react'
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

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')
      const { data } = await supabase.from('user_profiles').select('tags').eq('id', user.id).single()
      setSelected(data?.tags ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_profiles').upsert({ id: user.id, email: user.email, tags: selected })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-400 text-sm">Завантаження...</div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Профіль</h1>
      <p className="text-sm text-gray-400 mb-8">{email}</p>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Що вас стосується</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
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

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
      >
        {saving ? 'Збереження...' : saved ? 'Збережено ✓' : 'Зберегти зміни'}
      </button>
    </div>
  )
}
