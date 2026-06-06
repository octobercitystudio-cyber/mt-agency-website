-- جدول العملاء (المعلمين)
CREATE TABLE IF NOT EXISTS public.clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone1 TEXT,
    phone2 TEXT,
    job TEXT,
    points REAL DEFAULT 0,
    debt REAL DEFAULT 0,
    color TEXT,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- جدول الخدمات (باقات التصوير)
CREATE TABLE IF NOT EXISTS public.services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    price REAL,
    total_hours REAL,
    deposit REAL,
    validity_days INTEGER,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- جدول الحجوزات
CREATE TABLE IF NOT EXISTS public.bookings (
    id SERIAL PRIMARY KEY,
    client_name TEXT NOT NULL,
    service TEXT,
    date TEXT,
    start_time TEXT,
    end_time TEXT,
    actual_hours REAL DEFAULT 0,
    status TEXT DEFAULT 'نشط',
    payment REAL DEFAULT 0,
    notes TEXT,
    delivery_date TEXT,
    custom_price REAL,
    discount REAL DEFAULT 0,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- إيقاف أمان الصفوف مؤقتاً لتسهيل الربط السريع (يفضل تفعيله لاحقاً)
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
