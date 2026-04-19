// Функції для роботи з відкритими даними Верховної Ради України
// Джерело: data.rada.gov.ua

const RADA_BASE = 'https://data.rada.gov.ua/ogd/zpr/skl9'

export interface RadaBillInfo {
  id: number
  type: string
  name: string
  url: string
  registrationNumber: string
  registrationDate: string
  registrationSession: string
  registrationConvocation: string
  redaction: string
  rubric: string
  subject: string
  actNumber: string | null
  actDate: string | null
  isUrgent: boolean
  isEuro: boolean
  initiators: RadaInitiator[]
  mainExecutives: RadaExecutive[]
  currentPhase: {
    date: string | null
    title: string | null
    status: string | null
  }
  passings: RadaPassing[]
}

export interface RadaInitiator {
  mp: {
    convocation: string
    person: {
      id: number
      surname: string
      firstname: string
      patronymic: string
    }
  } | null
  inner: {
    post: string
    department: string
    person: {
      id: number
      surname: string
      firstname: string
      patronymic: string
    }
  } | null
  outter: {
    name: string
    post: string
  } | null
}

export interface RadaExecutive {
  department: string
  person: {
    id: number
    surname: string
    firstname: string
    patronymic: string
  }
}

export interface RadaPassing {
  date: string
  title: string
  status: string
}

// Завантажити повний список законопроектів IX скликання
export async function fetchBillsFromDate(fromDate: Date): Promise<RadaBillInfo[]> {
  console.log(`Завантаження законопроектів з ${fromDate.toISOString()}...`)

  // Завантаження великого JSON файлу (127MB)
  const response = await fetch(`${RADA_BASE}/billinfo-skl9.json`, {
    headers: { 'User-Agent': 'OpenData' },
  })

  if (!response.ok) {
    throw new Error(`Помилка завантаження: ${response.status}`)
  }

  const text = await response.text()

  // Парсинг з обробкою некоректних символів
  let allBills: RadaBillInfo[]
  try {
    allBills = JSON.parse(text)
  } catch {
    // Виправлення контрольних символів
    const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    allBills = JSON.parse(cleaned)
  }

  // Фільтрація: тільки з дати початку повномасштабної війни
  return allBills.filter(bill => {
    if (!bill.registrationDate) return false
    return new Date(bill.registrationDate) >= fromDate
  })
}

// Завантажити лише список (легший файл, 8MB)
export async function fetchBillsList(): Promise<Array<{
  id: number
  name: string
  registrationDate: string
  registrationNumber: string
  registrationSession: string
  registrationConvocation: string
  subject: string
}>> {
  const response = await fetch(`${RADA_BASE}/billinfo_list-skl9.json`, {
    headers: { 'User-Agent': 'OpenData' },
  })

  if (!response.ok) {
    throw new Error(`Помилка завантаження списку: ${response.status}`)
  }

  return response.json()
}
