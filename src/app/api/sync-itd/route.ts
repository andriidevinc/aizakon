// Щоденна синхронізація законопроектів через itd.rada.gov.ua
// Викликається автоматично Vercel Cron щодня о 06:00 UTC

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const maxDuration = 60

const SEARCH_URL = 'https://itd.rada.gov.ua/billInfo/Bills/searchResults'
const CARD_BASE = 'https://itd.rada.gov.ua/billInfo/Bills/Card'

function toISO(str: string | null): string | null {
  if (!str) return null
  const m = str.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
}

function decodeHTML(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#xA;/g, ' ')
    .replace(/&nbsp;/g, ' ')
}

function parsePage(html: string) {
  const bills: Record<string, unknown>[] = []
  const rows = html.split('<tr>')
  for (const row of rows) {
    const cardMatch = row.match(/\/billInfo\/Bills\/Card\/(\d+)[^>]*>([^<]+)<\/a>/)
    if (!cardMatch) continue

    const cardId = parseInt(cardMatch[1])
    const number = cardMatch[2].trim()

    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map(m => decodeHTML(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()))

    const date      = tds[2] ?? null
    const subject   = tds[3] ?? null
    const title     = tds[4] ?? null
    const statusRaw = tds[6] ?? null

    let phaseDate: string | null = null
    if (statusRaw) {
      const dm = statusRaw.match(/\((\d{2}\.\d{2}\.\d{4})\)/)
      if (dm) phaseDate = toISO(dm[1])
    }

    bills.push({
      id: cardId,
      number,
      title: title || null,
      url: `${CARD_BASE}/${cardId}`,
      registration_date: toISO(date),
      convocation: 'IX скликання',
      subject: subject || null,
      current_phase_title: statusRaw || null,
      current_phase_date: phaseDate,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    })
  }
  return bills
}

async function fetchPage(dateStart: string, dateEnd: string, page: number, byPassing = false): Promise<string> {
  const params: Record<string, string> = {
    'BillSearchModel.convocation': '0',
    'BillSearchModel.session': '0',
    'BillSearchModel.detailView': 'True',
    'Paging.page': String(page),
  }
  if (byPassing) {
    params['BillSearchModel.passingsRangeStart'] = dateStart
    params['BillSearchModel.passingsRangeEnd'] = dateEnd
  } else {
    params['BillSearchModel.registrationRangeStart'] = dateStart
    params['BillSearchModel.registrationRangeEnd'] = dateEnd
    params['BillSearchModel.registrationNumberCompareOperation'] = '0'
  }
  const r = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 AIZakon/1.0 (aizakon.vercel.app)',
    },
    body: new URLSearchParams(params).toString(),
  })
  return r.text()
}

async function syncRange(
  supabase: ReturnType<typeof import('@/lib/supabase').getAdminClient>,
  dateStart: string,
  dateEnd: string,
  byPassing: boolean
): Promise<number> {
  let totalSynced = 0
  let page = 1
  let totalPages = 1

  do {
    const html = await fetchPage(dateStart, dateEnd, page, byPassing)
    if (page === 1) {
      const m = html.match(/Знайдено законопроектів:\s*([\d\s]+)/)
      const total = m ? parseInt(m[1].replace(/\s/g, '')) : 0
      totalPages = Math.ceil(total / 30)
    }
    const bills = parsePage(html)
    if (bills.length > 0) {
      const { error } = await supabase.from('bills').upsert(bills)
      if (!error) totalSynced += bills.length
    }
    page++
    if (page <= totalPages) await new Promise(r => setTimeout(r, 200))
  } while (page <= totalPages)

  return totalSynced
}

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get('x-sync-token') ?? req.nextUrl.searchParams.get('token')
  const cronAuth = req.headers.get('authorization')
  return (
    token === process.env.SYNC_SECRET_TOKEN ||
    cronAuth === `Bearer ${process.env.CRON_SECRET}`
  )
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()

  const end = new Date()

  // 1. Нові законопроекти — за датою реєстрації (останні 14 днів)
  const regStart = new Date()
  regStart.setDate(regStart.getDate() - 14)
  const synced1 = await syncRange(supabase, formatDate(regStart), formatDate(end), false)

  // 2. Оновлення статусів — за датою руху (останні 7 днів)
  // Ловить закони будь-якої давнини що щойно змінили статус
  const passStart = new Date()
  passStart.setDate(passStart.getDate() - 7)
  const synced2 = await syncRange(supabase, formatDate(passStart), formatDate(end), true)

  console.log(`[sync-itd] Нових: ${synced1}, оновлено статусів: ${synced2}`)

  return NextResponse.json({
    success: true,
    new_bills: synced1,
    status_updates: synced2,
  })
}
