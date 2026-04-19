import { NextRequest, NextResponse } from 'next/server'
import { fetchBillsFromDate } from '@/lib/rada-api'
import { getAdminClient } from '@/lib/supabase'
import type { RadaBillInfo, RadaInitiator } from '@/lib/rada-api'

// Дата початку повномасштабного вторгнення
const WAR_START_DATE = new Date('2022-02-24')

// Захист: тільки з правильним токеном
function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get('x-sync-token') ?? req.nextUrl.searchParams.get('token')
  return token === process.env.SYNC_SECRET_TOKEN
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const results = { inserted: 0, updated: 0, errors: 0, total: 0 }

  try {
    console.log('Починаємо синхронізацію з Верховною Радою...')
    const bills = await fetchBillsFromDate(WAR_START_DATE)
    results.total = bills.length
    console.log(`Знайдено ${bills.length} законопроектів з ${WAR_START_DATE.toLocaleDateString('uk-UA')}`)

    // Обробка пакетами по 100 записів
    const BATCH_SIZE = 100
    for (let i = 0; i < bills.length; i += BATCH_SIZE) {
      const batch = bills.slice(i, i + BATCH_SIZE)

      for (const bill of batch) {
        try {
          await upsertBill(supabase, bill)
          results.inserted++
        } catch (err) {
          console.error(`Помилка для законопроекту ${bill.id}:`, err)
          results.errors++
        }
      }

      console.log(`Оброблено ${Math.min(i + BATCH_SIZE, bills.length)} / ${bills.length}`)
    }

    return NextResponse.json({
      success: true,
      message: `Синхронізовано ${results.inserted} законопроектів`,
      ...results,
    })
  } catch (err) {
    console.error('Критична помилка синхронізації:', err)
    return NextResponse.json(
      { error: 'Помилка синхронізації', details: String(err) },
      { status: 500 }
    )
  }
}

async function upsertBill(supabase: ReturnType<typeof getAdminClient>, bill: RadaBillInfo) {
  // 1. Вставити або оновити основний запис
  const { error: billError } = await supabase.from('bills').upsert({
    id: bill.id,
    number: bill.registrationNumber,
    title: bill.name,
    type: bill.type,
    url: bill.url,
    registration_date: bill.registrationDate,
    session: bill.registrationSession,
    convocation: bill.registrationConvocation,
    subject: bill.subject,
    rubric: bill.rubric,
    current_phase_title: bill.currentPhase?.status ?? null,
    current_phase_date: bill.currentPhase?.date ?? null,
    act_number: bill.actNumber,
    act_date: bill.actDate,
    is_urgent: bill.isUrgent ?? false,
    is_euro: bill.isEuro ?? false,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  })

  if (billError) throw billError

  // 2. Видалити старих ініціаторів і вставити нових
  await supabase.from('bill_initiators').delete().eq('bill_id', bill.id)

  if (bill.initiators?.length > 0) {
    const initiators = bill.initiators.map((ini: RadaInitiator) => {
      if (ini.mp) {
        return {
          bill_id: bill.id,
          person_id: ini.mp.person.id,
          surname: ini.mp.person.surname,
          firstname: ini.mp.person.firstname,
          patronymic: ini.mp.person.patronymic,
          convocation: ini.mp.convocation,
          initiator_type: 'mp' as const,
        }
      }
      if (ini.inner) {
        return {
          bill_id: bill.id,
          person_id: ini.inner.person?.id ?? null,
          surname: ini.inner.person?.surname ?? null,
          firstname: ini.inner.person?.firstname ?? null,
          patronymic: ini.inner.person?.patronymic ?? null,
          department: ini.inner.department,
          post: ini.inner.post,
          initiator_type: 'inner' as const,
        }
      }
      if (ini.outter) {
        return {
          bill_id: bill.id,
          organization: ini.outter.name,
          post: ini.outter.post,
          initiator_type: 'outter' as const,
        }
      }
      return null
    }).filter(Boolean)

    if (initiators.length > 0) {
      await supabase.from('bill_initiators').insert(initiators)
    }
  }

  // 3. Вставити проходження (passings)
  await supabase.from('bill_passings').delete().eq('bill_id', bill.id)

  if (bill.passings?.length > 0) {
    const passings = bill.passings.map(p => ({
      bill_id: bill.id,
      passing_date: p.date,
      title: p.title,
      status: p.status,
    }))
    await supabase.from('bill_passings').insert(passings)
  }
}

// GET — просто перевірка статусу
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const { count } = await supabase.from('bills').select('*', { count: 'exact', head: true })

  return NextResponse.json({
    status: 'ok',
    bills_count: count,
    war_start_date: WAR_START_DATE.toISOString(),
  })
}
