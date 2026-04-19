'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-browser'

export default function HeaderAuth({ user }: { user: User | null }) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Увійти
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/profile"
        className="text-gray-500 hover:text-gray-900 transition-colors text-xs hidden sm:inline"
      >
        {user.email?.split('@')[0]}
      </Link>
      <button
        onClick={signOut}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Вийти
      </button>
    </div>
  )
}
