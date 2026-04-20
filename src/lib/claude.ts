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
  pdfAvailable: boolean
}

// Знаходить PDF або docx "Проект Закону" зі сторінки картки
// Порядок атрибутів у тегу <a> непередбачуваний, тому витягуємо кожен атрибут окремо
function findBillDocuments(html: string): { pdfUrl: string | null; docxUrl: string | null; noteUrl: string | null } {
  let pdfUrl: string | null = null
  let docxUrl: string | null = null
  let noteUrl: string | null = null

  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)]
  for (const anchor of anchors) {
    const tag = anchor[0]
    const href = tag.match(/href="([^"]+)"/)?.[1]
    if (!href) continue

    const ext = tag.match(/data-ext="([^"]+)"/)?.[1]?.toLowerCase()
    const fileName = tag.match(/data-file-name="([^"]+)"/)?.[1] ?? ''
    const fullHref = href.startsWith('http') ? href : `https://itd.rada.gov.ua${href}`

    if (/проект закону/i.test(fileName)) {
      if (ext === '.pdf' && !pdfUrl) pdfUrl = fullHref
      else if (ext === '.docx' && !docxUrl) docxUrl = fullHref
    }
    if (/пояснювальна/i.test(fileName) && !noteUrl) {
      noteUrl = fullHref
    }
  }

  return { pdfUrl, docxUrl, noteUrl }
}

// Завантажує файл з itd.rada.gov.ua через чанковий API (X-File-Id / X-Current-Chunk)
async function fetchItdFile(fileId: string): Promise<ArrayBuffer | null> {
  const url = 'https://itd.rada.gov.ua/billinfo/api/file/download/'
  const chunks: ArrayBuffer[] = []
  let totalChunks = 1

  for (let chunk = 0; chunk < totalChunks; chunk++) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)',
          'X-File-Id': fileId,
          'X-Current-Chunk': String(chunk),
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!r.ok) return null
      const buf = await r.arrayBuffer()
      chunks.push(buf)
      if (chunk === 0) {
        const chunkSize = parseInt(r.headers.get('ChunkSize') ?? '0')
        const totalSize = parseInt(r.headers.get('Size') ?? '0')
        if (chunkSize > 0 && totalSize > chunkSize) {
          totalChunks = Math.ceil(totalSize / chunkSize)
        }
      }
    } catch {
      return null
    }
  }

  if (chunks.length === 0) return null
  if (chunks.length === 1) return chunks[0]
  const total = chunks.reduce((s, c) => s + c.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) { merged.set(new Uint8Array(c), offset); offset += c.byteLength }
  return merged.buffer
}

// Завантажує PDF з retry і повертає як base64
async function fetchPdfBase64(url: string, retries = 3): Promise<string | null> {
  // itd.rada.gov.ua потребує спеціального API для завантаження файлів
  const itdFileId = url.match(/\/pubFile\/(\d+)$/)?.[1]

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let buffer: ArrayBuffer | null = null

      if (itdFileId) {
        buffer = await fetchItdFile(itdFileId)
      } else {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
          signal: AbortSignal.timeout(20000),
        })
        if (!r.ok) { if (attempt < retries) continue; return null }
        buffer = await r.arrayBuffer()
      }

      if (!buffer || buffer.byteLength < 1000) {
        if (attempt < retries) continue
        return null
      }
      // Перевірка що це справді PDF
      const magic = String.fromCharCode(...new Uint8Array(buffer.slice(0, 4)))
      if (magic !== '%PDF') { if (attempt < retries) continue; return null }

      return Buffer.from(buffer).toString('base64')
    } catch {
      if (attempt === retries) return null
    }
  }
  return null
}

// Завантажує і парсить docx у plain text з retry
async function fetchDocxText(url: string, retries = 2): Promise<string> {
  const itdFileId = url.match(/\/pubFile\/(\d+)$/)?.[1]

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let buffer: ArrayBuffer | null = null

      if (itdFileId) {
        buffer = await fetchItdFile(itdFileId)
      } else {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
          signal: AbortSignal.timeout(15000),
        })
        if (!r.ok) { if (attempt < retries) continue; return '' }
        buffer = await r.arrayBuffer()
      }

      if (!buffer || buffer.byteLength < 100) {
        if (attempt < retries) continue
        return ''
      }
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
      return result.value.replace(/\s+/g, ' ').trim().slice(0, 6000)
    } catch {
      if (attempt === retries) return ''
    }
  }
  return ''
}

// Шукає URL картки на itd.rada.gov.ua за реєстраційним номером (для старих CSV-законів)
async function findItdCardUrl(billNumber: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      'BillSearchModel.registrationNumber': billNumber,
      'BillSearchModel.registrationNumberCompareOperation': '1',
      'BillSearchModel.convocation': '0',
      'BillSearchModel.session': '0',
      'BillSearchModel.detailView': 'False',
    })
    const r = await fetch('https://itd.rada.gov.ua/billInfo/Bills/searchResults', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    })
    const html = await r.text()
    const cardMatch = html.match(/\/billInfo\/Bills\/Card\/(\d+)/)
    if (cardMatch) return `https://itd.rada.gov.ua/billInfo/Bills/Card/${cardMatch[1]}`
    return null
  } catch {
    return null
  }
}

