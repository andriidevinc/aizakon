import Anthropic from '@anthropic-ai/sdk'
import type { BillWithRelations } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface AIAnalysis {
  summary: string
  impact: string
  keywords: string[]
}

// Завантажує текст сторінки законопроекту з itd.rada.gov.ua
async function fetchBillPageText(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await r.text()

    // Видаляємо скрипти, стилі, навігацію
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()

    // Беремо текст починаючи з реєстраційних даних
    const start = stripped.indexOf('Номер, дата реєстрації')
    const text = start > 0 ? stripped.slice(start) : stripped

    // Обмежуємо до 4000 символів
    return text.slice(0, 4000)
  } catch {
    return ''
  }
}

export async function analyzeBill(bill: BillWithRelations): Promise<AIAnalysis> {
  const initiatorsList = bill.bill_initiators.map(i => {
    if (i.initiator_type === 'mp' && i.surname) {
      return `${i.surname} ${i.firstname ?? ''} ${i.patronymic ?? ''}`.trim()
    }
    if (i.initiator_type === 'inner' && i.department) {
      return i.department
    }
    if (i.initiator_type === 'outter' && i.organization) {
      return i.organization
    }
    return null
  }).filter(Boolean).join(', ')

  const passingsHistory = bill.bill_passings
    .sort((a, b) => new Date(a.passing_date ?? 0).getTime() - new Date(b.passing_date ?? 0).getTime())
    .map(p => `• ${p.title}`)
    .join('\n')

  // Завантажуємо повний текст сторінки законопроекту
  const billPageText = bill.url?.includes('itd.rada.gov.ua')
    ? await fetchBillPageText(bill.url)
    : ''

  const prompt = `Ти — аналітик законодавства України. Пояснюєш законопроекти коротко і конкретно для звичайних людей.

ОСНОВНІ ДАНІ:
Назва: ${bill.title}
Номер: ${bill.number ?? '—'}
Дата: ${bill.registration_date ? new Date(bill.registration_date).toLocaleDateString('uk-UA') : '—'}
Категорія: ${bill.rubric ?? '—'}
Ініціатор: ${bill.subject ?? '—'}${initiatorsList ? ` (${initiatorsList})` : ''}
Статус: ${bill.current_phase_title ?? '—'}
${passingsHistory ? `Проходження:\n${passingsHistory}` : ''}
${billPageText ? `\nДОДАТКОВИЙ КОНТЕКСТ З ОФІЦІЙНОЇ СТОРІНКИ:\n${billPageText}` : ''}

ПРАВИЛА відповіді:
— summary: 1-2 речення. Що конкретно змінює цей закон і в якій сфері. Спирайся на реальний текст зі сторінки. Починай з дієслова: "Вносить зміни до...", "Встановлює...", "Ратифікує...".
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
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

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
