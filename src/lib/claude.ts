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

  const prompt = `Ти — аналітик законодавства України. Пояснюєш законопроекти коротко і конкретно для звичайних людей.

ЗАКОНОПРОЕКТ:
Назва: ${bill.title}
Номер: ${bill.number ?? '—'}
Дата: ${bill.registration_date ? new Date(bill.registration_date).toLocaleDateString('uk-UA') : '—'}
Категорія: ${bill.rubric ?? '—'}
Ініціатор: ${bill.subject ?? '—'}${initiatorsList ? ` (${initiatorsList})` : ''}
Статус: ${bill.current_phase_title ?? '—'}
${passingsHistory ? `Проходження:\n${passingsHistory}` : ''}

ПРАВИЛА відповіді:
— summary: рівно 1-2 речення. Що конкретно змінює цей закон і в якій сфері. Починай з дієслова: "Вносить зміни до...", "Встановлює...", "Ратифікує...". Жодних розмитих фраз типу "конкретний зміст не деталізовано" — роби висновок з назви.
— impact: рівно 1-2 речення. Хто конкретно відчує зміни і як. Якщо закон суто технічний або ратифікація — пиши: "Безпосередньо на громадян не впливає. Стосується [сфери/відносин між країнами]."
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
