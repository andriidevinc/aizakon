import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import type { BillWithRelations } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface AIAnalysis {
  summary: string
  impact: string
  keywords: string[]
}

// Знаходить PDF або docx "Проект Закону" зі сторінки картки
function findBillDocuments(html: string): { pdfUrl: string | null; docxUrl: string | null; noteUrl: string | null } {
  let pdfUrl: string | null = null
  let docxUrl: string | null = null
  let noteUrl: string | null = null

  // Шукаємо "Проект Закону" — PDF
  const pdfMatch = html.match(/href="([^"]+)"[^>]*data-ext="\.pdf"[^>]*data-file-name="[^"]*Проект Закону[^"]*"/i)
    ?? html.match(/data-file-name="[^"]*Проект Закону[^"]*"[^>]*href="([^"]+)"[^>]*data-ext="\.pdf"/i)
  if (pdfMatch) pdfUrl = `https://itd.rada.gov.ua${pdfMatch[1]}`

  // Шукаємо "Проект Закону" — docx
  const docxMatch = html.match(/href="([^"]+)"[^>]*data-ext="\.docx"[^>]*data-file-name="[^"]*Проект Закону[^"]*"/i)
    ?? html.match(/data-file-name="[^"]*Проект Закону[^"]*"[^>]*href="([^"]+)"[^>]*data-ext="\.docx"/i)
  if (docxMatch) docxUrl = `https://itd.rada.gov.ua${docxMatch[1]}`

  // Пояснювальна записка — docx
  const noteMatches = [...html.matchAll(/href="([^"]+)"[^>]*data-file-name="([^"]*Пояснювальна[^"]*)"/gi)]
  if (noteMatches.length > 0) noteUrl = `https://itd.rada.gov.ua${noteMatches[0][1]}`

  return { pdfUrl, docxUrl, noteUrl }
}

// Завантажує PDF і повертає як base64
async function fetchPdfBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return null
    const buffer = await r.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  } catch {
    return null
  }
}

// Завантажує і парсить docx у plain text
async function fetchDocxText(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return ''
    const buffer = await r.arrayBuffer()
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value.replace(/\s+/g, ' ').trim().slice(0, 6000)
  } catch {
    return ''
  }
}

// Завантажує картку і знаходить посилання на документи
async function fetchCardData(cardUrl: string) {
  try {
    const r = await fetch(cardUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await r.text()
    const docs = findBillDocuments(html)

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'")
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    const start = stripped.indexOf('Номер, дата реєстрації')
    const cardText = (start > 0 ? stripped.slice(start) : stripped).slice(0, 2000)

    return { cardText, ...docs }
  } catch {
    return { cardText: '', pdfUrl: null, docxUrl: null, noteUrl: null }
  }
}

// ── КОРОТКИЙ АНАЛІЗ (для картки законопроекту) ──────────────────────────────

export async function analyzeBill(bill: BillWithRelations): Promise<AIAnalysis> {
  const initiatorsList = bill.bill_initiators.map(i => {
    if (i.initiator_type === 'mp' && i.surname) return `${i.surname} ${i.firstname ?? ''} ${i.patronymic ?? ''}`.trim()
    if (i.initiator_type === 'inner' && i.department) return i.department
    if (i.initiator_type === 'outter' && i.organization) return i.organization
    return null
  }).filter(Boolean).join(', ')

  const passingsHistory = bill.bill_passings
    .sort((a, b) => new Date(a.passing_date ?? 0).getTime() - new Date(b.passing_date ?? 0).getTime())
    .map(p => `• ${p.title}`).join('\n')

  // Короткий аналіз: лише метадані з картки (без PDF — щоб вкластись у 10с ліміт Vercel Hobby)
  let cardText = ''
  if (bill.url?.includes('itd.rada.gov.ua')) {
    const { cardText: ct } = await fetchCardData(bill.url)
    cardText = ct
  }

  const contextBlock = cardText ? `\nКОНТЕКСТ З ОФІЦІЙНОЇ КАРТКИ:\n${cardText}` : ''
  const textBlock = ''

  const textPrompt = `Ти — аналітик законодавства України. Пояснюєш законопроекти коротко і конкретно для звичайних людей.

ДАНІ:
Назва: ${bill.title}
Номер: ${bill.number ?? '—'} | Дата: ${bill.registration_date ? new Date(bill.registration_date).toLocaleDateString('uk-UA') : '—'}
Категорія: ${bill.rubric ?? '—'} | Ініціатор: ${bill.subject ?? '—'}${initiatorsList ? ` (${initiatorsList})` : ''}
Статус: ${bill.current_phase_title ?? '—'}
${passingsHistory ? `Проходження:\n${passingsHistory}` : ''}${contextBlock}${textBlock}

ПРАВИЛА:
— summary: 1-2 речення. Що конкретно змінює. Починай з дієслова.
— impact: 1-2 речення. Хто відчує і як. Якщо технічний закон — "Безпосередньо на громадян не впливає. Стосується [сфери]."
— keywords: 3 найточніші слова

JSON без markdown: {"summary":"...","impact":"...","keywords":["...","...","..."]}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: textPrompt }],
  })
  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  const jsonText = content.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(jsonText)
  return { summary: parsed.summary, impact: parsed.impact, keywords: parsed.keywords ?? [] }
}

// ── ДЕТАЛЬНИЙ АНАЛІЗ (по запиту) ────────────────────────────────────────────

export async function analyzeDetailed(bill: BillWithRelations): Promise<string> {
  let pdfBase64: string | null = null
  let billText = ''
  let cardText = ''

  if (bill.url?.includes('itd.rada.gov.ua')) {
    const { cardText: ct, pdfUrl, docxUrl, noteUrl } = await fetchCardData(bill.url)
    cardText = ct
    if (pdfUrl) pdfBase64 = await fetchPdfBase64(pdfUrl)
    if (!pdfBase64 && docxUrl) billText = await fetchDocxText(docxUrl)
    if (!pdfBase64 && !billText && noteUrl) billText = await fetchDocxText(noteUrl)
  }

  const contextBlock = cardText ? `\nКОНТЕКСТ:\n${cardText}` : ''
  const textBlock = billText ? `\nТЕКСТ ДОКУМЕНТУ:\n${billText}` : ''

  const detailedPrompt = `Ти — незалежний аналітик законодавства. Твоя місія — знайти що насправді написано в законі, незалежно від того що влада декларує публічно.

ЗАКОНОПРОЕКТ: ${bill.title}
Номер: ${bill.number ?? '—'} | Дата: ${bill.registration_date ? new Date(bill.registration_date).toLocaleDateString('uk-UA') : '—'}
Ініціатор: ${bill.subject ?? '—'} | Статус: ${bill.current_phase_title ?? '—'}${contextBlock}${textBlock}

${pdfBase64 ? 'Повний текст законопроекту додано як PDF документ вище. Читай БЕЗПОСЕРЕДНЬО З НЬОГО, не з пояснювальної записки авторів.' : ''}

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

  const message = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 4096, messages })
  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  return content.text.trim()
}
