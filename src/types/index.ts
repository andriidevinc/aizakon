export interface Bill {
  id: number
  number: string | null
  title: string
  type: string | null
  url: string | null
  registration_date: string | null
  session: string | null
  convocation: string | null
  subject: string | null
  rubric: string | null
  current_phase_title: string | null
  current_phase_date: string | null
  act_number: string | null
  act_date: string | null
  is_urgent: boolean
  is_euro: boolean
  ai_summary: string | null
  ai_impact: string | null
  ai_keywords: string[] | null
  ai_analyzed_at: string | null
  synced_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface BillInitiator {
  id: number
  bill_id: number
  person_id: number | null
  surname: string | null
  firstname: string | null
  patronymic: string | null
  convocation: string | null
  organization: string | null
  department: string | null
  post: string | null
  initiator_type: 'mp' | 'inner' | 'outter' | null
}

export interface BillPassing {
  id: number
  bill_id: number
  passing_date: string | null
  title: string | null
  status: string | null
}

export interface BillWithRelations extends Bill {
  bill_initiators: BillInitiator[]
  bill_passings: BillPassing[]
}

export type BillStatus = 'adopted' | 'in_progress' | 'rejected' | 'withdrawn' | 'unknown'

export function getBillStatus(currentPhaseTitle: string | null): BillStatus {
  if (!currentPhaseTitle) return 'unknown'
  const phase = currentPhaseTitle.toLowerCase()
  if (
    phase.includes('закон підписано') ||
    phase.includes('закон прийнято') ||
    phase.includes('набрав чинності')
  ) return 'adopted'
  if (
    phase.includes('відхилено') ||
    phase.includes('відхилений')
  ) return 'rejected'
  if (
    phase.includes('відкликано') ||
    phase.includes('відкликаний')
  ) return 'withdrawn'
  return 'in_progress'
}

export const STATUS_LABELS: Record<BillStatus, string> = {
  adopted: 'Прийнято',
  in_progress: 'На розгляді',
  rejected: 'Відхилено',
  withdrawn: 'Відкликано',
  unknown: 'Невідомо',
}

export const STATUS_COLORS: Record<BillStatus, string> = {
  adopted: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-600',
  unknown: 'bg-gray-100 text-gray-600',
}

// Категорії законів для фільтрації
export const RUBRIC_FILTERS = [
  'Усі категорії',
  'Безпека та оборона',
  'Економічна політика',
  'Соціальна політика',
  'Охорона здоров\'я',
  'Освіта і наука',
  'Правова політика',
  'Фінанси та бюджет',
  'Міжнародні відносини',
  'Екологія',
]
