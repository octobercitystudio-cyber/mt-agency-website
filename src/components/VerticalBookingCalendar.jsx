import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cairoDateKey, formatBookingDate } from '../lib/businessFormat';
import { groupVerticalCalendarEvents, shiftVerticalCalendar, transposeCalendarDays, verticalCalendarRange } from '../lib/verticalCalendarDates';
import './VerticalBookingCalendar.css';

const weekdayNames = { 6: 'السبت', 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة' };
const monthName = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const localDate = value => new Date(`${value}T00:00:00`);

const VerticalBookingCalendar = forwardRef(function VerticalBookingCalendar({
  events = [], initialDate, selectedDate, onSelectDate, onDateClick, onDayDoubleClick,
  onNavigate, datesSet, eventClick, eventContent, eventClassNames, eventAction,
  emptyText = 'لا توجد مواعيد ظاهرة لهذا اليوم.', dayActionLabel = 'عرض يوم', label = 'التقويم العمودي',
}, ref) {
  const [anchor, setAnchor] = useState(initialDate || selectedDate || cairoDateKey());
  const [view, setView] = useState('month');
  const [focusDate, setFocusDate] = useState(selectedDate || '');
  const [focusRevision, setFocusRevision] = useState(0);
  const scroller = useRef(null);
  const focusRequested = useRef(false);
  const callbacks = useRef({ datesSet, onSelectDate, onNavigate });
  useEffect(() => { callbacks.current = { datesSet, onSelectDate, onNavigate }; }, [datesSet, onSelectDate, onNavigate]);
  const range = useMemo(() => verticalCalendarRange(anchor, view), [anchor, view]);
  const matrix = useMemo(() => transposeCalendarDays(range.days), [range.days]);
  const grouped = useMemo(() => groupVerticalCalendarEvents(events, range.days), [events, range.days]);
  const title = view === 'month' ? monthName.format(new Date(`${range.start}T12:00:00Z`)) : `${formatBookingDate(range.start)} — ${formatBookingDate(range.days.at(-1))}`;
  const gotoDate = value => {
    if (!verticalCalendarRange(value).days.length) return;
    callbacks.current.onNavigate?.();
    focusRequested.current = true;
    setAnchor(value); setFocusDate(value); setFocusRevision(revision => revision + 1);
    callbacks.current.onSelectDate?.(value);
  };
  useImperativeHandle(ref, () => ({ getApi: () => ({ gotoDate }) }));
  useEffect(() => {
    callbacks.current.datesSet?.({ start: localDate(range.start), end: localDate(range.endExclusive), startStr: range.start, endStr: range.endExclusive, view: { type: view, currentStart: localDate(range.start), currentEnd: localDate(range.endExclusive), title } });
  }, [range.start, range.endExclusive, title, view]);
  useEffect(() => {
    if (!selectedDate || !verticalCalendarRange(selectedDate).days.length) return;
    setAnchor(selectedDate); setFocusDate(selectedDate); setFocusRevision(revision => revision + 1);
  }, [selectedDate]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = scroller.current;
      const row = container?.querySelector(`[data-date="${focusDate}"]`);
      if (row) {
        if (focusRequested.current) row.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const rowBounds = row.getBoundingClientRect();
        const bounds = container.getBoundingClientRect();
        container.scrollBy({ left: rowBounds.left + rowBounds.width / 2 - (bounds.left + (bounds.width - 76) / 2), behavior: 'instant' });
      } else container?.scrollTo({ left: 0, behavior: 'instant' });
      focusRequested.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [range.start, range.endExclusive, focusDate, focusRevision]);
  const navigate = direction => gotoDate(direction === 0 ? cairoDateKey() : shiftVerticalCalendar(anchor, view, direction));
  const dayClick = (date, event) => {
    if (event.target.closest('[data-calendar-event]')) return;
    const dayEl = event.target.closest('[data-day-button]') || event.currentTarget;
    if (onDateClick) onDateClick({ dateStr: date, dayEl, jsEvent: event.nativeEvent });
    else { setFocusDate(date); callbacks.current.onSelectDate?.(date); }
  };
  const dayDouble = (date, event) => {
    if (event.target.closest('[data-calendar-event]')) return;
    event.stopPropagation();
    onDayDoubleClick?.(date, event.target.closest('[data-day-button]') || event.currentTarget);
  };
  return <section className="vertical-calendar" aria-label={label} dir="rtl">
    <header className="vertical-calendar-toolbar"><div><span>أيام الأسبوع رأسيًا · أسابيع الشهر أفقيًا</span><h3 aria-live="polite">{title}</h3></div><div className="vertical-calendar-navigation"><button type="button" aria-label={view === 'week' ? 'الأسبوع السابق' : 'الشهر السابق'} onClick={() => navigate(-1)}><ChevronRight aria-hidden="true"/></button><button type="button" onClick={() => navigate(0)}>اليوم</button><button type="button" aria-label={view === 'week' ? 'الأسبوع التالي' : 'الشهر التالي'} onClick={() => navigate(1)}><ChevronLeft aria-hidden="true"/></button></div></header>
    <div className="vertical-calendar-tools"><div className="vertical-calendar-view" aria-label="الفترة المعروضة"><button type="button" aria-pressed={view === 'month'} onClick={() => { callbacks.current.onNavigate?.(); setView('month'); }}>شهر</button><button type="button" aria-pressed={view === 'week'} onClick={() => { callbacks.current.onNavigate?.(); setView('week'); }}>أسبوع</button></div><label><CalendarDays aria-hidden="true"/>انتقل إلى تاريخ<input type="date" aria-label="انتقل إلى تاريخ" value={focusDate || anchor} onChange={event => gotoDate(event.target.value)}/></label></div>
    <div ref={scroller} className="vertical-calendar-days" tabIndex={0} role="region" aria-label="أيام الفترة المعروضة">
      <table className="vertical-calendar-matrix" style={{ '--calendar-week-count': matrix.weekCount }}><caption className="vertical-calendar-sr-only">{title} — أيام الأسبوع صفوف والأسابيع أعمدة</caption><thead><tr><th scope="col">اليوم</th>{Array.from({ length: matrix.weekCount }, (_, index) => <th scope="col" key={index}>الأسبوع {index + 1}</th>)}</tr></thead><tbody>{matrix.rows.map(row => <tr key={row.weekday}><th scope="row" className="vertical-calendar-weekday">{weekdayNames[row.weekday]}</th>{row.cells.map((date, index) => date ? <td className={`vertical-calendar-day${date === (selectedDate || focusDate) ? ' is-selected' : ''}${date === cairoDateKey() ? ' is-today' : ''}`} key={date} data-date={date} onClick={event => dayClick(date, event)} onDoubleClick={event => dayDouble(date, event)}>
        <header><button type="button" data-day-button aria-label={`${dayActionLabel} ${formatBookingDate(date)}`} aria-current={date === (selectedDate || focusDate) ? 'date' : undefined} aria-keyshortcuts={onDayDoubleClick ? 'Shift+Enter' : undefined} onKeyDown={event => { if (onDayDoubleClick && event.shiftKey && event.key === 'Enter') { event.preventDefault(); dayDouble(date, event); } }}><strong>{Number(date.slice(8))}</strong>{date === cairoDateKey() && <small>اليوم</small>}</button></header>
        <div className="vertical-calendar-day-events">{grouped.get(date).length ? grouped.get(date).map(event => {
          const classes = eventClassNames?.({ event }) || event.classNames || [];
          return <article key={event.id} data-calendar-event className={`vertical-calendar-event ${Array.isArray(classes) ? classes.join(' ') : classes}`} style={{ '--calendar-event-bg': event.backgroundColor || '#f6f2fb', '--calendar-event-border': event.borderColor || '#dacee9', '--calendar-event-text': event.textColor || '#443255' }}>
            <button type="button" className="vertical-calendar-event-main" onClick={click => { click.stopPropagation(); eventClick?.({ event, el: click.currentTarget, jsEvent: click.nativeEvent }); }} onDoubleClick={click => click.stopPropagation()} aria-label={`${event.title || ''}، ${formatBookingDate(date)}، ${event.extendedProps?.timeLabel || [event.extendedProps?.start_time, event.extendedProps?.end_time].filter(Boolean).join(' إلى ')}، ${event.extendedProps?.marker?.label || ''}`}>{eventContent ? eventContent({ event }) : event.title}</button>
            {eventAction?.(event)}
          </article>;
        }) : <span className="vertical-calendar-empty" aria-label="لا توجد مواعيد ظاهرة في هذا اليوم">—</span>}</div>
      </td> : <td key={`empty-${index}`} className="vertical-calendar-outside" aria-label="خارج الشهر"/>)}</tr>)}</tbody></table>
    </div>
    <p className="vertical-calendar-scroll-note">{emptyText} <span>على الشاشات الصغيرة، اسحب أفقيًا لعرض بقية الأسابيع.</span></p>
  </section>;
});

export default VerticalBookingCalendar;
