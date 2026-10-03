import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, ChartNoAxesCombined, Check, CircleAlert, Eye, Info, LoaderCircle, LogIn, MousePointer2, RefreshCw, Smartphone, UserRoundPlus, Users } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dataClient } from '../dataClient';
import { publicServiceCatalog } from '../data/publicServiceCatalog';
import './AdminAnalytics.css';

const number = new Intl.NumberFormat('en-US');
const count = value => number.format(Number(value) || 0);
const SCREENS = { home: 'الرئيسية', schedule: 'المواعيد', packages: 'الباقات', finance: 'المالية', offers: 'العروض', videos: 'الفيديوهات', security: 'الأمان', requests: 'الطلبات', projects: 'المشروعات', history: 'السجل', 'book-studio': 'حجز الاستوديو', 'package-guide': 'دليل الباقات' };
const PAGES = { '/': 'الموقع الرئيسي', '/login': 'تسجيل الدخول', '/register': 'إنشاء حساب', '/dashboard': 'بوابة العملاء' };
const PUBLIC_PAGES = { '/': 'الموقع الرئيسي', '/about': 'من نحن', '/services': 'الخدمات', '/portfolio': 'معرض الأعمال', '/studios': 'الاستوديوهات', '/contact': 'تواصل معنا', ...Object.fromEntries(publicServiceCatalog.map(service => [`/services/${service.slug}`, service.ar.navLabel])) };
const PLATFORMS = { web: 'الموقع', android_app: 'تطبيق أندرويد', standalone: 'التطبيق المثبّت', unknown: 'غير محدد' };
const DEVICES = { desktop: 'كمبيوتر', mobile: 'هاتف', tablet: 'جهاز لوحي', unknown: 'غير محدد' };
const SOURCES = { direct: 'دخول مباشر', google: 'Google', facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp', search: 'محركات البحث', referral: 'إحالة من موقع آخر', app: 'التطبيق', android_app: 'تطبيق أندرويد', unknown: 'غير محدد', internal: 'داخل الموقع' };
const EVENTS = {
  PageView: 'زيارة صفحة', ClientScreenViewed: 'فتح شاشة ببوابة العملاء', AndroidAppDownload: 'الضغط على تحميل أندرويد', ClientInteraction: 'تفاعل داخل الموقع', ClientLogin: 'تسجيل دخول ناجح', ClientLoginAttempt: 'محاولة تسجيل دخول', ClientLoginFailed: 'تعذّر تسجيل الدخول', RegistrationAttempt: 'محاولة إنشاء حساب', CompleteRegistration: 'إنشاء حساب ناجح', RegistrationFailed: 'تعذّر إنشاء الحساب', ClientActionFailed: 'تعذّر تنفيذ إجراء',
  PackageBookingRequestSubmitted: 'إرسال طلب حجز باقة', AppointmentRequested: 'إرسال طلب موعد', AppointmentRescheduleRequested: 'طلب تغيير موعد', AppointmentCancellationRequested: 'طلب إلغاء موعد', AppointmentRequestWithdrawn: 'سحب طلب موعد', AlternativeAppointmentAccepted: 'قبول موعد بديل', AlternativeAppointmentRejected: 'رفض موعد بديل', PaymentProofSubmitted: 'إرسال إثبات دفع', PromotionSubscriptionRequested: 'طلب الاشتراك بعرض', OfferAccepted: 'قبول عرض', NotificationRead: 'قراءة إشعار', NotificationsMarkedRead: 'قراءة جميع الإشعارات', NotificationDismissed: 'إخفاء إشعار', ClientPasswordChanged: 'تغيير كلمة المرور', AppointmentBookingOpened: 'فتح حجز موعد', PaymentDialogOpened: 'فتح نافذة الدفع', OfferViewed: 'مشاهدة عرض', NotificationsOpened: 'فتح الإشعارات', ClientLogoutRequested: 'تسجيل الخروج', PackageSelected: 'اختيار باقة', DraftAppointmentAdded: 'إضافة موعد مبدئي', BookingAppointmentsStep: 'الوصول إلى خطوة المواعيد', InitiateCheckout: 'بدء إتمام الطلب', DeliveryLinkOpened: 'فتح رابط التسليم', PromotionGiftOpened: 'فتح هدية العرض', PromotionGiftClosed: 'إغلاق هدية العرض', PromotionGiftDetailsClicked: 'عرض تفاصيل الهدية', Contact: 'طلب التواصل',
};
const METRICS = { page_views: 'مشاهدات الصفحات', visitors: 'المتصفحات الفريدة', sessions: 'الجلسات', login_views: 'زيارات تسجيل الدخول', login_attempts: 'محاولات الدخول', logins: 'الدخول الناجح', login_failures: 'الدخول المتعذّر', registration_attempts: 'محاولات إنشاء حساب', registrations: 'الحسابات الجديدة', registration_failures: 'إنشاء الحساب المتعذّر', downloads: 'ضغطات التحميل', booking_requests: 'طلبات الحجز', payment_proofs: 'إثباتات الدفع', interaction_events: 'التفاعلات' };
const eventName = key => EVENTS[key] || 'إجراء آخر';
function pageName(page, screen) {
  const publicPath = (page || '/').replace(/^\/(ar|en)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  const label = PAGES[page] || PUBLIC_PAGES[publicPath] || 'صفحة بالموقع';
  const locale = /^\/en(?:\/|$)/.test(page) ? ' · الإنجليزية' : '';
  return `${label}${locale}${screen && SCREENS[screen] ? ` · ${SCREENS[screen]}` : ''}`;
}
const formatDay = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' });
function formatTime(value) {
  if (!value) return 'لم يبدأ بعد';
  const hasZone = /[zZ]|[+-]\d\d:\d\d$/.test(value);
  // SQL timestamps already contain Cairo wall-clock time. Preserve those fields
  // with UTC formatting; only timezone-aware timestamps need Cairo conversion.
  const date = new Date(hasZone ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? 'غير متاح' : date.toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: hasZone ? 'Africa/Cairo' : 'UTC' });
}
function cairoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
}
function period(days) {
  const to = cairoToday();
  const date = new Date(`${to}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days + 1);
  return { from: date.toISOString().slice(0, 10), to };
}
function initialFilters() { return { ...period(30), platform: 'all', device: 'all', page: 'all', screen: 'all' }; }
function normalizeReport(report) {
  const metricKeys = new Set([...Object.keys(METRICS), 'views', 'actions', 'count', 'events']);
  const normalizeRow = row => Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, metricKeys.has(key) ? Number(value) || 0 : value]));
  const result = { ...report, summary: normalizeRow(report.summary), previous: normalizeRow(report.previous) };
  ['daily', 'pages', 'events', 'sources', 'platforms', 'devices'].forEach(key => { result[key] = (report[key] || []).map(normalizeRow); });
  return result;
}
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+@-]/.test(text.trimStart()) || ['\t', '\r', '\n'].includes(text[0])) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function exportReport(data, filters) {
  const rows = [['تقرير إحصائيات الموقع'], ['من', data.from], ['إلى', data.to], ['المنطقة الزمنية', 'Africa/Cairo'], ['المنصة', filters.platform], ['الجهاز', filters.device], ['الصفحة', filters.page], ['الشاشة', filters.screen], [], ['المؤشر', 'الفترة الحالية', 'الفترة السابقة']];
  Object.entries(METRICS).forEach(([key, label]) => rows.push([label, data.summary?.[key] || 0, data.previous?.[key] || 0]));
  rows.push([], ['النشاط اليومي'], ['اليوم', 'المشاهدات', 'المتصفحات', 'الجلسات', 'الدخول الناجح', 'الحسابات', 'التحميل', 'طلبات الحجز']);
  (data.daily || []).forEach(row => rows.push([row.date, row.page_views, row.visitors, row.sessions, row.logins, row.registrations, row.downloads, row.booking_requests]));
  rows.push([], ['أداء الصفحات'], ['الصفحة', 'الشاشة', 'المشاهدات', 'المتصفحات', 'الجلسات', 'الإجراءات']);
  (data.pages || []).forEach(row => rows.push([pageName(row.page), SCREENS[row.screen] || '', row.views, row.visitors, row.sessions, row.actions]));
  rows.push([], ['الإجراءات'], ['الإجراء', 'العدد', 'الجلسات']);
  (data.events || []).forEach(row => rows.push([eventName(row.event), row.count, row.sessions]));
  [['sources', 'مصادر الزيارات', 'source', SOURCES], ['platforms', 'المنصات', 'platform', PLATFORMS], ['devices', 'الأجهزة', 'device', DEVICES]].forEach(([key, label, field, names]) => {
    rows.push([], [label], ['النوع', 'الجلسات', 'الأحداث']);
    (data[key] || []).forEach(row => rows.push([names[row[field]] || 'أخرى', row.sessions, row.events]));
  });
  rows.push([], [`النشاط المعروض — الصفحة ${data.recent_page || 1} من ${data.recent_pages || 1}`], ['الإجراء', 'الصفحة', 'المنصة', 'الجهاز', 'التوقيت']);
  (data.recent || []).forEach(row => rows.push([eventName(row.event), pageName(row.page, row.screen), PLATFORMS[row.platform] || 'غير محدد', DEVICES[row.device] || 'غير محدد', formatTime(row.created_at)]));
  const blob = new Blob(['\uFEFF', rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `site-analytics-${data.from}-${data.to}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Comparison({ current = 0, previous = 0 }) {
  current = Number(current) || 0;
  previous = Number(previous) || 0;
  if (!previous) return <span className="sa-comparison sa-neutral">{current ? 'لا توجد قاعدة سابقة للمقارنة' : 'دون تغيير عن الفترة السابقة'}</span>;
  const change = ((current - previous) / previous) * 100;
  return <span className={`sa-comparison ${change > 0 ? 'sa-up' : change < 0 ? 'sa-down' : 'sa-neutral'}`}><b dir="ltr">{change > 0 ? '+' : ''}{change.toFixed(1)}%</b> عن الفترة السابقة</span>;
}
function Empty({ text = 'لا توجد بيانات ضمن هذه الفترة والفلاتر.' }) { return <p className="sa-empty-inline">{text}</p>; }
function Breakdown({ title, rows, field, labels, tone }) {
  const total = rows.reduce((sum, row) => sum + Number(row.sessions || 0), 0);
  return <section className={`sa-panel sa-breakdown ${tone || ''}`}><div className="sa-section-head"><h3>{title}</h3><span>الجلسات / الأحداث</span></div>{!rows.length ? <Empty /> : <ul>{rows.map((row, index) => <li key={`${row[field]}-${index}`}><div><span>{labels[row[field]] || 'أخرى'}</span><span className="sa-numeric"><strong>{count(row.sessions)}</strong><small> / {count(row.events)}</small></span></div><div className="sa-bar" aria-hidden="true"><i style={{ width: `${total ? row.sessions / total * 100 : 0}%` }} /></div></li>)}</ul>}</section>;
}

export default function AdminAnalytics() {
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [range, setRange] = useState(30);
  const [activityPage, setActivityPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [validation, setValidation] = useState('');
  const requestId = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const id = ++requestId.current;
    async function load() {
      setState(previous => ({ ...previous, loading: true, error: '' }));
      try {
        const query = new URLSearchParams({ ...applied, activity_page: String(activityPage) });
        const response = await dataClient.request(`/site-analytics?${query}`, { signal: controller.signal });
        if (id !== requestId.current || controller.signal.aborted) return;
        if (response?.error || !response?.data?.summary) throw new Error('تعذّر تحميل الإحصائيات. تحقّق من الاتصال وصلاحية الدخول ثم أعد المحاولة.');
        setState({ loading: false, data: normalizeReport(response.data), error: '' });
      } catch (error) {
        if (id !== requestId.current || controller.signal.aborted) return;
        setState({ loading: false, data: null, error: error.message || 'تعذّر تحميل الإحصائيات.' });
      }
    }
    load();
    return () => controller.abort();
  }, [applied, activityPage, revision]);
  const { data, loading, error } = state;
  const summary = data?.summary || {};
  const previous = data?.previous || {};
  const events = data?.events || [];
  const eventCount = key => events.find(row => row.event === key)?.count || 0;
  const dirty = JSON.stringify(filters) !== JSON.stringify(applied);
  const changeFilter = (key, value) => setFilters(current => ({ ...current, [key]: value, ...(key === 'page' ? { screen: 'all' } : {}) }));
  function apply(event) {
    event.preventDefault();
    const days = (Date.parse(`${filters.to}T12:00:00Z`) - Date.parse(`${filters.from}T12:00:00Z`)) / 86400000 + 1;
    if (!Number.isFinite(days) || days < 1 || days > 366 || filters.to > cairoToday()) {
      setValidation('اختر فترة صحيحة لا تتجاوز 366 يوماً، وتنتهي اليوم أو قبله.');
      return;
    }
    setValidation('');
    setActivityPage(1);
    setApplied({ ...filters });
  }
  const noData = data && !Object.values(summary).some(value => Number(value) > 0) && !events.length;
  return <div className="site-analytics" dir="rtl">
    <header className="sa-heading"><div><span className="sa-eyebrow"><ChartNoAxesCombined size={16} /> MULTI TASK AGENCY / INSIGHTS</span><h1>الإحصائيات <span>والرؤى</span></h1><p>صورة أوضح لزيارات موقعك، وتفاعل عملائك، ونشاط تطبيقك.</p></div><div className="sa-heading-actions"><button className="sa-button" onClick={() => setRevision(value => value + 1)} disabled={loading}><RefreshCw size={16} className={loading ? 'sa-spin' : ''} /> تحديث</button><button className="sa-button sa-export" onClick={() => exportReport(data, applied)} disabled={!data || loading || Boolean(error)} title="تصدير المؤشرات والجداول وصفحة النشاط المعروضة"><ArrowDownToLine size={16} /> تصدير CSV</button></div></header>
    <form className="sa-filters" onSubmit={apply}>
      <div className="sa-filter-top"><div className="sa-filter-label"><CalendarDays size={18} /><strong>الفترة الزمنية</strong><span>بتوقيت القاهرة</span></div><div className="sa-presets">{[[1, 'اليوم'], [7, '7 أيام'], [30, '30 يوماً'], [90, '90 يوماً']].map(([days, label]) => <button key={days} type="button" aria-pressed={range === days} className={range === days ? 'is-active' : ''} onClick={() => { setRange(days); setFilters(current => ({ ...current, ...period(days) })); }}>{label}</button>)}</div></div>
      <div className="sa-filter-fields"><label>من<input type="date" value={filters.from} max={cairoToday()} required onChange={event => { setRange(null); changeFilter('from', event.target.value); }} /></label><label>إلى<input type="date" value={filters.to} max={cairoToday()} required onChange={event => { setRange(null); changeFilter('to', event.target.value); }} /></label><label>المنصة<select value={filters.platform} onChange={event => changeFilter('platform', event.target.value)}><option value="all">كل المنصات</option>{Object.entries(PLATFORMS).filter(([key]) => key !== 'unknown').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>الجهاز<select value={filters.device} onChange={event => changeFilter('device', event.target.value)}><option value="all">كل الأجهزة</option>{Object.entries(DEVICES).filter(([key]) => key !== 'unknown').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>الصفحة<select value={filters.page} onChange={event => changeFilter('page', event.target.value)}><option value="all">كل الصفحات</option>{Object.entries(PAGES).filter(([key]) => key !== '/').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{filters.page === '/dashboard' && <label>شاشة البوابة<select value={filters.screen} onChange={event => changeFilter('screen', event.target.value)}><option value="all">كل الشاشات</option>{Object.entries(SCREENS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}<button className="sa-button sa-primary" type="submit" disabled={loading}><Check size={16} /> تطبيق الفلاتر</button></div>
      {validation && <p className="sa-validation" role="alert">{validation}</p>}{dirty && !validation && <p className="sa-pending">هناك تغييرات بانتظار تطبيق الفلاتر.</p>}
    </form>
    <div aria-live="polite" className="sa-live-status">{loading ? 'جارٍ تحميل الإحصائيات…' : error ? 'تعذّر تحميل التقرير.' : 'تم تحديث التقرير.'}</div>
    {error ? <section className="sa-state sa-error" role="alert"><CircleAlert size={32} /><h2>لم نتمكّن من جلب التقرير</h2><p>{error}</p><button className="sa-button sa-primary" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button></section> : loading ? <section className="sa-loading" aria-label="جارٍ تحميل التقرير" aria-busy="true"><div className="sa-skeleton-row">{[1, 2, 3, 4].map(key => <div key={key} />)}</div><div className="sa-skeleton-chart"><LoaderCircle className="sa-spin" size={28} /><p>نجمع لك صورة النشاط…</p></div></section> : data && <>
      <div className="sa-report-meta"><span><i /> تقرير {formatDay(data.from || applied.from)} — {formatDay(data.to || applied.to)}</span><span>مقارنة بالفترة السابقة المساوية في المدة</span></div>
      {noData && <section className="sa-new-tracking"><Activity size={25} /><div><h2>تبدأ الصورة من أول زيارة مسجّلة</h2><p>{data.tracking_started_at ? 'لم يُسجّل نشاط يطابق هذه الفلاتر. جرّب فترة أوسع أو كل المنصات.' : 'لا توجد بيانات بعد. ستظهر الزيارات والإجراءات تلقائياً بعد بدء تسجيل النشاط.'} لا يشمل التقرير زيارات سابقة على تفعيل التتبّع.</p></div></section>}
      <section className="sa-kpis" aria-label="المؤشرات الرئيسية">{[['page_views', Eye, 'violet', 'كل مشاهدات الصفحات'], ['visitors', Users, 'teal', 'متصفحات تقريبية، وليست أشخاصاً'], ['sessions', Activity, 'amber', 'تنتهي بعد 30 دقيقة من الخمول'], ['interaction_events', MousePointer2, 'coral', 'الإجراءات المسجّلة داخل الموقع']].map(([key, Icon, tone, hint]) => <article className={`sa-kpi sa-${tone}`} key={key}><div className="sa-kpi-top"><h2>{METRICS[key]}</h2><span><Icon size={19} /></span></div><strong className="sa-kpi-value">{count(summary[key])}</strong><p>{hint}</p><Comparison current={summary[key]} previous={previous[key]} /></article>)}</section>
      <section className="sa-panel sa-chart-panel"><div className="sa-section-head"><div><span className="sa-section-index">01 / حركة الزيارة</span><h2>نبض الموقع، يوماً بيوم</h2><p>المشاهدات والمتصفحات والجلسات خلال الفترة المختارة</p></div><div className="sa-chart-legend"><span><i /> المشاهدات</span><span><i /> المتصفحات</span><span><i /> الجلسات</span></div></div>{!(data.daily || []).length ? <Empty /> : <><div className="sa-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.daily} margin={{ top: 18, right: 10, left: 0, bottom: 0 }} accessibilityLayer><defs><linearGradient id="saActivityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5800ff" stopOpacity={0.14} /><stop offset="100%" stopColor="#5800ff" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#eeebf1" vertical={false} /><XAxis dataKey="date" tickFormatter={formatDay} minTickGap={35} tickLine={false} axisLine={false} tick={{ fill: '#686277', fontSize: 12 }} dy={10} /><YAxis allowDecimals={false} tickFormatter={count} tickLine={false} axisLine={false} width={44} tick={{ fill: '#686277', fontSize: 12 }} /><Tooltip labelFormatter={formatDay} formatter={(value, name) => [count(value), name]} contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e5deef', fontFamily: 'inherit', color: '#241a36' }} /><Area type="monotone" dataKey="page_views" name="المشاهدات" stroke="#5800ff" fill="url(#saActivityFill)" strokeWidth={2.5} isAnimationActive={false} /><Line type="monotone" dataKey="visitors" name="المتصفحات" stroke="#078b7c" dot={false} strokeWidth={2} isAnimationActive={false} /><Line type="monotone" dataKey="sessions" name="الجلسات" stroke="#b27d1a" strokeDasharray="4 4" dot={false} strokeWidth={2} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div><details className="sa-chart-data"><summary>عرض بيانات الرسم كجدول</summary><div className="sa-table-scroll" tabIndex={0} role="region" aria-label="بيانات النشاط اليومي"><table><thead><tr><th>اليوم</th><th>المشاهدات</th><th>المتصفحات</th><th>الجلسات</th></tr></thead><tbody>{data.daily.map(row => <tr key={row.date}><th>{formatDay(row.date)}</th><td>{count(row.page_views)}</td><td>{count(row.visitors)}</td><td>{count(row.sessions)}</td></tr>)}</tbody></table></div></details></>}</section>
      <section className="sa-account-section"><div className="sa-section-head"><div><span className="sa-section-index">02 / الوصول والتفاعل</span><h2>من الزيارة إلى الخطوة التالية</h2></div></div><div className="sa-account-grid">
        <article className="sa-account sa-login"><div className="sa-account-title"><LogIn size={20} /><h3>تسجيل الدخول</h3></div><div className="sa-account-number"><strong>{count(summary.logins)}</strong><span>دخول ناجح</span></div><Comparison current={summary.logins} previous={previous.logins} /><dl><div><dt>زيارات صفحة الدخول</dt><dd>{count(summary.login_views)}</dd></div><div><dt>محاولات الدخول</dt><dd>{count(summary.login_attempts)}</dd></div><div><dt>محاولات متعذّرة</dt><dd>{count(summary.login_failures)}</dd></div></dl></article>
        <article className="sa-account sa-register"><div className="sa-account-title"><UserRoundPlus size={20} /><h3>الحسابات الجديدة</h3></div><div className="sa-account-number"><strong>{count(summary.registrations)}</strong><span>حساب تم إنشاؤه</span></div><Comparison current={summary.registrations} previous={previous.registrations} /><dl><div><dt>محاولات إنشاء حساب</dt><dd>{count(summary.registration_attempts)}</dd></div><div><dt>محاولات متعذّرة</dt><dd>{count(summary.registration_failures)}</dd></div></dl></article>
        <article className="sa-account sa-download"><div className="sa-account-title"><Smartphone size={20} /><h3>التطبيق والطلبات</h3></div><div className="sa-account-number"><strong>{count(summary.downloads)}</strong><span>ضغطة على التحميل</span></div><Comparison current={summary.downloads} previous={previous.downloads} /><dl><div><dt>طلبات حجز مُرسلة</dt><dd>{count(summary.booking_requests)}</dd></div><div><dt>إثباتات دفع مُرسلة</dt><dd>{count(summary.payment_proofs)}</dd></div></dl><p className="sa-small-note">ضغطات التحميل لا تعني تثبيت التطبيق.</p></article>
      </div></section>
      <section className="sa-journey"><div className="sa-section-head"><div><h2>خطوات رحلة الحجز</h2><p>أعداد مستقلة لكل خطوة، وقد ينفّذ العميل الخطوة أكثر من مرة.</p></div><span className="sa-tag">مؤشرات اهتمام</span></div><ol>{[['PackageSelected', 'اختيار الباقة'], ['BookingAppointmentsStep', 'خطوة المواعيد'], ['InitiateCheckout', 'بدء إتمام الطلب'], ['PackageBookingRequestSubmitted', 'إرسال طلب الباقة']].map(([key, label], index) => <li key={key}><span className="sa-step">0{index + 1}</span><strong>{count(eventCount(key))}</strong><span>{label}</span></li>)}</ol><p className="sa-small-note">هذه ليست نسب تحويل متسلسلة. الطلبات المرسلة تنتظر مراجعة الإدارة ولا تمثّل مشتريات مؤكدة.</p></section>
      <section className="sa-panel"><div className="sa-section-head"><div><span className="sa-section-index">03 / تفاصيل الأداء</span><h2>أي الصفحات يزورها العملاء؟</h2></div><span className="sa-tag">أداء الصفحات والشاشات</span></div>{!data.pages?.length ? <Empty /> : <div className="sa-table-scroll" tabIndex={0} role="region" aria-label="أداء الصفحات"><table><thead><tr><th>الصفحة / الشاشة</th><th>المشاهدات</th><th>المتصفحات</th><th>الجلسات</th><th>الإجراءات</th></tr></thead><tbody>{data.pages.map((row, index) => <tr key={`${row.page}-${row.screen}-${index}`}><th><span className="sa-page-label">{pageName(row.page, row.screen)}</span>{PAGES[row.page] && <small className="sa-path" dir="ltr">{row.page}</small>}</th><td className="sa-emphasis">{count(row.views)}</td><td>{count(row.visitors)}</td><td>{count(row.sessions)}</td><td>{count(row.actions)}</td></tr>)}</tbody></table></div>}</section>
      <div className="sa-detail-grid"><section className="sa-panel sa-events"><div className="sa-section-head"><div><h2>ما الذي يفعله العملاء؟</h2><p>تفصيل الإجراءات المسجّلة</p></div><MousePointer2 size={21} /></div>{!events.length ? <Empty /> : <div className="sa-table-scroll sa-event-scroll" tabIndex={0} role="region" aria-label="الإجراءات المسجلة"><table><thead><tr><th>الإجراء</th><th>العدد</th><th>الجلسات</th></tr></thead><tbody>{events.map((row, index) => <tr key={`${row.event}-${index}`}><th>{eventName(row.event)}</th><td className="sa-emphasis">{count(row.count)}</td><td>{count(row.sessions)}</td></tr>)}</tbody></table></div>}</section><div className="sa-breakdown-stack"><Breakdown title="مصادر الزيارات" rows={data.sources || []} field="source" labels={SOURCES} /><Breakdown title="المنصات" rows={data.platforms || []} field="platform" labels={PLATFORMS} tone="sa-teal" /><Breakdown title="الأجهزة" rows={data.devices || []} field="device" labels={DEVICES} tone="sa-amber" /></div></div>
      <section className="sa-panel sa-recent"><div className="sa-section-head"><div><span className="sa-section-index">04 / آخر النشاط</span><h2>آخر الخطوات المسجّلة</h2><p>سجلّ مجهول الهوية، بدون أسماء أو بيانات اتصال</p></div><span className="sa-tag">{count(data.recent_total)} حدث</span></div>{!data.recent?.length ? <Empty /> : <div className="sa-table-scroll" tabIndex={0} role="region" aria-label="آخر النشاط"><table><thead><tr><th>الإجراء</th><th>الصفحة / الشاشة</th><th>المنصة</th><th>الجهاز</th><th>التوقيت · القاهرة</th></tr></thead><tbody>{data.recent.map((row, index) => <tr key={`${row.created_at}-${index}`}><th><span className="sa-activity-dot" />{eventName(row.event)}</th><td>{pageName(row.page, row.screen)}</td><td>{PLATFORMS[row.platform] || 'غير محدد'}</td><td>{DEVICES[row.device] || 'غير محدد'}</td><td className="sa-time">{formatTime(row.created_at)}</td></tr>)}</tbody></table></div>}<div className="sa-pagination"><span>صفحة {count(data.recent_page || 1)} من {count(Math.max(1, data.recent_pages || 1))} <small>· 25 حدثاً بحد أقصى لكل صفحة</small></span><div><button className="sa-button" disabled={activityPage <= 1 || loading} onClick={() => setActivityPage(value => value - 1)}><ArrowRight size={15} /> السابق</button><button className="sa-button" disabled={activityPage >= (data.recent_pages || 1) || loading} onClick={() => setActivityPage(value => value + 1)}>التالي <ArrowLeft size={15} /></button></div></div></section>
      <aside className="sa-notes"><Info size={21} /><div><h3>كيف تقرأ هذه الأرقام؟</h3><p>المتصفحات الفريدة تقديرية وليست عدداً مؤكداً للأشخاص، والجلسة تُجدَّد بعد 30 دقيقة من الخمول. تصنيف مصدر التطبيق استرشادي. هذه إحصائيات متصفح وليست سجلاً محاسبياً.</p><p>التسجيل منذ {formatTime(data.tracking_started_at)}، ولا تُستورد بيانات Meta السابقة. التصدير يشمل الجداول وصفحة النشاط المعروضة فقط.</p></div></aside>
    </>}
  </div>;
}
