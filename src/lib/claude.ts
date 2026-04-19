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

// Знаходить посилання на Пояснювальну записку (docx) зі сторінки картки
function findExplanatoryNoteUrl(html: string): string | null {
  // Шукаємо посилання з data-ext=".docx" де назва файлу містить "Пояснювальна"
  const matches = [...html.matchAll(/href="([^"]+)"[^>]*data-file-name="([^"]*Пояснювальна[^"]*)"/gi)]
  if (matches.length > 0) {
    return `https://itd.rada.gov.ua${matches[0][1]}`
  }
  // Fallback: будь-який docx файл з "Пояснювальна" в атрибутах
  const fallback = html.match(/data-id="(\d+)"[^>]*data-ext="\.docx"[^>]*data-file-name="[^"]*Пояснювальна/i)
  if (fallback) {
    return `https://itd.rada.gov.ua/billinfo/Bills/pubFile/${fallback[1]}`
  }
  return null
}

// Завантажує і парсить docx, повертає plain text
async function fetchDocxText(docxUrl: string): Promise<string> {
  try {
    const r = await fetch(docxUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return ''
    const buffer = await r.arrayBuffer()
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value.replace(/\s+/g, ' ').trim().slice(0, 5000)
  } catch {
    return ''
  }
}

// Завантажує метадані з картки законопроекту на itd.rada.gov.ua
async function fetchBillCardText(cardUrl: string): Promise<{ cardText: string; docxUrl: string | null }> {
  try {
    const r = await fetch(cardUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await r.text()

    const docxUrl = findExplanatoryNoteUrl(html)

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'")
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const start = stripped.indexOf('Номер, дата реєстрації')
    const cardText = (start > 0 ? stripped.slice(start) : stripped).slice(0, 3000)

    return { cardText, docxUrl }
  } catch {
    return { cardText: '', docxUrl: null }
  }
}

export async function analyzeBill(bill: BillWithRelations): Promise<AIAnalysis> {
  const initiatorsList = bill.bill_initiators.map(i => {
    if (i.initiator_type === 'mp' && i.surname) {
      return `${i.surname} ${i.firstname ?? ''} ${i.patronymic ?? ''}`.trim()
    }
    if (i.initiator_type === 'inner' && i.department) return i.department
    if (i.initiator_type === 'outter' && i.organization) return i.organization
    return null
  }).filter(Boolean).join(', ')

  const passingsHistory = bill.bill_passings
    .sort((a, b) => new Date(a.passing_date ?? 0).getTime() - new Date(b.passing_date ?? 0).getTime())
    .map(p => `• ${p.title}`)
    .join('\n')

  // Завантажуємо дані з офіційної сторінки
  let cardText = ''
  let explanatoryNote = ''

  if (bill.url?.includes('itd.rada.gov.ua')) {
    const { cardText: ct, docxUrl } = await fetchBillCardText(bill.url)
    cardText = ct

    // Якщо є Пояснювальна записка — завантажуємо і читаємо її
    if (docxUrl) {
      explanatoryNote = await fetchDocxText(docxUrl)
    }
  }

  const prompt = `Ти — аналітик законодавства України. Пояснюєш законопроекти коротко і конкретно для звичайних людей.

ОСНОВНІ ДАНІ:
Назва: ${bill.title}
Номер: ${bill.number ?? '—'}
Дата: ${bill.registration_date ? new Date(bill.registration_date).toLocaleDateString('uk-UA') : '—'}
Категорія: ${bill.rubric ?? '—'}
Ініціатор: ${bill.subject ?? '—'}${initiatorsList ? ` (${initiatorsList})` : ''}
Статус: ${bill.current_phase_title ?? '—'}
${passingsHistory ? `Проходження:\n${passingsHistory}` : ''}
${cardText ? `\nДАНІ З ОФІЦІЙНОЇ КАРТКИ:\n${cardText}` : ''}
${explanatoryNote ? `\nПОЯСНЮВАЛЬНА ЗАПИСКА (офіційний текст авторів законопроекту):\n${explanatoryNote}` : ''}

ПРАВИЛА відповіді:
— summary: 1-2 речення. Що конкретно змінює цей закон. Спирайся на пояснювальну записку якщо вона є. Починай з дієслова: "Вносить зміни до...", "Встановлює...", "Ратифікує...".
— impact: 1-2 речення. Хто конкретно відчує зміни і як. Якщо закон суто технічний або ратифікація — пиши: "Безпосередньо на громадян не впливає. Стосується [сфери]."
— keywords: 3 найточніші слова (без загальних слів типу "закон", "Україна")

JSON без markdown:
{
  "summary": "...",
  "impact": "...",
  "keywords": ["...", "...", "..."]
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  const raw = content.text.trim()
  const jsonText = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const parsed = JSON.parse(jsonText)
  return {
    summary: parsed.summary,
    impact: parsed.impact,
    keywords: parsed.keywords ?? [],
  }
}
