-- AIZanon: база даних для законів Верховної Ради України
-- Виконати в Supabase SQL Editor

-- Основна таблиця законопроектів
CREATE TABLE IF NOT EXISTS bills (
  id BIGINT PRIMARY KEY,
  number TEXT,
  title TEXT NOT NULL,
  type TEXT,
  url TEXT,
  registration_date TIMESTAMPTZ,
  session TEXT,
  convocation TEXT DEFAULT 'IX скликання',
  subject TEXT,
  rubric TEXT,
  current_phase_title TEXT,
  current_phase_date TIMESTAMPTZ,
  act_number TEXT,
  act_date TIMESTAMPTZ,
  is_urgent BOOLEAN DEFAULT FALSE,
  is_euro BOOLEAN DEFAULT FALSE,
  -- AI аналіз
  ai_summary TEXT,
  ai_impact TEXT,
  ai_keywords TEXT[],
  ai_analyzed_at TIMESTAMPTZ,
  -- Мета
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ініціатори законопроекту (депутати, уряд тощо)
CREATE TABLE IF NOT EXISTS bill_initiators (
  id SERIAL PRIMARY KEY,
  bill_id BIGINT REFERENCES bills(id) ON DELETE CASCADE,
  person_id BIGINT,
  surname TEXT,
  firstname TEXT,
  patronymic TEXT,
  convocation TEXT,
  organization TEXT,
  department TEXT,
  post TEXT,
  initiator_type TEXT CHECK (initiator_type IN ('mp', 'inner', 'outter'))
);

-- Проходження законопроекту (читання, підписання тощо)
CREATE TABLE IF NOT EXISTS bill_passings (
  id SERIAL PRIMARY KEY,
  bill_id BIGINT REFERENCES bills(id) ON DELETE CASCADE,
  passing_date TIMESTAMPTZ,
  title TEXT,
  status TEXT
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_bills_registration_date ON bills(registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_current_phase ON bills(current_phase_title);
CREATE INDEX IF NOT EXISTS idx_bills_subject ON bills(subject);
CREATE INDEX IF NOT EXISTS idx_bills_rubric ON bills(rubric);
CREATE INDEX IF NOT EXISTS idx_bills_ai_analyzed ON bills(ai_analyzed_at);
CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(number);
CREATE INDEX IF NOT EXISTS idx_bill_initiators_bill_id ON bill_initiators(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_passings_bill_id ON bill_passings(bill_id);

-- Повнотекстовий пошук
CREATE INDEX IF NOT EXISTS idx_bills_title_search ON bills USING gin(to_tsvector('simple', title));

-- RLS (Row Level Security) — дані публічні для читання
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_initiators ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_passings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Публічний доступ до читання bills" ON bills FOR SELECT USING (true);
CREATE POLICY "Публічний доступ до читання initiators" ON bill_initiators FOR SELECT USING (true);
CREATE POLICY "Публічний доступ до читання passings" ON bill_passings FOR SELECT USING (true);

-- Тільки service_role може записувати
CREATE POLICY "Service role може писати в bills" ON bills FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role може писати в initiators" ON bill_initiators FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role може писати в passings" ON bill_passings FOR ALL USING (auth.role() = 'service_role');
