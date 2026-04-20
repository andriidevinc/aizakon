import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const maxDuration = 60

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (secret !== process.env.SYNC_SECRET_TOKEN && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Офіційний API Верховної Ради — список депутатів поточного скликання
    const r = await fetch('https://data.rada.gov.ua/open/main/mps', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20000),
    })

    if (!r.ok) throw new Error(`Rada API error: ${r.status}`)
    const data = await r.json()

    const deputies = (data as any[]).map((mp: any) => ({
      person_id: mp.id ?? null,
      surname: mp.family ?? null,
      firstname: mp.name ?? null,
      patronymic: mp.patronymic ?? null,
      faction: mp.factions?.[0]?.name ?? null,
      photo_url: mp.photo ? `https://data.rada.gov.ua${mp.photo}` : null,
      convocation: 'X скл.',
    }))

    const admin = getAdminClient()

    // Upsert по person_id
    const { error } = await admin
      .from('deputies')
      .upsert(deputies, { onConflict: 'person_id', ignoreDuplicates: false })

    if (error) throw error

    return NextResponse.json({ success: true, synced: deputies.length })
  } catch (err) {
    console.error('Sync deputies error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
