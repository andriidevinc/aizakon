import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAdminClient, supabase } from '@/lib/supabase'
import { fetchBillText } from '@/lib/claude'
import type { BillWithRelations } from '@/types'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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
  if (b.ai_detailed) {
    return NextResponse.json({
      detailed: b.ai_detailed,
      pdfAvailable: b.ai_pdf_available ?? true,
    })
  }

  // Завантажуємо текст закону
  const { pdfBase64, billText, cardText, pdfAvailable } = await fetchBillText(b)

  const contextBlock = cardText ? `\nКОНТЕКСТ З ОФІЦІЙНОЇ КАРТКИ:\n${cardText}` : ''
  const textBlock = billText ? `\nТЕКСТ ДОКУМЕНТУ:\n${billText}` : ''
  const sourceNote = pdfBase64
    ? 'Повний текст законопроекту додано як PDF. Читай БЕЗПОСЕРЕДНЬО З НЬОГО.'
    : billText
    ? 'Текст документу додано вище. Аналізуй на його основі.'
    : 'УВАГА: Повний текст недоступний технічно. Аналізуй на основі наявних метаданих.'

  const detailedPrompt = `Ти — незалежний аналітик законодавства. Твоя місія — знайти що насправді написано в законі, незалежно від того що влада декларує публічно.

ЗАКОНОПРОЕКТ: ${b.title}
Номер: ${b.number ?? '—'} | Дата: ${b.registration_date ? new Date(b.registration_date).toLocaleDateString('uk-UA') : '—'}
Ініціатор: ${b.subject ?? '—'} | Статус: ${b.current_phase_title ?? '—'}${contextBlock}${textBlock}

${sourceNote}

Дай розгорнутий аналіз за пунктами (пиши українською, зрозумілою мовою, без юридичного жаргону):

**1. Що насправді змінює цей закон**
Конкретні зміни в законодавстві — що додається, що скасовується, що переписується.

**2. Хто виграє**
Які особи, групи, бізнес або органи влади отримують пряму вигоду.

**3. Хто програє або на кого лягає тягар**
Хто платить, хто отримує нові обмеження або втрачає права.

**4. Підводні камені**
Що написано нечітко, завуальовано або що легко пропустити. Небезпечні формулювання.

**5. Чи відповідає заголовок і назва реальному змісту**
Так / Частково / Ні — і коротко чому.`

  const messages: Anthropic.MessageParam[] = pdfBase64
    ? [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } } as Anthropic.DocumentBlockParam,
          { type: 'text', text: detailedPrompt },
        ],
      }]
    : [{ role: 'user', content: detailedPrompt }]

  // Стрімінг відповіді
  const encoder = new TextEncoder()
  let fullText = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages,
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullText += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        // Зберігаємо після завершення стріму
        const admin = getAdminClient()
        await admin.from('bills').update({
          ai_detailed: fullText,
          ai_pdf_available: pdfAvailable,
        }).eq('id', billId)

      } catch (e) {
        console.error('[analyze-detailed] stream error:', e)
        controller.error(e)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Pdf-Available': String(pdfAvailable),
    },
  })
}
