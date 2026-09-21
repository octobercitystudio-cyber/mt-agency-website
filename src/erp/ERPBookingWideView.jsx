import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import arCalendarLocale from '@fullcalendar/core/locales/ar';
import { CalendarPlus, CalendarDays, ChevronLeft, ChevronRight, Search, Clock, Check, Ban, RefreshCw, CalendarClock, LockKeyhole, CheckCircle, X } from 'lucide-react';
import { cairoDateKey, calculateDurationMinutes, formatBookingDate, formatDurationMinutes, formatTime12 } from '../lib/businessFormat';
import { bookingDayAgenda, bookingDaySummary, normalizeBookingViewStatus } from '../lib/bookingView';
import { clientColorText } from '../lib/clientColors';
import './ERPBookingWideView.css';

const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const parseDate = value => new Date(`${value}T12:00:00Z`);
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayFormatter = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const monthFormatter = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', timeZone: 'UTC' });
const dateLabel = value => dayFormatter.format(parseDate(value));
const monthLabel = value => monthFormatter.format(parseDate(`${value}-01`));
const calendarPlugins = [dayGridPlugin, interactionPlugin, timeGridPlugin];
const calendarLocales = [arCalendarLocale];
const calendarTimeFormat = { hour: 'numeric', minute: '2-digit', hour12: true, meridiem: 'short' };
const appointmentCount = count => count === 0 ? 'لا توجد مواعيد' : count === 1 ? 'موعد واحد' : count === 2 ? 'موعدان' : `${count} مواعيد`;

function BookingTimes({ start, end }) {
  return <span className="booking-calendar-ticket__time"><span className="booking-calendar-ticket__time-segment">من <bdi className="booking-calendar-ticket__time-value">{formatTime12(start, '')}</bdi></span><span className="booking-calendar-ticket__time-segment">إلى <bdi className="booking-calendar-ticket__time-value">{formatTime12(end, '')}</bdi></span></span>;
}

