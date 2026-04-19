'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message === 'User already registered'
          ? 'Цей email вже зареєстрований. Спробуйте увійти.'
          : 'Помилка реєстрації. Перевірте email і пароль.')
      } else {
        setSuccess('Перевірте пошту — ми надіслали листа для підтвердження.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Невірний email або пароль.')
      } else {
        router.push('/')
        router.refresh()
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="font-bold text-xl tracking-tight text-gray-900">
              AI<span className="text-blue-600">Zakon</span>
            </span>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            {mode === 'login' ? 'Увійти в акаунт' : 'Створити акаунт'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login'
              ? 'Отримуйте персональні сповіщення про релевантні закони'
              : 'Безкоштовно. Без спаму.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Мінімум 6 символів"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 px-4 py-2.5 rounded-xl">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Завантаження...' : mode === 'login' ? 'Увійти' : 'Зареєструватись'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {mode === 'login' ? 'Ще немає акаунту? ' : 'Вже є акаунт? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setSuccess(null) }}
            className="text-blue-600 hover:underline font-medium"
          >
            {mode === 'login' ? 'Зареєструватись' : 'Увійти'}
          </button>
        </p>
      </div>
    </div>
  )
}
