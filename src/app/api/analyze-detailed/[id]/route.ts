import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, supabase } from '@/lib/supabase'
import { analyzeDetailed } from '@/lib/claude'
import type { BillWithRelations } from '@/types'

export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const billId = parseInt(id)
  if (isNaN(billId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const { data: bill, error } = await supabase
    .from('bills')
    .select('*, bill_initiators(*), bill_passings(*)')
    .eq('id', billId)
    .single()

  if (error || !bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  const b = bill as BillWithRelations & { ai_detailed?: string }

  // Повертаємо кеш якщо є
  if (b.ai_detailed) return NextResponse.json({ detailed: b.ai_detailed })

  // Генеруємо детальний аналіз
  const detailed = await analyzeDetailed(b)

  // Зберігаємо в базу
  const admin = getAdminClient()
  await admin.from('bills').update({ ai_detailed: detailed }).eq('id', billId)

  return NextResponse.json({ detailed })
}
