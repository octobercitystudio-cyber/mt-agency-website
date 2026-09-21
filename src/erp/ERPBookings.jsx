import { PAYMENT_METHODS } from '../lib/paymentMethods';
import { useState, useEffect, useRef } from 'react';
import { dataClient } from '../dataClient';
import { CalendarPlus, Trash2, DollarSign, X, CheckCircle, Truck, Pointer, RefreshCw, Send, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import arCalendarLocale from '@fullcalendar/core/locales/ar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import { cairoDateKey, calculateDurationMinutes, formatBookingDate, formatDurationMinutes, formatTime12, isValidBusinessBooking, normalizeTime } from '../lib/businessFormat';
import ERPBookingWideView from './ERPBookingWideView';
import { filterBookingsForDisplay, filterBlocksForDisplay, normalizeBookingViewStatus } from '../lib/bookingView';
import ERPRescheduleBookingDialog from './ERPRescheduleBookingDialog';
import ERPBookingDetailsDialog from './ERPBookingDetailsDialog';
import { startStudioSession } from './studioSessionStart';
import ERPAddBookingModal from './ERPAddBookingModal';
import { activeServiceCategories, isProjectServiceCategory } from '../lib/serviceCategories';
import useChangeSync from '../hooks/useChangeSync';
import { ERPBookingBlockDetailsDialog, ERPBookingBlockDialog } from './ERPBookingBlockDialog';
import { ERPBookingDayActionsDialog, ERPDirectSessionDialog } from './ERPBookingDayActionsDialog';
import { bindBookingBlockDoubleClick, bookingBlockDayCellFromEvent } from './bookingBlockInteraction';
import { isClientBookingVisible } from '../lib/clientBookingVisibility';

// FullCalendar Imports
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

let globalBookingsCache = null;
let globalClientsCache = null;
let globalServicesCache = null;
let globalBookingsLastFetch = 0;
const fallbackClientColor = '#4318ff';
const safeClientColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallbackClientColor;
const calendarDateTime = (date, time, endOfDay = false) => {
  const normalized = normalizeTime(time || (endOfDay ? '13:00' : '12:00'), { endOfDay });
  if (normalized === '24:00') {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    return `${format(next, 'yyyy-MM-dd')}T00:00:00`;
  }
  return `${date}T${normalized}:00`;
};

const calendarProposal = event => {
  const start = event.start;
  const end = event.end;
  const startDate = format(start, 'yyyy-MM-dd');
  const endClock = end ? format(end, 'HH:mm') : '';
  const crossesMidnight = end && format(end, 'yyyy-MM-dd') !== startDate && endClock === '00:00';
  return {
    date: startDate,
    start_time: format(start, 'HH:mm'),
    end_time: crossesMidnight ? '24:00' : (endClock || normalizeTime(event.extendedProps.original_end_time || '13:00', { endOfDay: true })),
  };
};

const ERPBookings = () => {
  const { currentUser } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(globalBookingsCache || []);
  const [clients, setClients] = useState(globalClientsCache || []);
  const [services, setServices] = useState(globalServicesCache || []);
  const [resources, setResources] = useState([]);
  const [bookingBlocks, setBookingBlocks] = useState([]);
  const [clientPackages, setClientPackages] = useState([]);
  const [loading, setLoading] = useState(!globalBookingsCache);
  const [clientColorsHydrated, setClientColorsHydrated] = useState(globalClientsCache !== null);
  
  // UI State
  const [selectedDate, setSelectedDate] = useState(() => cairoDateKey());
  const [bookingQuery, setBookingQuery] = useState('');
  const [bookingStatus, setBookingStatus] = useState('all');
  const [loadError, setLoadError] = useState('');
  const [blockLoadError, setBlockLoadError] = useState('');
  const blockRequestSequenceRef = useRef(0);
  const currentBlockRangeRef = useRef({ from: `${cairoDateKey().slice(0, 7)}-01`, to: format(new Date(Number(cairoDateKey().slice(0, 4)), Number(cairoDateKey().slice(5, 7)), 0), 'yyyy-MM-dd') });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  const [decisionBusy, setDecisionBusy] = useState(null);
  const [decisionError, setDecisionError] = useState('');
  const [alternativeModal, setAlternativeModal] = useState({ open: false, booking: null, date: '', start_time: '12:00', end_time: '13:00', note: '' });
  const [rescheduleModal, setRescheduleModal] = useState({ open: false, booking: null, proposal: null });
  const [rescheduleNotice, setRescheduleNotice] = useState('');
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [dayActionsOpen, setDayActionsOpen] = useState(false);
  const [directSessionOpen, setDirectSessionOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState('');
  const rescheduleTriggerRef = useRef(null);
  const detailsTriggerRef = useRef(null);
  const bookingTriggerRef = useRef(null);
  const blockTriggerRef = useRef(null);
  const blockDetailsTriggerRef = useRef(null);
  const dayActionTriggerRef = useRef(null);
  const bookingCalendarRef = useRef(null);
  const dateSelectionTimerRef = useRef(null);
  const lastDayDoubleClickRef = useRef({ date: '', at: 0 });
  const directSessionTriggerRef = useRef(null);

  const isAdmin = ['owner', 'admin', 'operations'].includes(currentUser?.role);

  useEffect(() => () => {
    if (dateSelectionTimerRef.current !== null) window.clearTimeout(dateSelectionTimerRef.current);
  }, []);

  useEffect(() => {
    const calendarRoot = bookingCalendarRef.current;
    if (!isAdmin || !calendarRoot) return undefined;
    return bindBookingBlockDoubleClick(calendarRoot, event => {
      const dayCell = bookingBlockDayCellFromEvent(event, calendarRoot);
      const clickedDate = String(dayCell?.getAttribute?.('data-date') || '').slice(0, 10);
      if (!dayCell || !/^\d{4}-\d{2}-\d{2}$/.test(clickedDate)) return;
      lastDayDoubleClickRef.current = { date: clickedDate, at: Date.now() };
      if (dateSelectionTimerRef.current !== null) window.clearTimeout(dateSelectionTimerRef.current);
      dateSelectionTimerRef.current = window.setTimeout(() => {
        setSelectedDate(clickedDate);
        dayActionTriggerRef.current = calendarRoot;
        setDayActionsOpen(true);
        dateSelectionTimerRef.current = null;
      }, 0);
    });
  }, [isAdmin]);
  const isOwner = currentUser?.role === 'owner';
  const [newBooking, setNewBooking] = useState({
    client_name: '',
    color: '#4318ff',
    category: '',
    service: '',
    dates: [],
    delivery_date: '',
    base_price: 0,
    discount: 0,
    discount_reason: '',
    paid: 0,
    payment_method: 'vodafone_cash',
    notes: '',
    schedule_extra: false
  });

  const fetchBookingBlocks = async (range = currentBlockRangeRef.current) => {
    if (!isAdmin) return;
    const sequence = ++blockRequestSequenceRef.current;
    const { from, to } = range;
    const { data, error } = await dataClient.request(`/booking-blocks?from=${from}&to=${to}`, { method: 'GET' });
    if (sequence !== blockRequestSequenceRef.current || currentBlockRangeRef.current.from !== from || currentBlockRangeRef.current.to !== to) return;
    if (error) { setBlockLoadError(error.message || 'تعذر تحميل الحجوزات المؤقتة لهذه الفترة.'); return; }
    setBlockLoadError('');
    if (Array.isArray(data)) setBookingBlocks(data);
  };

  const fetchData = async (force = false) => {
    if (globalBookingsCache && globalClientsCache && globalServicesCache) {
      setBookings(globalBookingsCache);
      setClients(globalClientsCache);
      setServices(globalServicesCache);
      setLoading(false);
      setClientColorsHydrated(true);
      if (!force && resources.length > 0 && (Date.now() - globalBookingsLastFetch < 30000)) return;
    } else {
      setLoading(true);
    }
    
    setLoadError('');
    const [{ data: bData, error: bookingError }, { data: cData }, { data: sData }, { data: rData }, { data: pData }] = await Promise.all([
      dataClient.from('bookings').select('*').order('date', { ascending: false }),
      dataClient.from('clients').select('id,name,color,phone1,phone2,status'),
      dataClient.from('services').select('*'),
      dataClient.from('resources').select('id,name,is_active,archived_at').eq('is_active', 1),
      dataClient.from('client_packages').select('*'),
      fetchBookingBlocks(),
    ]);

    if (bData) {
      setBookings(bData);
      globalBookingsCache = bData;
    }
    if (cData) {
      setClients(cData);
      globalClientsCache = cData;
    }
    setClientColorsHydrated(true);
    if (sData) {
      setServices(sData);
      globalServicesCache = sData;
    }
    if (rData) setResources(rData);
    if (pData) setClientPackages(pData);
    if (bookingError) setLoadError(bookingError.message || 'تعذر تحميل المواعيد. حاول مرة أخرى.');
    
    globalBookingsLastFetch = Date.now();
    setLoading(false);
  };

  // Initial hydration is intentionally one-shot; later server changes are handled by useChangeSync.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(() => fetchData(), 0); return () => window.clearTimeout(timer); }, []);
  useChangeSync(topics => { if (topics.includes('bookings')) fetchData(true); }, isAdmin && !currentUser?.is_local_preview);
  useEffect(() => {
    const requestedClient = location.state?.openAddModalFor;
    const shouldOpenCreate = location.state?.openCreateBooking === true;
    if (!shouldOpenCreate && !requestedClient) return undefined;
    if (requestedClient && (clients.length === 0 || services.length === 0)) return undefined;
    const timer = window.setTimeout(() => {
      if (requestedClient) setNewBooking(prev => ({ ...prev, client_name: requestedClient }));
      setIsModalOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.state, clients.length, services.length, navigate]);

  const getClientColor = (clientName) => {
    const client = clients.find(c => c.name === clientName);
    return safeClientColor(client?.color);
  };

  const statusMeta = {
    pending: { label: 'بانتظار التأكيد', color: '#d99124' },
    confirmed: { label: 'مؤكد', color: '#20a66a' },
    in_progress: { label: 'تصوير جارٍ', color: '#7c3aed' },
    alternative_proposed: { label: 'موعد بديل مقترح', color: '#268bd2' },
    rejected: { label: 'مرفوض', color: '#d84b5d' },
    cancel_requested: { label: 'طلب إلغاء', color: '#d99124' },
    late_cancel_requested: { label: 'إلغاء متأخر', color: '#d84b5d' },
    completed: { label: 'مكتمل', color: '#20a66a' },
    'مؤكد': { label: 'مؤكد', color: '#20a66a' },
    'منتهي': { label: 'مكتمل', color: '#20a66a' },
  };

  const getStatusMeta = (status) => statusMeta[normalizeBookingViewStatus(status)] || { label: status || 'غير محدد', color: '#6f5b82' };
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const visibleBookings = bookings.filter(isClientBookingVisible);
  const displayedBookings = filterBookingsForDisplay(visibleBookings, { query: bookingQuery, status: bookingStatus });
  const displayedBlocks = isAdmin ? filterBlocksForDisplay(bookingBlocks, { query: bookingQuery, status: bookingStatus }) : [];

  const bookingEvents = displayedBookings.map(b => {
    const clientColor = getClientColor(b.client_name);
    return {
    id: b.id,
    title: `${formatTime12(b.start_time, '')} · ${b.client_name}`,
    start: calendarDateTime(b.date, b.start_time),
    end: calendarDateTime(b.date, b.end_time, true),
    allDay: false,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    textColor: '#16324a',
    editable: isAdmin && b.status === 'confirmed',
    startEditable: isAdmin && b.status === 'confirmed',
    durationEditable: isAdmin && b.status === 'confirmed',
    extendedProps: {
      booking_id: b.id,
      time: `${formatTime12(b.start_time)} - ${formatTime12(b.end_time)}`,
      status: b.status || 'مؤكد',
      service: b.service,
      client_name: b.client_name,
      start_time: b.start_time,
      end_time: b.end_time,
      original_end_time: normalizeTime(b.end_time || '13:00', { endOfDay: true }),
      reschedule_eligible: isAdmin && b.status === 'confirmed',
      client_color: clientColor,
      text_color: '#16324a'
    }
  }});

  const blockEvents = displayedBlocks.map(block => ({
    id: `block-${block.id}`,
    title: block.title || 'حجز مؤقت',
    start: calendarDateTime(block.block_date, block.start_time),
    end: calendarDateTime(block.block_date, block.end_time, true),
    allDay: false,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    textColor: '#956019',
    editable: false,
    startEditable: false,
    durationEditable: false,
    extendedProps: { kind: 'booking_block', block_id: block.id, block_title: block.title || 'حجز مؤقت', block_note: block.note || '', original_end_time: block.end_time, start_time: block.start_time, end_time: block.end_time, text_color: '#8d2f3d' },
  }));
  const calendarEvents = [...bookingEvents, ...blockEvents];

  const submitDecision = async (booking, action, extra = {}) => {
    setDecisionBusy(`${action}-${booking.id}`);
    setDecisionError('');
    const { error } = await dataClient.request(`/bookings/${booking.id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ action, ...extra }),
    });
    setDecisionBusy(null);
    if (error) {
      setDecisionError(error.message || 'تعذر حفظ القرار. حاول مرة أخرى.');
      return false;
    }
    await fetchData(true);
    return true;
  };

  const submitAlternative = async (event) => {
    event.preventDefault();
    const ok = await submitDecision(alternativeModal.booking, 'alternative', alternativeModal);
    if (ok) setAlternativeModal({ open: false, booking: null, date: '', start_time: '12:00', end_time: '13:00', note: '' });
  };

  const handleDateClick = (arg) => {
    const clickedDate = String(arg.dateStr || '').slice(0, 10);
    // FullCalendar may deliver its trailing dateClick after native dblclick.
    // Do not let it cancel the already queued day-action chooser.
    if (lastDayDoubleClickRef.current.date === clickedDate && Date.now() - lastDayDoubleClickRef.current.at < 350) return;
    if (dateSelectionTimerRef.current !== null) window.clearTimeout(dateSelectionTimerRef.current);
    dateSelectionTimerRef.current = window.setTimeout(() => {
      setSelectedDate(clickedDate);
      dateSelectionTimerRef.current = null;
    }, 240);
  };

  const openDayActionsForSelectedDate = trigger => {
    if (!isAdmin) return;
    dayActionTriggerRef.current = trigger;
    setDayActionsOpen(true);
  };

  const openBlockDialogForSelectedDate = trigger => { if (!isAdmin) return; blockTriggerRef.current = trigger; setDayActionsOpen(false); setBlockError(''); setBlockDialogOpen(true); };

  const handleCalendarDatesSet = info => {
    const end = new Date(info.end); end.setDate(end.getDate() - 1);
    const from = format(info.start, 'yyyy-MM-dd'); const to = format(end, 'yyyy-MM-dd');
    if (currentBlockRangeRef.current.from === from && currentBlockRangeRef.current.to === to) return;
    currentBlockRangeRef.current = { from, to };
    fetchBookingBlocks({ from, to });
  };

  const openBookingDetails = (booking, trigger = null) => {
    detailsTriggerRef.current = trigger;
    setDecisionError('');
    setSelectedBookingDetails(booking);
  };

  const handleEventClick = (info) => {
    if (info.event.extendedProps.kind === 'booking_block') {
      blockDetailsTriggerRef.current = info.el || null;
      setBlockError('');
      setSelectedBlock(bookingBlocks.find(block => String(block.id) === String(info.event.extendedProps.block_id)) || null);
      return;
    }
    const bId = info.event.extendedProps.booking_id;
    const fullBooking = bookings.find(b => b.id === bId);
    if (fullBooking) {
      openBookingDetails(fullBooking, info.el || null);
    } else {
      alert('لم يتم العثور على تفاصيل الحجز، برجاء تحديث الصفحة.');
    }
  };

  const handleBlockCreated = async result => {
    setBlockDialogOpen(false);
    setRescheduleNotice(result?.count > 1 ? `تم حظر ${result.count} مواعيد بنجاح.` : 'تم حظر الموعد وإغلاق الفترة للحجز.');
    await fetchData(true);
    window.dispatchEvent(new CustomEvent('erpBookingsUpdated', { detail: { topics: ['bookings'] } }));
  };

  const cancelBookingBlock = async scope => {
    if (!selectedBlock || !window.confirm(scope === 'series' ? 'إلغاء هذا الحظر وكل الفترات التالية في السلسلة؟' : 'إلغاء هذا الحظر وفتح الفترة للحجز؟')) return;
    setBlockBusy(true); setBlockError('');
    const { data, error } = await dataClient.request(`/booking-blocks/${selectedBlock.id}?scope=${scope}`, { method: 'DELETE' });
    setBlockBusy(false); if (error) return setBlockError(error.message || 'تعذر إلغاء الحظر.');
    setSelectedBlock(null); setRescheduleNotice(data?.cancelled > 1 ? `تم إلغاء ${data.cancelled} فترات وفتحها للحجز.` : 'تم إلغاء الحظر وفتح الفترة للحجز.'); await fetchData(true);
    window.dispatchEvent(new CustomEvent('erpBookingsUpdated', { detail: { topics: ['bookings'] } }));
  };

  const openReschedule = (booking, proposal = null, trigger = null) => {
    if (!isAdmin || booking?.status !== 'confirmed') return;
    rescheduleTriggerRef.current = trigger;
    setDecisionError('');
    setRescheduleModal({ open: true, booking, proposal });
  };

  const handleCalendarRescheduleProposal = info => {
    const proposal = calendarProposal(info.event);
    const booking = bookings.find(item => String(item.id) === String(info.event.extendedProps.booking_id));
    info.revert();
    if (booking && info.event.extendedProps.reschedule_eligible) openReschedule(booking, proposal);
  };

  const handleRescheduleSuccess = async updated => {
    setSelectedDate(updated.date);
    setRescheduleNotice(`تم تغيير موعد ${rescheduleModal.booking?.client_name || 'الحجز'} إلى ${formatBookingDate(updated.date)}، ${formatTime12(updated.start_time)}.`);
    setSelectedBookingDetails(null);
    await fetchData(true);
    window.dispatchEvent(new CustomEvent('erpRequestsUpdated', { detail: { topics: ['bookings', 'notifications'] } }));
    window.dispatchEvent(new CustomEvent('erpBookingsUpdated', { detail: { bookingId: updated.id } }));
  };

  const handleStartBooking = async () => {
    if (!selectedBookingDetails) return;
    if (!window.confirm('بدء جلسة التصوير الآن وتشغيل التايمر؟')) return;
    setDecisionBusy(`start-${selectedBookingDetails.id}`);
    try { await startStudioSession(selectedBookingDetails); }
    catch (error) { setDecisionBusy(null); return setDecisionError(error.message || 'تعذر بدء جلسة التصوير.'); }
    setDecisionBusy(null);
    await fetchData(true);
    setSelectedBookingDetails(null);
  };

  const cancelBooking = async (id) => {
    if (!window.confirm('هل تريد حذف هذا الموعد نهائيًا؟ سيختفي من الحجوزات ويُعاد الرصيد المحجوز للعميل.')) return;
    setDecisionBusy(`cancel-${id}`);
    const { error } = await dataClient.request(`/bookings/${id}`, {
      method: 'DELETE',
    });
    setDecisionBusy(null);
    if (error) return setDecisionError(error.message || 'تعذر حذف الموعد.');
    await fetchData(true);
    setSelectedBookingDetails(null);
  };

  const addDateRow = (dateStr = format(new Date(), 'yyyy-MM-dd')) => {
    setNewBooking({
      ...newBooking,
      dates: [...newBooking.dates, { date: dateStr, start_time: '12:00', end_time: '13:00' }]
    });
  };

  const removeDateRow = (index) => {
    const newDates = [...newBooking.dates];
    newDates.splice(index, 1);
    setNewBooking({ ...newBooking, dates: newDates });
  };

  const updateDateRow = (index, field, value) => {
    const newDates = [...newBooking.dates];
    newDates[index][field] = value;
    setNewBooking({ ...newBooking, dates: newDates });
  };

  const handleClientChange = (e) => {
    const name = e.target.value;
    const color = getClientColor(name);
    setNewBooking({ ...newBooking, client_name: name, color });
  };

  const handleCategoryChange = (e) => {
    setNewBooking({ ...newBooking, category: e.target.value, service: '', base_price: 0 });
  };

  const handleServiceChange = (e) => {
    const sName = e.target.value;
    const srv = services.find(s => s.name === sName);
    setNewBooking({ ...newBooking, service: sName, base_price: srv?.price || 0, paid: srv ? srv.price * 0.5 : 0 });
  };

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    
    // Validation: Cannot book a new photography service if they already have an active one
    const photoCategories = ['تصوير بالساعة', 'باقة يومية', 'باقة شهرية'];
    if (photoCategories.includes(newBooking.category)) {
      const hasActivePhoto = bookings.some(b => {
        if (b.client_name !== newBooking.client_name || b.status === 'دفعة' || b.service.includes('مؤرشف')) return false;
        const bSrv = services.find(s => s.name === b.service);
        return bSrv && photoCategories.includes(bSrv.category);
      });

      if (hasActivePhoto) {
        alert('لا يمكن حجز خدمة تصوير جديدة، العميل مشترك بالفعل في خدمة تصوير نشطة!');
        return;
      }
    }

    const bookingService = services.find(s => s.name === newBooking.service);
    const needsDates = !['reel','project'].includes(String(bookingService?.billing_unit || '')) && !isProjectServiceCategory(newBooking.category) || newBooking.schedule_extra;
    if (needsDates && newBooking.dates.length === 0) {
      alert('يجب تحديد موعد واحد على الأقل في التقويم أو عن طريق الضغط مرتين على اليوم المختار');
      return;
    }

    const srvObj = services.find(s => s.name === newBooking.service);
    const minimumMinutes = Math.max(15, Number(srvObj?.minimum_booking_minutes || 60));
    const incrementMinutes = Math.max(15, Number(srvObj?.booking_increment_minutes || 15));

    if (needsDates) {
      for (const d of newBooking.dates) {
        if (d.start_time && d.end_time) {
          const diffInMinutes = calculateDurationMinutes(d.start_time, d.end_time);
          if (!isValidBusinessBooking(d.start_time, d.end_time, minimumMinutes) || diffInMinutes % incrementMinutes !== 0) {
            alert(`الحجز متاح طوال اليوم، بحد أدنى ${formatDurationMinutes(minimumMinutes)} وبزيادات ${formatDurationMinutes(incrementMinutes)} حسب إعدادات الخدمة.`);
            return;
          }
        }
      }
    }

    let bookingsToInsert;
    
    if (needsDates) {
      bookingsToInsert = newBooking.dates.map(d => {
        let hours = 0;
        if (d.start_time && d.end_time) {
          const diffInMinutes = calculateDurationMinutes(d.start_time, d.end_time);
          hours = diffInMinutes > 0 ? diffInMinutes / 60 : 0;
        }

        let finalDeliveryDate = newBooking.delivery_date;
        if (['تصوير بالساعة', 'باقة يومية', 'باقة شهرية'].includes(newBooking.category) && d.date && d.end_time) {
          const dateObj = new Date(d.date);
          dateObj.setDate(dateObj.getDate() + 1);
          finalDeliveryDate = `${format(dateObj, 'yyyy-MM-dd')} ${d.end_time}`;
        }

        return {
          client_name: newBooking.client_name,
          service: newBooking.service,
          date: d.date,
          start_time: d.start_time,
          end_time: d.end_time,
          duration_minutes: d.start_time && d.end_time ? calculateDurationMinutes(d.start_time, d.end_time) : 0,
          actual_hours: hours,
          custom_price: newBooking.base_price,
          discount: newBooking.discount,
          discount_reason: newBooking.discount_reason,
          delivery_date: finalDeliveryDate || null,
          status: 'مؤكد',
          notes: newBooking.notes,
          payment: newBooking.paid // Apply full payment to first record for simplicity, or divide it
        };
      });
      // only apply payment to first record so it isn't duplicated
      bookingsToInsert.forEach((b, i) => { if(i > 0) b.payment = 0; });
    } else {
      bookingsToInsert = [{
        client_name: newBooking.client_name,
        service: newBooking.service,
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '',
        end_time: '',
        actual_hours: 0,
        custom_price: newBooking.base_price,
        discount: newBooking.discount,
        discount_reason: newBooking.discount_reason,
        delivery_date: newBooking.delivery_date || null,
        status: 'مؤكد',
        notes: newBooking.notes,
        payment: newBooking.paid
      }];
    }

    if (!bookingsToInsert.every(item => item.date && item.start_time && item.end_time)) return alert('هذه الخدمة تُدار من الباقات أو المشروعات، وليس من جدول الاستديو.');
    if (Number(newBooking.paid) > 0) return alert('سجّل دفعة العميل من صفحة الباقات أو المالية لربطها محاسبيًا بشكل صحيح.');
    const client = clients.find(item => item.name === newBooking.client_name);
    const service = services.find(item => item.name === newBooking.service);
    if (!client || !service) return alert('اختر عميلًا وخدمة مسجلين.');
    const results = [];
    for (const item of bookingsToInsert) results.push(await dataClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: client.id, service_id: service.id, service: service.name, date: item.date, start_time: item.start_time, end_time: item.end_time, status: 'confirmed', notes: item.notes }) }));
    const error = results.find(result => result.error)?.error;

    if (!error) {
      // Record money only after every booking row has been accepted by the server.
      // This prevents a rejected/conflicting appointment from creating false revenue.
      if (newBooking.paid > 0) {
        await dataClient.request('/finance/manual', { method: 'POST', body: JSON.stringify({
          entry_kind: 'income', category: 'client_revenue', client_id: client.id,
          source_type: 'service', source_id: service.id,
          amount: newBooking.paid,
          method: newBooking.payment_method,
          detail: `دفعة من ${newBooking.client_name} لخدمة ${newBooking.service}`,
          date: format(new Date(), 'yyyy-MM-dd'),
          entity: 'الشركة'
        }) });

        const { data: clientData } = await dataClient.from('clients').select('id, points').eq('name', newBooking.client_name).single();
        if (clientData) {
          const { data: cfg } = await dataClient.from('app_config').select('key, value');
          let pSpent = 100, pEarn = 1;
          cfg?.forEach(c => {
            if (c.key === 'points_egp_spent') pSpent = Number(c.value) || 100;
            if (c.key === 'points_earned') pEarn = Number(c.value) || 1;
          });
          const pointsToAdd = Math.floor((newBooking.paid / pSpent) * pEarn);
          const newPoints = (clientData.points || 0) + pointsToAdd;
          await dataClient.from('clients').update({ points: newPoints, points_updated_at: new Date().toISOString().split('T')[0] }).eq('id', clientData.id);
        }
      }

      fetchData();
      setIsModalOpen(false);
      setNewBooking({
        client_name: '', color: '#4318ff', category: '', service: '', dates: [],
        delivery_date: '', base_price: 0, discount: 0, discount_reason: '', paid: 0, payment_method: 'vodafone_cash', notes: '', schedule_extra: false
      });
    } else {
      console.error(error);
      alert('حدث خطأ أثناء حفظ المواعيد');
    }
  };

  const remainingPrice = Math.max(0, newBooking.base_price - newBooking.discount - newBooking.paid);
  const legacySelectedService = services.find(service => service.name === newBooking.service);
  const showDelivery = ['reel','project'].includes(String(legacySelectedService?.billing_unit || '')) || isProjectServiceCategory(newBooking.category);
  const showCalendar = !showDelivery || newBooking.schedule_extra;
  const bookingCategoryGroups = activeServiceCategories(services);

  return (
    <div className="erp-bookings-page">
      {rescheduleNotice && <div className="booking-reschedule-notice" role="status"><CheckCircle size={17} />{rescheduleNotice}<button type="button" onClick={() => setRescheduleNotice('')} aria-label="إخفاء الرسالة"><X size={16}/></button></div>}
      <ERPBookingWideView
        selectedDate={selectedDate} onSelectDate={setSelectedDate} isAdmin={isAdmin} loading={loading} loadError={loadError} blockLoadError={isAdmin ? blockLoadError : ''} onRefresh={() => fetchData(true)}
        bookings={displayedBookings} blocks={displayedBlocks} events={clientColorsHydrated ? calendarEvents : []}
        query={bookingQuery} onQueryChange={setBookingQuery} status={bookingStatus} onStatusChange={setBookingStatus}
        pendingBookings={pendingBookings} decisionBusy={decisionBusy} decisionError={decisionError} onDecision={submitDecision}
        onAlternative={booking => setAlternativeModal({ open: true, booking, date: booking.date, start_time: normalizeTime(booking.start_time || '12:00'), end_time: normalizeTime(booking.end_time || '13:00', { endOfDay: true }), note: '' })}
        onNewBooking={trigger => { bookingTriggerRef.current = trigger; setIsModalOpen(true); }} onDayActions={openDayActionsForSelectedDate}
        onOpenBooking={openBookingDetails} onOpenBlock={(block, trigger) => { if (!isAdmin) return; blockDetailsTriggerRef.current = trigger; setBlockError(''); setSelectedBlock(block); }}
        onDateClick={handleDateClick} onDatesSet={handleCalendarDatesSet} onEventClick={handleEventClick} onRescheduleProposal={handleCalendarRescheduleProposal}
        calendarRootRef={bookingCalendarRef} getStatusMeta={getStatusMeta} getClientColor={getClientColor}
      />

      {/* Complex Booking Modal */}
      {isModalOpen && newBooking.category === '__legacy_booking_modal__' && (
        <div className="erp-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'var(--erp-surface)', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '25px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: 'none' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ background: '#1e293b', color: 'white', padding: '25px', borderTopLeftRadius: '25px', borderTopRightRadius: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h5 style={{ margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                <CalendarPlus color="var(--erp-warning)" size={24} style={{ marginLeft: '10px' }} /> تسجيل موعد أو شراء خدمة
              </h5>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleSaveBooking} className="erp-modal-inner" style={{ padding: '25px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>اسم العميل</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select value={newBooking.client_name} onChange={handleClientChange} required style={{ flex: 1, background: 'var(--erp-bg)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                      <option value="" disabled>-- اختر العميل --</option>
                      {clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <input type="color" value={newBooking.color} onChange={e => setNewBooking({...newBooking, color: e.target.value})} style={{ width: '50px', border: 'none', padding: '0', borderRadius: '10px', height: '48px', cursor: 'pointer' }} title="لون العميل" />
                  </div>
                </div>
                
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>التصنيف الرئيسي</label>
                  <select value={newBooking.category} onChange={handleCategoryChange} required style={{ width: '100%', background: 'var(--erp-bg)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-primary)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    <option value="" disabled>-- التصنيف --</option>
                    {bookingCategoryGroups.map(group => <option key={group.value} value={group.value}>{group.label} ({group.services.length.toLocaleString('ar-EG')})</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>اسم الخدمة</label>
                  <select value={newBooking.service} onChange={handleServiceChange} required disabled={!newBooking.category} style={{ width: '100%', background: 'var(--erp-bg)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    <option value="" disabled>-- اختر الخدمة --</option>
                    {services.filter(s => Number(s.is_active ?? 1) === 1 && !s.archived_at && s.category === newBooking.category).map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr style={{ opacity: 0.1, margin: '20px 0' }} />

              {showDelivery && (
                <div style={{ background: 'rgba(67, 24, 255, 0.05)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(67, 24, 255, 0.2)', marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                  <input type="checkbox" id="schedExtraCb" checked={newBooking.schedule_extra} onChange={e => setNewBooking({...newBooking, schedule_extra: e.target.checked})} style={{ transform: 'scale(1.5)', marginLeft: '15px', cursor: 'pointer' }} />
                  <label htmlFor="schedExtraCb" style={{ fontWeight: 'bold', color: 'var(--erp-primary)', cursor: 'pointer', margin: 0 }}>تحديد موعد لخدمة المشروع أو الريلز في التقويم الآن</label>
                </div>
              )}

              {showCalendar && (
                <div style={{ marginBottom: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-primary)', margin: 0 }}>
                      <Pointer size={14} style={{ display: 'inline', marginLeft: '5px' }} /> اضغط على اليوم في التقويم لإضافته
                    </label>
                  </div>
                  
                  <div style={{ border: '1px solid var(--erp-border)', borderRadius: '15px', padding: '10px', background: 'var(--erp-surface)', marginBottom: '20px' }}>
                    <FullCalendar
                      plugins={[ dayGridPlugin, interactionPlugin ]}
                      initialView="dayGridMonth"
                      locales={[arCalendarLocale]}
                      locale="ar"
                      buttonText={{ today: 'اليوم', month: 'شهر', week: 'أسبوع', day: 'يوم', list: 'قائمة' }}
                      direction="rtl"
                      firstDay={6}
                      events={calendarEvents}
                      height={350}
                      headerToolbar={{ left: 'prev,next', center: 'title', right: 'today' }}
                      dateClick={(info) => addDateRow(info.dateStr)}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {newBooking.dates.map((dRow, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--erp-surface)', padding: '15px', borderRadius: '15px', border: '1px solid var(--erp-border)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>تاريخ الجلسة</label>
                          <input type="date" value={dRow.date} onChange={(e) => updateDateRow(idx, 'date', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', color: 'var(--erp-primary)', fontWeight: 'bold' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>من الساعة</label>
                          <BusinessTimeSelect min="00:00" max="23:45" value={dRow.start_time} onChange={(e) => updateDateRow(idx, 'start_time', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', fontWeight: 'bold' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>إلى الساعة</label>
                          <BusinessTimeSelect min="00:15" max="24:00" value={dRow.end_time} onChange={(e) => updateDateRow(idx, 'end_time', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', fontWeight: 'bold' }} />
                        </div>
                        <button type="button" onClick={() => removeDateRow(idx)} style={{ background: 'var(--erp-bg)', color: 'var(--erp-danger)', border: 'none', width: '42px', height: '42px', borderRadius: '50%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showDelivery && (
                <div style={{ background: 'rgba(255, 193, 7, 0.1)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255, 193, 7, 0.3)', marginBottom: '25px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <Truck size={16} style={{ marginLeft: '8px' }} /> موعد التسليم المتفق عليه
                  </label>
                  <input type="date" value={newBooking.delivery_date} onChange={e => setNewBooking({...newBooking, delivery_date: e.target.value})} required style={{ width: '100%', border: 'none', background: 'var(--erp-surface)', padding: '12px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }} />
                </div>
              )}

              {/* Finance Box */}
              <div className="erp-modal-inner" style={{ background: 'var(--erp-bg)', border: '1px solid var(--erp-border)', padding: '25px', borderRadius: '20px', marginBottom: '25px' }}>
                <h6 style={{ margin: '0 0 20px 0', fontWeight: 'bold', color: 'var(--erp-text-main)', display: 'flex', alignItems: 'center' }}>
                  <DollarSign color="var(--erp-primary)" size={20} style={{ marginLeft: '10px' }} /> تفاصيل الحساب والدفع
                </h6>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>السعر الأساسي</label>
                    <div style={{ display: 'flex', background: 'var(--erp-surface)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                      <input type="number" value={newBooking.base_price} readOnly style={{ flex: 1, border: 'none', padding: '10px', textAlign: 'center', fontWeight: 'bold', color: 'var(--erp-text-main)', background: 'transparent' }} />
                      <span style={{ padding: '10px', color: 'var(--erp-text-muted)', background: 'var(--erp-surface)' }}>ج.م</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--erp-danger)', marginBottom: '5px', display: 'block' }}>قيمة الخصم</label>
                    <div style={{ display: 'flex', background: 'rgba(220, 53, 69, 0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                      <input type="number" value={newBooking.discount} onChange={e => setNewBooking({...newBooking, discount: Number(e.target.value)})} min="0" style={{ flex: 1, border: 'none', padding: '10px', textAlign: 'center', fontWeight: 'bold', color: 'var(--erp-danger)', background: 'transparent' }} />
                      <span style={{ padding: '10px', color: 'var(--erp-danger)' }}>ج.م</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--erp-success)', marginBottom: '5px', display: 'block' }}>المدفوع الآن</label>
                    <div style={{ display: 'flex', background: 'rgba(25, 135, 84, 0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                      <input type="number" value={newBooking.paid} onChange={e => setNewBooking({...newBooking, paid: Number(e.target.value)})} min="0" style={{ flex: 1, border: 'none', padding: '10px', textAlign: 'center', fontWeight: 'bold', color: 'var(--erp-success)', background: 'transparent' }} />
                      <span style={{ padding: '10px', color: 'var(--erp-success)' }}>ج.م</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--erp-primary)', marginBottom: '5px', display: 'block' }}>المتبقي للدفع</label>
                    <div style={{ display: 'flex', background: 'var(--erp-surface)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                      <input type="number" value={remainingPrice} readOnly style={{ flex: 1, border: 'none', padding: '10px', textAlign: 'center', fontWeight: 'bold', color: 'var(--erp-primary)', background: 'transparent' }} />
                      <span style={{ padding: '10px', color: 'var(--erp-text-muted)', background: 'var(--erp-surface)' }}>ج.م</span>
                    </div>
                  </div>
                </div>

                <input type="text" value={newBooking.discount_reason} onChange={e => setNewBooking({...newBooking, discount_reason: e.target.value})} placeholder="سبب الخصم (إن وجد)... مثال: عرض خاص، تعويض..." style={{ width: '100%', border: 'none', background: 'var(--erp-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>إيداع الدفعة في (خزينة)</label>
                  <select value={newBooking.payment_method} onChange={e => setNewBooking({...newBooking, payment_method: e.target.value})} style={{ width: '100%', background: 'var(--erp-surface)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    {Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>ملاحظات إضافية للموعد</label>
                  <input type="text" value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} placeholder="اكتب هنا أي تفاصيل إضافية..." style={{ width: '100%', border: 'none', background: 'var(--erp-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }} />
                </div>
              </div>

              <button type="submit" style={{ width: '100%', background: '#1e293b', color: 'white', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.2s' }}>
                اعتماد وتسجيل في النظام <CheckCircle size={20} style={{ marginRight: '10px' }} />
              </button>

            </form>
          </div>
        </div>
      )}

      <ERPAddBookingModal isOpen={isModalOpen} returnFocusRef={bookingTriggerRef} onClose={() => setIsModalOpen(false)} onSuccess={async () => { setIsModalOpen(false); await fetchData(true); }}/>

      <ERPBookingDayActionsDialog date={selectedDate} isOpen={dayActionsOpen} returnFocusRef={dayActionTriggerRef} onClose={() => setDayActionsOpen(false)} onTemporary={() => openBlockDialogForSelectedDate(dayActionTriggerRef.current)} onDirect={() => { setDayActionsOpen(false); directSessionTriggerRef.current=dayActionTriggerRef.current; setDirectSessionOpen(true); }}/>
      <ERPDirectSessionDialog isOpen={directSessionOpen} date={selectedDate} clients={clients} resources={resources} returnFocusRef={directSessionTriggerRef} onClose={() => setDirectSessionOpen(false)} onSuccess={async result => { setDirectSessionOpen(false); setRescheduleNotice(`بدأت جلسة تصوير ${result?.booking?.client_name || ''} بنجاح.`); await fetchData(true); window.dispatchEvent(new CustomEvent('erpSessionChanged', { detail: { bookingId: result?.booking?.id, packageId: null, session: result?.session } })); }}/>
      <ERPBookingBlockDialog isOpen={blockDialogOpen} date={selectedDate} resources={resources} returnFocusRef={blockTriggerRef} onClose={() => setBlockDialogOpen(false)} onSuccess={handleBlockCreated}/>
      <ERPBookingBlockDetailsDialog block={selectedBlock} busy={blockBusy} error={blockError} clients={clients} packages={clientPackages} services={services} returnFocusRef={blockDetailsTriggerRef} onClose={() => setSelectedBlock(null)} onCancel={cancelBookingBlock} onConvert={async payload => { setBlockBusy(true); setBlockError(''); const { data, error } = await dataClient.request(`/booking-blocks/${selectedBlock.id}/convert`, { method: 'POST', body: JSON.stringify(payload) }); setBlockBusy(false); if(error) return setBlockError(error.message || 'تعذر تحويل الحجز.'); setSelectedBlock(null); setRescheduleNotice(`تم تحويل الحجز المؤقت إلى موعد مؤكد للعميل ${data?.booking?.client_name || ''}.`); await fetchData(true); window.dispatchEvent(new CustomEvent('erpBookingsUpdated', { detail: { topics: ['bookings','client_packages'] } })); }}/>

      <ERPBookingDetailsDialog
        booking={selectedBookingDetails}
        isAdmin={isAdmin}
        isOwner={isOwner}
        busy={decisionBusy}
        error={decisionError}
        status={selectedBookingDetails ? getStatusMeta(selectedBookingDetails.status) : getStatusMeta('')}
        returnFocusRef={detailsTriggerRef}
        onClose={() => setSelectedBookingDetails(null)}
        onStart={handleStartBooking}
        onCancel={() => cancelBooking(selectedBookingDetails?.id)}
        onReschedule={trigger => openReschedule(selectedBookingDetails, null, trigger)}
      />

      {/* Legacy markup kept hidden as a no-script compatibility snapshot; the live flow above is React-controlled. */}
      <div className="modal fade" id="bookingDetailsModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg rounded-5">
            {selectedBookingDetails && (
              <>
                <div className="modal-header bg-dark text-white border-0 p-4">
                  <h5 className="fw-bold m-0"><i className="fas fa-calendar-check me-2 text-warning"></i> تفاصيل الحجز</h5>
                  <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div className="modal-body p-4 bg-light text-end" style={{ direction: 'rtl' }}>
                  
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-primary m-0">{selectedBookingDetails.client_name}</h4>
                    <span className="badge rounded-pill px-3 py-2 fs-6" style={{ background: getStatusMeta(selectedBookingDetails.status).color, color: '#fff' }}>
                      {getStatusMeta(selectedBookingDetails.status).label}
                    </span>
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-12 col-md-6">
                      <div className="p-3 bg-white rounded-4 border shadow-sm h-100">
                        <small className="text-muted d-block mb-1 fw-bold">الخدمة / الباقة</small>
                        <div className="fw-bold text-dark">{selectedBookingDetails.service}</div>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="p-3 bg-white rounded-4 border shadow-sm h-100">
                        <small className="text-muted d-block mb-1 fw-bold">التاريخ</small>
                        <div className="fw-bold text-dark">{formatBookingDate(selectedBookingDetails.date)}</div>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="p-3 bg-white rounded-4 border shadow-sm">
                        <small className="text-muted d-block mb-1 fw-bold">التوقيت</small>
                        <div className="fw-bold text-dark d-flex align-items-center gap-2">
                          <span className="text-primary">{formatTime12(selectedBookingDetails.start_time)}</span>
                          <i className="fas fa-arrow-left text-muted"></i> 
                          <span className="text-danger">{formatTime12(selectedBookingDetails.end_time)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-4 border shadow-sm mb-4">
                    <div className="row text-center">
                      <div className="col-4 border-end">
                        <small className="text-muted d-block mb-1 fw-bold">المدة</small>
                        <div className="fw-bold fs-5">{formatDurationMinutes(Number(selectedBookingDetails.actual_seconds || 0) > 0 ? Number(selectedBookingDetails.actual_seconds) / 60 : Number(selectedBookingDetails.duration_minutes || 0) || (Number(selectedBookingDetails.actual_hours || 0) * 60))}</div>
                      </div>
                      <div className="col-4 border-end">
                        <small className="text-muted d-block mb-1 fw-bold">الريلز</small>
                        <div className="fw-bold fs-5">{selectedBookingDetails.actual_reels || 0}</div>
                      </div>
                      <div className="col-4">
                        <small className="text-muted d-block mb-1 fw-bold">الدفعة</small>
                        <div className="fw-bold fs-5 text-success">{selectedBookingDetails.payment || 0}ج</div>
                      </div>
                    </div>
                  </div>

                  {selectedBookingDetails.notes && (
                    <div className="p-3 bg-warning-subtle rounded-4 border border-warning mb-4">
                      <small className="text-warning-emphasis d-block mb-1 fw-bold"><i className="fas fa-sticky-note me-1"></i> ملاحظات</small>
                      <div className="fw-bold text-dark">{selectedBookingDetails.notes}</div>
                    </div>
                  )}

                  <div className="d-flex gap-2 mt-4">
                    {selectedBookingDetails.status === 'confirmed' && (
                      <button disabled={decisionBusy === `start-${selectedBookingDetails.id}`} className="btn btn-success flex-grow-1 py-3 rounded-4 fw-bold" onClick={handleStartBooking}>
                        <i className="fas fa-play-circle me-1"></i> {decisionBusy === `start-${selectedBookingDetails.id}` ? 'جارٍ التشغيل...' : 'بدء جلسة التصوير'}
                      </button>
                    )}
                    {selectedBookingDetails.status === 'in_progress' && <div className="alert alert-primary flex-grow-1 m-0 py-3 rounded-4 fw-bold">التايمر يعمل الآن — أنهِ الجلسة من شريط التايمر.</div>}
                    {isAdmin && selectedBookingDetails.status === 'confirmed' && (
                      <button className="btn btn-outline-primary py-3 rounded-4 fw-bold px-4" onClick={event => openReschedule(selectedBookingDetails, null, event.currentTarget)}>
                        <CalendarClock size={17} /> تغيير الموعد
                      </button>
                    )}
                    {isAdmin && !['in_progress', 'completed', 'cancelled', 'منتهي'].includes(selectedBookingDetails.status) && (
                      <button disabled={decisionBusy === `cancel-${selectedBookingDetails.id}`} className="btn btn-outline-danger py-3 rounded-4 fw-bold px-4" onClick={() => cancelBooking(selectedBookingDetails.id)}>
                        <i className="fas fa-trash me-1"></i> {decisionBusy === `cancel-${selectedBookingDetails.id}` ? 'جارٍ الحذف...' : 'حذف الموعد'}
                      </button>
                    )}
                  </div>
                  {decisionError && <div className="alert alert-danger mt-3 mb-0">{decisionError}</div>}

                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {alternativeModal.open && (
        <div className="erp-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, background: 'rgba(15,23,42,.72)', backdropFilter: 'blur(4px)' }} onClick={() => setAlternativeModal({ ...alternativeModal, open: false })}>
          <div style={{ width: 'min(520px, calc(100% - 24px))', background: 'var(--erp-surface)', borderRadius: '18px', borderTop: '4px solid #268bd2', boxShadow: '0 24px 60px rgba(0,0,0,.28)', padding: '24px' }} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="اقتراح موعد بديل">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}><div><span style={{ color: '#268bd2', fontWeight: 800, fontSize: '.72rem' }}>قرار طلب الحجز</span><h4 style={{ margin: '5px 0', color: 'var(--erp-text-main)', fontWeight: 900 }}>اقتراح موعد بديل</h4><p style={{ margin: 0, color: 'var(--erp-text-muted)', fontSize: '.78rem' }}>للعميل: {alternativeModal.booking?.client_name}</p></div><button type="button" onClick={() => setAlternativeModal({ ...alternativeModal, open: false })} style={{ border: 0, background: 'transparent', color: 'var(--erp-text-muted)', cursor: 'pointer' }} aria-label="إغلاق"><X/></button></div>
            {decisionError && <div className="decision-error" style={{ marginTop: '15px' }}>{decisionError}</div>}
            <form onSubmit={submitAlternative} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
              <label style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--erp-text-muted)' }}>التاريخ البديل<input required type="date" value={alternativeModal.date} onChange={e => setAlternativeModal({ ...alternativeModal, date: e.target.value })} style={{ width: '100%', marginTop: '7px', padding: '11px', border: '1px solid var(--erp-border)', borderRadius: '8px', background: 'var(--erp-bg)', color: 'var(--erp-text-main)' }}/></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}><label style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--erp-text-muted)' }}>من<BusinessTimeSelect required min="00:00" max="23:45" value={alternativeModal.start_time} onChange={e => setAlternativeModal({ ...alternativeModal, start_time: e.target.value })} style={{ width: '100%', marginTop: '7px', padding: '11px', border: '1px solid var(--erp-border)', borderRadius: '8px', background: 'var(--erp-bg)', color: 'var(--erp-text-main)' }}/></label><label style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--erp-text-muted)' }}>إلى<BusinessTimeSelect required min="00:15" max="24:00" value={alternativeModal.end_time} onChange={e => setAlternativeModal({ ...alternativeModal, end_time: e.target.value })} style={{ width: '100%', marginTop: '7px', padding: '11px', border: '1px solid var(--erp-border)', borderRadius: '8px', background: 'var(--erp-bg)', color: 'var(--erp-text-main)' }}/></label></div>
              <label style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--erp-text-muted)' }}>ملاحظة للعميل<textarea rows="3" value={alternativeModal.note} onChange={e => setAlternativeModal({ ...alternativeModal, note: e.target.value })} style={{ width: '100%', marginTop: '7px', padding: '11px', border: '1px solid var(--erp-border)', borderRadius: '8px', background: 'var(--erp-bg)', color: 'var(--erp-text-main)', resize: 'vertical' }}/></label>
              <p style={{ padding: '10px', background: 'rgba(38,139,210,.08)', color: '#267ab0', borderRight: '3px solid #268bd2', margin: 0, fontSize: '.7rem' }}>أقل مدة ساعة، والزيادة كل 15 دقيقة، الحجز متاح طوال اليوم.</p>
              <button type="submit" disabled={Boolean(decisionBusy)} style={{ border: 0, borderRadius: '9px', background: '#268bd2', color: 'white', padding: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>{decisionBusy ? <RefreshCw size={16} className="client-spin"/> : <Send size={16}/>} إرسال الموعد البديل</button>
            </form>
          </div>
        </div>
      )}

      <ERPRescheduleBookingDialog
        isOpen={rescheduleModal.open}
        booking={rescheduleModal.booking}
        proposal={rescheduleModal.proposal}
        service={services.find(service => String(service.id) === String(rescheduleModal.booking?.service_id) || service.name === rescheduleModal.booking?.service)}
        returnFocusRef={rescheduleTriggerRef}
        onClose={() => setRescheduleModal({ open: false, booking: null, proposal: null })}
        onSuccess={handleRescheduleSuccess}
      />

    </div>
  );
};

export default ERPBookings;
