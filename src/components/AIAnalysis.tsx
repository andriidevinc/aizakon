'use client'

import { useState, useEffect } from 'react'

interface Props {
  billId: number
  initialSummary: string | null
  initialImpact: string | null
  initialKeywords: string[] | null
  initialDetailed: string | null
  initialPdfAvailable: boolean | null
}

export default function AIAnalysis({ billId, initialSummary, initialImpact, initialKeywords, initialDetailed, initialPdfAvailable }: Props) {
  const [summary, setSummary] = useState(initialSummary)
  const [impact, setImpact] = useState(initialImpact)
  const [keywords, setKeywords] = useState(initialKeywords)
  const [detailed, setDetailed] = useState(initialDetailed)
  const [pdfAvailable, setPdfAvailable] = useState<boolean | null>(initialPdfAvailable)
  const [loading, setLoading] = useState(false)
  const [loadingDetailed, setLoadingDetailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetailed, setShowDetailed] = useState(false)

  useEffect(() => {
    if (!initialSummary) runAnalysis()
  }, [billId])

  async function runAnalysis() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analyze/${billId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Помилка сервера')
      const data = await res.json()
      setSummary(data.summary)
      setImpact(data.impact)
      setKeywords(data.keywords)
      setPdfAvailable(data.pdfAvailable ?? true)
    } catch {
      setError('Не вдалося отримати аналіз. Спробуйте пізніше.')
    } finally {
      setLoading(false)
    }
  }

  async function runDetailed() {
    if (detailed) { setShowDetailed(true); return }
    setLoadingDetailed(true)
    setShowDetailed(true)
    try {
      const res = await fetch(`/api/analyze-detailed/${billId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Помилка сервера')
      const data = await res.json()
      setDetailed(data.detailed)
      if (data.pdfAvailable !== undefined) setPdfAvailable(data.pdfAvailable)
    } catch {
      setDetailed('Не вдалося отримати детальний аналіз. Спробуйте пізніше.')
    } finally {
      setLoadingDetailed(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-center gap-3 text-blue-600">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">AI читає повний текст законопроекту...</span>
        </div>
        <p className="text-blue-500 text-xs mt-2">Зазвичай займає 20-40 секунд</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-5 border border-red-100">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={runAnalysis} className="mt-3 text-sm text-red-700 underline hover:no-underline">
          Спробувати ще раз
        </button>
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="space-y-4">
      {/* Ключові слова */}
      {keywords && keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map(kw => (
            <span key={kw} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">{kw}</span>
          ))}
        </div>
      )}

      {/* Суть закону */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Суть закону</h3>
        <p className="text-gray-800 text-base leading-relaxed">{summary}</p>
      </div>

      {/* Що це означає для людей */}
      {impact && (
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Що це означає для вас</h3>
          <p className="text-gray-800 text-base leading-relaxed">{impact}</p>
        </div>
      )}

      {/* Попередження якщо аналіз без повного тексту */}
      {pdfAvailable === false && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            Не вдалося завантажити повний текст закону — аналіз базується на часткових даних. Точність може бути нижчою.
          </p>
        </div>
      )}

      {/* Кнопка детального аналізу */}
      {!showDetailed && (
        <button
          onClick={runDetailed}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-orange-200 rounded-xl text-sm font-medium text-orange-700 hover:bg-orange-50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
          </svg>
          Глибокий аналіз — підводні камені, хто виграє і програє
        </button>
      )}

      {/* Детальний аналіз */}
      {showDetailed && (
        <div className="border border-orange-200 rounded-xl overflow-hidden">
          <div className="bg-orange-50 px-5 py-3 flex items-center gap-2">
            <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded font-medium">AI</span>
            <h3 className="text-sm font-semibold text-orange-900">Глибокий аналіз</h3>
            {!loadingDetailed && detailed && (
              <button onClick={() => setShowDetailed(false)} className="ml-auto text-xs text-orange-400 hover:text-orange-600">
                Згорнути
              </button>
            )}
          </div>
          <div className="p-5">
            {loadingDetailed ? (
              <div className="flex items-center gap-3 text-orange-600">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">AI читає повний текст закону...</p>
                  <p className="text-xs text-orange-400 mt-0.5">Аналіз займає 20-40 секунд</p>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
                {detailed}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Аналіз згенеровано AI на основі офіційних документів. Не є юридичною консультацією.
      </p>
    </div>
  )
}