// Завантажує картку і знаходить посилання на документи
async function fetchCardData(cardUrl: string) {
  try {
    const r = await fetch(cardUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)' },
      signal: AbortSignal.timeout(10000),
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

// Отримує повний текст закону (PDF або docx). Повертає { pdfBase64, billText, pdfAvailable }
export async function fetchBillText(bill: BillWithRelations) {
  let cardUrl = bill.url?.includes('itd.rada.gov.ua') ? bill.url : null
  if (!cardUrl && bill.number) cardUrl = await findItdCardUrl(bill.number)

  if (!cardUrl) return { pdfBase64: null, billText: '', cardText: '', pdfAvailable: false }

  const { cardText, pdfUrl, docxUrl, noteUrl } = await fetchCardData(cardUrl)

  let pdfBase64: string | null = null
  let billText = ''

  if (pdfUrl) pdfBase64 = await fetchPdfBase64(pdfUrl)
  if (!pdfBase64 && docxUrl) billText = await fetchDocxText(docxUrl)
  if (!pdfBase64 && !billText && noteUrl) billText = await fetchDocxText(noteUrl)

  const pdfAvailable = !!(pdfBase64 || billText)
  return { pdfBase64, billText, cardText, pdfAvailable }
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

  const { pdfBase64, billText, cardText, pdfAvailable } = await fetchBillText(bill)

  const contextBlock = cardText ? `\nКОНТЕКСТ З ОФІЦІЙНОЇ КАРТКИ:\n${cardText}` : ''
  const textBlock = billText ? `\nТЕКСТ ДОКУМЕНТУ:\n${billText}` : ''

  const sourceNote = pdfBase64
    ? 'Повний текст законопроекту додано як PDF. Читай БЕЗПОСЕРЕДНЬО З НЬОГО.'
    : billText
    ? 'Текст документу додано вище. Аналізуй на його основі.'
    : 'УВАГА: Повний текст недоступний технічно (сервер не відповів). Аналізуй на основі наявних метаданих, але познач це в summary.'

  const textPrompt = `Ти — аналітик законодавства України. Прочитай повний текст законопроекту і дай КОРОТКЕ пояснення для звичайних людей.

ДАНІ:
Назва: ${bill.title}
Номер: ${bill.number ?? '—'} | Дата: ${bill.registration_date ? new Date(bill.registration_date).toLocaleDateString('uk-UA') : '—'}
Категорія: ${bill.rubric ?? '—'} | Ініціатор: ${bill.subject ?? '—'}${initiatorsList ? ` (${initiatorsList})` : ''}
Статус: ${bill.current_phase_title ?? '—'}
${passingsHistory ? `Проходження:\n${passingsHistory}` : ''}${contextBlock}${textBlock}

${sourceNote}

ПРАВИЛА:
— summary: 1-2 речення на основі РЕАЛЬНОГО ТЕКСТУ закону. Що конкретно змінює. Починай з дієслова.
— impact: 1-2 речення. Хто реально відчує зміни і як. Якщо технічний — "Безпосередньо на громадян не впливає. Стосується [сфери]."
— keywords: 3 найточніші слова

JSON без markdown: {"summary":"...","impact":"...","keywords":["...","...","..."]}`

  const shortMessages: Anthropic.MessageParam[] = pdfBase64
    ? [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } } as Anthropic.DocumentBlockParam,
          { type: 'text', text: textPrompt },
        ],
      }]
    : [{ role: 'user', content: textPrompt }]

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: shortMessages,
  })
  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  const jsonText = content.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(jsonText)
  return { summary: parsed.summary, impact: parsed.impact, keywords: parsed.keywords ?? [], pdfAvailable }
}

// ── ДЕТАЛЬНИЙ АНАЛІЗ (по запиту) ────────────────────────────────────────────

export async function analyzeDetailed(bill: BillWithRelations): Promise<{ text: string; pdfAvailable: boolean }> {
  const { pdfBase64, billText, cardText, pdfAvailable } = await fetchBillText(bill)

  const contextBlock = cardText ? `\nКОНТЕКСТ З ОФІЦІЙНОЇ КАРТКИ:\n${cardText}` : ''
  const textBlock = billText ? `\nТЕКСТ ДОКУМЕНТУ:\n${billText}` : ''

  const sourceNote = pdfBase64
    ? 'Повний текст законопроекту додано як PDF. Читай БЕЗПОСЕРЕДНЬО З НЬОГО.'
    : billText
    ? 'Текст документу додано вище. Аналізуй на його основі.'
    : 'УВАГА: Повний текст недоступний технічно (сервер не відповів). Аналізуй на основі наявних метаданих.'

  const detailedPrompt = `Ти — незалежний аналітик законодавства. Твоя місія — знайти що насправді написано в законі, незалежно від того що влада декларує публічно.

ЗАКОНОПРОЕКТ: ${bill.title}
Номер: ${bill.number ?? '—'} | Дата: ${bill.registration_date ? new Date(bill.registration_date).toLocaleDateString('uk-UA') : '—'}
Ініціатор: ${bill.subject ?? '—'} | Статус: ${bill.current_phase_title ?? '—'}${contextBlock}${textBlock}

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

  const message = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 4096, messages })
  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  return { text: content.text.trim(), pdfAvailable }
}
