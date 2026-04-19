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

  const prompt = `Ти — нейтральний аналітик законодавства України. Твоє завдання — пояснити законопроект звичайним громадянам простою, зрозумілою українською мовою. Будь ТОЧНИМ і НЕЙТРАЛЬНИМ — не виражай жодної думки щодо законопроекту.

ІНФОРМАЦІЯ ПРО ЗАКОНОПРОЕКТ:
Назва: ${bill.title}
Реєстраційний номер: ${bill.number ?? 'невідомо'}
Дата реєстрації: ${bill.registration_date ? new Date(bill.registration_date).toLocaleDateString('uk-UA') : 'невідомо'}
Категорія: ${bill.rubric ?? 'невідомо'}
Хто вніс: ${bill.subject ?? 'невідомо'}
${initiatorsList ? `Ініціатори: ${initiatorsList}` : ''}
Поточний статус: ${bill.current_phase_title ?? 'невідомо'}
${passingsHistory ? `\nІсторія проходження:\n${passingsHistory}` : ''}

Дай відповідь у форматі JSON (без markdown, тільки чистий JSON):
{
  "summary": "Стисле пояснення суті законопроекту (3-5 речень). Що саме він змінює, до яких законів чи сфер стосується. Тільки факти.",
  "impact": "Що це означає для звичайних людей (2-3 речення). Конкретно: хто відчує зміни і як саме. Якщо закон технічний/ратифікаційний і не впливає прямо на людей — так і скажи.",
  "keywords": ["ключове_слово_1", "ключове_слово_2", "ключове_слово_3"]
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

  // Видаляємо markdown code blocks якщо Claude їх додав
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