export default function ERPBookingWideView({ selectedDate, onSelectDate, isAdmin, loading, loadError, blockLoadError, onRefresh, bookings, blocks, events, query, onQueryChange, status, onStatusChange, pendingBookings, decisionBusy, decisionError, onDecision, onAlternative, onNewBooking, onDayActions, onOpenBooking, onOpenBlock, onDateClick, onDatesSet, onEventClick, onRescheduleProposal, calendarRootRef, getStatusMeta, getClientColor }) {
  const calendarRef = useRef(null);
  const dayRailRef = useRef(null);
  const lastCalendarRangeRef = useRef('');
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  const [displayedMonth, setDisplayedMonth] = useState(selectedDate.slice(0, 7));
  const [viewType, setViewType] = useState('dayGridMonth');
  const [calendarTitle, setCalendarTitle] = useState(monthLabel(displayedMonth));
  const [pendingOpen, setPendingOpen] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1150px)').matches);
  const filtered = query.trim() !== '' || status !== 'all';
  const summary = bookingDaySummary(bookings, blocks, selectedDate);
  const agenda = bookingDayAgenda(bookings, blocks, selectedDate);
  const monthDays = new Date(Date.UTC(Number(displayedMonth.slice(0, 4)), Number(displayedMonth.slice(5)), 0)).getUTCDate();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1150px)');
    const resize = () => { setCompact(media.matches); const api = calendarRef.current?.getApi(); if (media.matches && api?.view.type !== 'dayGridMonth') api?.changeView('dayGridMonth', selectedDateRef.current); window.requestAnimationFrame(() => api?.updateSize()); };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);

  useEffect(() => {
    const rail = dayRailRef.current;
    const selected = rail?.querySelector('[aria-current="date"]');
    if (!rail?.clientWidth || !selected) return;
    const r = rail.getBoundingClientRect(); const s = selected.getBoundingClientRect();
    rail.scrollLeft += s.left + s.width / 2 - r.left - r.width / 2;
  }, [selectedDate, displayedMonth, compact]);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const start = dateKey(api.view.currentStart); const end = dateKey(api.view.currentEnd);
    if (selectedDate < start || selectedDate >= end) api.gotoDate(selectedDate);
  }, [selectedDate]);

  const handleDatesSet = info => {
    const rangeKey = `${info.startStr}|${info.endStr}|${info.view.type}`;
    // FullCalendar can emit datesSet again when custom React content updates.
    // Only an actual visible-range/view change may feed state back to it.
    if (lastCalendarRangeRef.current === rangeKey) return;
    lastCalendarRangeRef.current = rangeKey;
    const month = dateKey(info.view.currentStart).slice(0, 7);
    setDisplayedMonth(month);
    setCalendarTitle(info.view.title);
    setViewType(info.view.type);
    const selected = selectedDateRef.current;
    if (selected < dateKey(info.view.currentStart) || selected >= dateKey(info.view.currentEnd)) onSelectDate(dateKey(info.view.currentStart));
    onDatesSet(info);
  };
  const chooseDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    selectedDateRef.current = value;
    onSelectDate(value);
    calendarRef.current?.getApi().gotoDate(value);
  };
  const navigatePeriod = direction => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (compact && api.view.type !== 'dayGridMonth') api.changeView('dayGridMonth', selectedDate);
    if (direction === 0) { chooseDate(cairoDateKey()); return; }
    if (direction < 0) api.prev(); else api.next();
  };
  const changeView = value => calendarRef.current?.getApi().changeView(value, selectedDate);
  const eventContent = arg => {
    const data = arg.event.extendedProps; const block = data.kind === 'booking_block';
    const meta = block ? { label: 'حجز مؤقت', color: '#956019' } : getStatusMeta(data.status);
    return <div className="booking-calendar-ticket" style={{ '--booking-client-color': block ? '#b77a25' : data.client_color, '--booking-client-text': clientColorText(data.client_color) }}>
      <strong className="booking-calendar-ticket__client">{block ? data.block_title : data.client_name}</strong>
      <BookingTimes start={data.start_time} end={data.end_time} />
      <span className="booking-calendar-ticket__status"><span>{block ? <LockKeyhole aria-hidden="true" /> : <i aria-hidden="true" style={{ background: meta.color }} />}{meta.label}</span><span>{formatDurationMinutes(calculateDurationMinutes(data.start_time, data.end_time))}</span></span>
      {block && data.block_note && <span className="booking-calendar-ticket__note">{data.block_note}</span>}
    </div>;
  };

  return <section className="erp-bookings-wide" aria-label="جدول الحجوزات">
    <header className="bookings-wide-header"><div><p>تنظيم الاستديو</p><h1>جدول الحجوزات</h1></div><div className="bookings-wide-header-actions">
      {isAdmin && <button type="button" className="bookings-wide-button" aria-expanded={pendingOpen} aria-controls="booking-pending-requests" onClick={() => setPendingOpen(open => !open)}><Clock size={17} />طلبات التأكيد <b>{pendingBookings.length}</b></button>}
      {isAdmin && <button type="button" className="bookings-wide-button" onClick={event => onDayActions(event.currentTarget)}><CalendarClock size={18} />إجراءات اليوم</button>}
      <button type="button" className="bookings-wide-button primary" onClick={event => onNewBooking(event.currentTarget)}><CalendarPlus size={18} />حجز موعد جديد</button>
    </div></header>

    {isAdmin && pendingOpen && <section id="booking-pending-requests" className="bookings-wide-requests" aria-label="طلبات بانتظار التأكيد"><header><h2>طلبات بانتظار التأكيد <span>{pendingBookings.length}</span></h2><div><button type="button" className="bookings-wide-button" disabled={loading} onClick={onRefresh}><RefreshCw size={16} />تحديث</button><button type="button" className="bookings-wide-icon-button" aria-label="إغلاق طلبات التأكيد" onClick={() => setPendingOpen(false)}><X size={18} /></button></div></header>
      {decisionError && <p className="bookings-wide-error" role="alert">{decisionError}</p>}
      {!pendingBookings.length ? <p className="bookings-wide-empty"><CheckCircle size={22} />لا توجد طلبات جديدة بانتظار القرار.</p> : <div className="bookings-wide-request-list">{pendingBookings.map(booking => <article key={booking.id}><h3>{booking.client_name}</h3><p>{formatBookingDate(booking.date)}</p><BookingTimes start={booking.start_time} end={booking.end_time} /><p>{booking.service}</p>{booking.notes && <p>{booking.notes}</p>}<div className="bookings-wide-request-actions"><button type="button" className="bookings-wide-button confirm" disabled={Boolean(decisionBusy)} onClick={() => onDecision(booking, 'confirm')}><Check size={16} />{decisionBusy === `confirm-${booking.id}` ? 'جارٍ التأكيد...' : 'تأكيد'}</button><button type="button" className="bookings-wide-button" disabled={Boolean(decisionBusy)} onClick={() => onAlternative(booking)}><CalendarPlus size={16} />موعد بديل</button><button type="button" className="bookings-wide-button reject" disabled={Boolean(decisionBusy)} onClick={() => { if (window.confirm(`رفض طلب ${booking.client_name}؟`)) onDecision(booking, 'reject'); }}><Ban size={16} />{decisionBusy === `reject-${booking.id}` ? 'جارٍ الرفض...' : 'رفض'}</button></div></article>)}</div>}
    </section>}

    {loadError && <p className="bookings-wide-error" role="alert">{loadError}<button type="button" onClick={onRefresh}>إعادة المحاولة</button></p>}
    {blockLoadError && <p className="bookings-wide-error" role="alert">{blockLoadError}<button type="button" onClick={onRefresh}>إعادة المحاولة</button></p>}
    <div className="bookings-wide-summary" aria-live="polite"><strong>{dateLabel(selectedDate)}</strong><span><b>{summary.total}</b> مواعيد{filtered ? ' مطابقة' : ''}</span><span><b>{summary.confirmed}</b> مؤكدة</span>{isAdmin && <span><b>{summary.temporary}</b> مؤقتة</span>}<span><b>{summary.inProgress}</b> تصوير جارٍ</span>{summary.completed > 0 && <span><b>{summary.completed}</b> مكتملة</span>}</div>
    <div className="bookings-wide-layout">
      <section className="bookings-wide-calendar-panel" aria-label="تقويم المواعيد"><header className="bookings-wide-calendar-toolbar"><div><h2>{compact || viewType === 'dayGridMonth' ? monthLabel(displayedMonth) : calendarTitle}</h2><p>اختر يومًا للاطلاع على مواعيده.</p></div><div className="bookings-wide-navigation"><button type="button" className="bookings-wide-icon-button" aria-label={viewType === 'timeGridWeek' && !compact ? 'الأسبوع السابق' : 'الشهر السابق'} onClick={() => navigatePeriod(-1)}><ChevronRight /></button><button type="button" className="bookings-wide-button" onClick={() => navigatePeriod(0)}>اليوم</button><button type="button" className="bookings-wide-icon-button" aria-label={viewType === 'timeGridWeek' && !compact ? 'الأسبوع التالي' : 'الشهر التالي'} onClick={() => navigatePeriod(1)}><ChevronLeft /></button></div></header>
        <div className="bookings-wide-filters"><label className="bookings-wide-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="ابحث باسم العميل أو عنوان الحجز" placeholder="ابحث باسم العميل أو عنوان الحجز" value={query} onChange={event => onQueryChange(event.target.value)} /></label><select aria-label="تصفية حالة الحجز" value={status} onChange={event => onStatusChange(event.target.value)}><option value="all">كل الحالات</option><option value="confirmed">مؤكد</option>{isAdmin && <option value="temporary">حجز مؤقت</option>}<option value="pending">بانتظار التأكيد</option><option value="in_progress">تصوير جارٍ</option><option value="completed">مكتمل</option><option value="alternative_proposed">موعد بديل مقترح</option><option value="cancel_requested">طلب إلغاء</option><option value="late_cancel_requested">إلغاء متأخر</option></select><div className="bookings-wide-view-switch" aria-label="طريقة عرض التقويم"><button type="button" aria-pressed={viewType === 'dayGridMonth'} onClick={() => changeView('dayGridMonth')}>شهر</button><button type="button" aria-pressed={viewType === 'timeGridWeek'} onClick={() => changeView('timeGridWeek')}>أسبوع</button></div></div>
        {filtered && <p className="bookings-wide-filter-note">تظهر المواعيد المطابقة للبحث والحالة فقط؛ إخفاء موعد لا يعني أن فترته متاحة.<button type="button" onClick={() => { onQueryChange(''); onStatusChange('all'); }}>مسح التصفية</button></p>}
        {loading && <p className="bookings-wide-loading" role="status"><RefreshCw size={17} className="client-spin" />جارٍ تحميل المواعيد...</p>}
        <div ref={calendarRootRef} className="bookings-wide-calendar" role="region" aria-label="تقويم الحجوزات الشهري والأسبوعي" tabIndex={0}>
          <FullCalendar ref={calendarRef} plugins={calendarPlugins} initialView="dayGridMonth" initialDate={selectedDate} locales={calendarLocales} locale="ar" direction="rtl" firstDay={6} events={events} dateClick={onDateClick} datesSet={handleDatesSet} eventClick={onEventClick} eventDisplay="block" eventInteractive={true}
            eventDidMount={info => { const data = info.event.extendedProps; const title = data.kind === 'booking_block' ? data.block_title : data.client_name; info.el.setAttribute('aria-label', `${title}، من ${formatTime12(data.start_time)} إلى ${formatTime12(data.end_time)}`); }}
            editable={isAdmin} eventStartEditable={isAdmin} eventDurationEditable={isAdmin} eventDrop={onRescheduleProposal} eventResize={onRescheduleProposal} eventAllow={(dropInfo, draggedEvent) => Boolean(draggedEvent.extendedProps.reschedule_eligible) && dropInfo.start.getDay() !== 5}
            eventClassNames={arg => ['bookings-wide-event', arg.event.extendedProps.kind === 'booking_block' ? 'booking-status-temporary' : `booking-status-${normalizeBookingViewStatus(arg.event.extendedProps.status)}`, ...(arg.event.extendedProps.reschedule_eligible ? ['is-reschedule-eligible'] : [])]}
            slotMinTime="00:00:00" scrollTime="12:00:00" slotMaxTime="24:00:00" allDaySlot={false} slotDuration="00:15:00" slotLabelInterval="01:00:00" eventMinHeight={90} eventTimeFormat={calendarTimeFormat} slotLabelFormat={calendarTimeFormat} eventContent={eventContent}
            dayMaxEvents={false} height="auto" headerToolbar={false} fixedWeekCount={false} nowIndicator={true}
            dayCellContent={arg => <span className="bookings-wide-day-number"><button type="button" onClick={event => { event.stopPropagation(); chooseDate(dateKey(arg.date)); }} aria-label={`اختيار ${dateLabel(dateKey(arg.date))}`} aria-current={dateKey(arg.date) === selectedDate ? 'date' : undefined}>{arg.date.getDate()}</button></span>}
            dayCellClassNames={arg => [dateKey(arg.date) === selectedDate ? 'selected-day-highlight' : '']}
          />
        </div>
        <div className="bookings-wide-mobile-dates"><label>انتقل إلى تاريخ<input type="date" aria-label="تاريخ المواعيد" value={selectedDate} onChange={event => chooseDate(event.target.value)} /></label><div ref={dayRailRef} className="bookings-wide-date-rail" aria-label="أيام الشهر">{Array.from({ length: monthDays }, (_, index) => { const value = `${displayedMonth}-${String(index + 1).padStart(2, '0')}`; const day = parseDate(value).getUTCDay(); return <button key={value} type="button" aria-current={value === selectedDate ? 'date' : undefined} onClick={() => chooseDate(value)} aria-label={dateLabel(value)}><small>{dayNames[day]}</small><b>{index + 1}</b></button>; })}</div><p>مرّر الأيام أو اختر التاريخ المطلوب من الحقل بالأعلى.</p></div>
        <footer className="bookings-wide-legend"><span><i className="confirmed" />مؤكد</span>{isAdmin && <span><i className="temporary" />حجز مؤقت</span>}<span><i className="completed" />مكتمل</span><span>لون الموعد هو لون العميل</span></footer>
      </section>
      <aside className="bookings-wide-agenda" aria-labelledby="booking-agenda-title"><header><p>اليوم المختار</p><h2 id="booking-agenda-title">{dateLabel(selectedDate)}</h2><span>{appointmentCount(summary.total)}{filtered ? ' مطابقة للتصفية' : ''}</span></header>{isAdmin && <button type="button" className="bookings-wide-button bookings-wide-agenda-action" onClick={event => onDayActions(event.currentTarget)}><CalendarClock size={17} />إجراءات هذا اليوم</button>}
        <div className="bookings-wide-agenda-list">{!agenda.length ? <div className="bookings-wide-empty"><CalendarDays size={25} /><h3>{filtered ? 'لا توجد نتائج مطابقة' : loading ? 'جارٍ تحميل اليوم' : 'لا توجد مواعيد مسجلة'}</h3><p>{filtered ? 'غيّر البحث أو الحالة لعرض بقية المواعيد.' : 'اختر يومًا آخر أو أضف موعدًا جديدًا.'}</p></div> : agenda.map(({ kind, record }) => { const block = kind === 'block'; const meta = block ? { label: 'حجز مؤقت', color: '#956019' } : getStatusMeta(record.status); return <article key={`${kind}-${record.id}`} className={`bookings-wide-agenda-item booking-status-${block ? 'temporary' : normalizeBookingViewStatus(record.status)}`} style={{ '--booking-client-color': block ? '#b77a25' : getClientColor(record.client_name) }}>
          <div className="bookings-wide-agenda-meta"><span><i style={{ background: meta.color }} />{meta.label}</span><span>{formatDurationMinutes(calculateDurationMinutes(record.start_time, record.end_time))}</span></div><button type="button" className="bookings-wide-agenda-name" onClick={event => block ? onOpenBlock(record, event.currentTarget) : onOpenBooking(record, event.currentTarget)}>{block ? record.title || 'حجز مؤقت' : record.client_name}</button><div className="booking-time-summary"><BookingTimes start={record.start_time} end={record.end_time} /></div>{block ? <>{record.note && <p className="bookings-wide-agenda-note">{record.note}</p>}{record.resource_name && <p className="bookings-wide-agenda-service">{record.resource_name}</p>}</> : record.service && <p className="bookings-wide-agenda-service">{record.service}</p>}
        </article>; })}</div>
      </aside>
    </div>
    <p className="bookings-wide-help">نقرة واحدة لاختيار اليوم.{isAdmin && <> <strong>نقرتان على مساحة فارغة</strong> لحجز مؤقت أو بدء جلسة تصوير.</>} كل المواعيد بتوقيت القاهرة.</p>
  </section>;
}
