import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Створюємо профіль якщо його ще немає
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        email: data.user.email,
      }, { onConflict: 'id', ignoreDuplicates: true })

      // Перевіряємо чи є теги — якщо ні, відправляємо на онбординг
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tags')
        .eq('id', data.user.id)
        .single()

      if (!profile?.tags?.length) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
