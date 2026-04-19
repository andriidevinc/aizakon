import { NextRequest, NextResponse } from 'next/server'
import { supabase, getAdminClient } from '@/lib/supabase'
import { analyzeBill } from '@/lib/claude'
import type { BillWithRelations } from '@/types'

export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const billId = parseInt(id)

  if (isNaN(billId)) {
    return NextResponse.json({ error: 'Невірний ID' }, { status: 400 })
  }

  const { data: bill, error } = await supabase
    .from('bills')
    .select(`
      *,
      bill_initiators (*),
      bill_passings (*)
    `)
    .eq('id', billId)
    .single()

  if (error || !bill) {
    return NextResponse.json({ error: 'Законопроект не знайдено' }, { status: 404 })
  }

  // Якщо аналіз вже є — повернути кешований
  if (bill.ai_analyzed_at && bill.ai_summary) {
    return NextResponse.json({
      summary: bill.ai_summary,
      impact: bill.ai_impact,
      keywords: bill.ai_keywords,
      pdfAvailable: bill.ai_pdf_available ?? true,
      cached: true,
    })
  }

  try {
    const analysis = await analyzeBill(bill as BillWithRelations)

    const adminClient = getAdminClient()
    await adminClient.from('bills').update({
      ai_summary: analysis.summary,
      ai_impact: analysis.impact,
      ai_keywords: analysis.keywords,
      ai_pdf_available: analysis.pdfAvailable,
      ai_analyzed_at: new Date().toISOString(),
    }).eq('id', billId)

    return NextResponse.json({ ...analysis, cached: false })
  } catch (err) {
    console.error(`Помилка аналізу законопроекту ${billId}:`, err)
    return NextResponse.json(
      { error: 'Помилка AI аналізу. Спробуйте пізніше.' },
      { status: 500 }
    )
  }
}
