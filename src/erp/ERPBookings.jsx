import { useState, useEffect, useRef } from 'react';
import { dataClient } from '../dataClient';
import { CalendarPlus, Trash2, Clock, Calendar as CalendarIcon, DollarSign, X, CheckCircle, Truck, Pointer, Check, Ban, RefreshCw, Send, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { ar as arDateLocale } from 'date-fns/locale';
import arCalendarLocale from '@fullcalendar/core/locales/ar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import { calculateDurationMinutes, formatBookingDate, formatTime12, isValidBusinessBooking, normalizeTime } from '../lib/businessFormat';
import ERPPageHero from './ERPPageHero';
import ERPRescheduleBookingDialog from './ERPRescheduleBookingDialog';
import ERPBookingDetailsDialog from './ERPBookingDetailsDialog';
import { startStudioSession } from './studioSessionStart';
import OwnerRecordActions from './OwnerRecordActions';
import ERPAddBookingModal from './ERPAddBookingModal';
import { activeServiceCategories, isProjectServiceCategory } from '../lib/serviceCategories';

// FullCalendar Imports
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';

let globalBookingsCache = null;
let globalClientsCache = null;
let globalServicesCache = null;
let globalBookingsLastFetch = 0;
const fallbackClientColor = '#4318ff';
const safeClientColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallbackClientColor;
const readableOnColor = value => {
  const hex = safeClientColor(value).slice(1);
  const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(channel => channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  return luminance > .179 ? '#111827' : '#ffffff';
};
const applyCalendarEventColors = info => {
  const background = safeClientColor(info.event.extendedProps.client_color);
  const foreground = readableOnColor(background);
  info.el.style.setProperty('--fc-event-bg-color', background);
  info.el.style.setProperty('--fc-event-border-color', background);
  info.el.style.setProperty('--fc-event-text-color', foreground);
  info.el.style.setProperty('background-color', background, 'important');
  info.el.style.setProperty('border-color', background, 'important');
  info.el.style.setProperty('color', foreground, 'important');
  info.el.querySelector('.fc-event-main')?.style.setProperty('color', foreground, 'important');
};

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
  const [loading, setLoading] = useState(!globalBookingsCache);
  const [clientColorsHydrated, setClientColorsHydrated] = useState(globalClientsCache !== null);
  
  // UI State
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  const [decisionBusy, setDecisionBusy] = useState(null);
  const [decisionError, setDecisionError] = useState('');
  const [alternativeModal, setAlternativeModal] = useState({ open: false, booking: null, date: '', start_time: '12:00', end_time: '13:00', note: '' });
  const [rescheduleModal, setRescheduleModal] = useState({ open: false, booking: null, proposal: null });
  const [rescheduleNotice, setRescheduleNotice] = useState('');
  const rescheduleTriggerRef = useRef(null);
  const detailsTriggerRef = useRef(null);
  const bookingTriggerRef = useRef(null);

  const isAdmin = ['owner', 'admin', 'operations'].includes(currentUser?.role);
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
    payment_method: 'فودافون كاش',
    notes: '',
    schedule_extra: false
  });

  const fetchData = async (force = false) => {
    if (globalBookingsCache && globalClientsCache && globalServicesCache) {
      setBookings(globalBookingsCache);
      setClients(globalClientsCache);
      setServices(globalServicesCache);
      setLoading(false);
      setClientColorsHydrated(true);
      if (!force && (Date.now() - globalBookingsLastFetch < 30000)) return;
    } else {
      setLoading(true);
    }
    
    const { data: bData } = await dataClient.from('bookings').select('*').order('date', { ascending: false });
    const { data: cData } = await dataClient.from('clients').select('id,name,color');
    const { data: sData } = await dataClient.from('services').select('*');

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
    
    globalBookingsLastFetch = Date.now();
    setLoading(false);
  };

  useEffect(() => { const timer = window.setTimeout(() => fetchData(), 0); return () => window.clearTimeout(timer); }, []);
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

  const getStatusMeta = (status) => statusMeta[status] || { label: status || 'غير محدد', color: '#6f5b82' };
  const pendingBookings = bookings.filter(b => b.status === 'pending');

  const calendarEvents = bookings.map(b => {
    const clientColor = getClientColor(b.client_name);
    return {
    id: b.id,
    title: `${formatTime12(b.start_time, '')} · ${b.client_name}`,
    start: calendarDateTime(b.date, b.start_time),
    end: calendarDateTime(b.date, b.end_time, true),
    allDay: false,
    backgroundColor: clientColor,
    borderColor: clientColor,
    textColor: readableOnColor(clientColor),
    editable: isAdmin && b.status === 'confirmed',
    startEditable: isAdmin && b.status === 'confirmed',
    durationEditable: isAdmin && b.status === 'confirmed',
    extendedProps: {
      booking_id: b.id,
      time: `${formatTime12(b.start_time)} - ${formatTime12(b.end_time)}`,
      status: b.status || 'مؤكد',
      service: b.service,
      original_end_time: normalizeTime(b.end_time || '13:00', { endOfDay: true }),
      reschedule_eligible: isAdmin && b.status === 'confirmed',
      client_color: clientColor,
      text_color: readableOnColor(clientColor)
    }
  }});

  const dailyBookings = bookings.filter(b => b.date === selectedDate);
  const clientColorSignature = clients.map(client => `${client.id}:${client.name}:${safeClientColor(client.color)}`).sort().join('|') || 'no-clients';

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
    setSelectedDate(arg.dateStr);
  };

  const openBookingDetails = (booking, trigger = null) => {
    detailsTriggerRef.current = trigger;
    setDecisionError('');
    setSelectedBookingDetails(booking);
  };

  const handleEventClick = (info) => {
    const bId = info.event.extendedProps.booking_id;
    const fullBooking = bookings.find(b => b.id === bId);
    if (fullBooking) {
      openBookingDetails(fullBooking, info.el || null);
    } else {
      alert('لم يتم العثور على تفاصيل الحجز، برجاء تحديث الصفحة.');
    }
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
    if (!window.confirm('هل تريد إلغاء هذا الموعد؟ سيظل محفوظًا في السجل ولن تُخصم ساعات منه.')) return;
    setDecisionBusy(`cancel-${id}`);
    const { error } = await dataClient.request(`/bookings/${id}/admin-cancel`, {
      method: 'POST',
      body: JSON.stringify({ charge: false, reason: 'إلغاء إداري دون خصم' }),
    });
    setDecisionBusy(null);
    if (error) return setDecisionError(error.message || 'تعذر إلغاء الموعد.');
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
            alert(`مواعيد الحجز من 12:00 م إلى 12:00 ص، بحد أدنى ${minimumMinutes} دقيقة وبزيادات ${incrementMinutes} دقيقة حسب إعدادات الخدمة.`);
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
          hours = diffInMinutes > 0 ? +(diffInMinutes / 60).toFixed(2) : 0;
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
    const insertedBookings = results.filter(result => !result.error).map(result => result.data);

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

      if (insertedBookings) {
        const remindersToInsert = [];
        insertedBookings.filter(b => b.delivery_date).forEach(b => {
             const dDate = new Date(b.delivery_date);
             // Reminder 1: Tomorrow
             remindersToInsert.push({
               title: `تسليم غداً لعميل: ${b.client_name}`,
               description: `تجهيز وتسليم خدمة ${b.service} الخاصة بحجز يوم ${b.date}.`,
               due_date: dDate.toISOString(),
               notify_before: 1440, // 24 hours
               status: 'pending'
             });
             // Reminder 2: Today
             remindersToInsert.push({
               title: `تسليم اليوم لعميل: ${b.client_name} 🚨`,
               description: `موعد التسليم النهائي لخدمة ${b.service} اليوم.`,
               due_date: dDate.toISOString(),
               notify_before: 0,
               status: 'pending'
             });
        });
        if (remindersToInsert.length > 0) {
          await dataClient.from('reminders').insert(remindersToInsert);
        }
      }

      fetchData();
      setIsModalOpen(false);
      setNewBooking({
        client_name: '', color: '#4318ff', category: '', service: '', dates: [],
        delivery_date: '', base_price: 0, discount: 0, discount_reason: '', paid: 0, payment_method: 'فودافون كاش', notes: '', schedule_extra: false
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
    <div>
      <style>{`
        .fc-theme-standard td, .fc-theme-standard th { border-color: var(--erp-border); }
        .fc-theme-standard .fc-scrollgrid { border: none; }
        .fc-col-header-cell { background-color: var(--erp-bg); padding: 10px 0; border-bottom: 2px solid var(--erp-border) !important; }
        .fc-col-header-cell-cushion { color: var(--erp-text-muted); font-weight: 700; font-size: 0.9rem; text-decoration: none; }
        .fc-daygrid-day-number { color: var(--erp-text-main); font-weight: 700; padding: 8px !important; text-decoration: none; transition: 0.2s; }
        .fc-daygrid-day-number:hover { background-color: var(--erp-border); border-radius: 50%; }
        .fc .fc-daygrid-day.fc-day-today { background-color: rgba(67, 24, 255, 0.05); }
        
        .selected-day-highlight { background-color: rgba(67, 24, 255, 0.1) !important; border: 2px solid var(--erp-primary) !important; border-radius: 8px; transition: all 0.2s ease-in-out; box-shadow: inset 0 0 10px rgba(67, 24, 255, 0.05); }
        .selected-day-highlight .fc-daygrid-day-number { color: var(--erp-primary) !important; }

        td.fc-day-fri { background-color: rgba(0,0,0,0.03) !important; border-color: var(--erp-border) !important; }
        th.fc-day-fri { background-color: rgba(0,0,0,0.05) !important; border-color: var(--erp-border) !important; }
        th.fc-day-fri .fc-col-header-cell-cushion { color: var(--erp-warning) !important; } 
        td.fc-day-fri .fc-daygrid-day-number { color: var(--erp-text-muted) !important; }
        td.fc-day-fri:hover { background-color: rgba(0,0,0,0.06) !important; }
        td.fc-day-fri .fc-daygrid-day-frame::before { content: "إجازة رسمية"; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 1.4rem; font-weight: 900; color: rgba(0,0,0, 0.05); pointer-events: none; z-index: 0; white-space: nowrap; }
        
        .fc-daygrid-day-events { position: relative; z-index: 1; }
        .fc-event { border: 1px solid var(--fc-event-border-color, currentColor) !important; border-radius: 6px !important; padding: 4px 6px; margin-bottom: 4px; font-size: 0.8rem; font-weight: 800; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .fc-daygrid-event, .fc-timegrid-event { opacity: 1 !important; filter: none; background-color: var(--fc-event-bg-color) !important; border-color: var(--fc-event-border-color) !important; }
        .fc-daygrid-event .fc-event-main, .fc-timegrid-event .fc-event-main { color: inherit !important; }
        .fc-event:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); filter: brightness(1.1); }
        .fc-event .fc-event-main { color: var(--fc-event-text-color) !important; }
        
        .fc-toolbar-title { font-weight: 800 !important; color: var(--erp-text-main) !important; font-size: 1.5rem !important; }
        .fc .fc-button-primary { background-color: var(--erp-surface); border: 1px solid var(--erp-border); color: var(--erp-text-muted); font-weight: 700; border-radius: 8px; text-transform: capitalize; transition: 0.2s; }
        .fc .fc-button-primary:hover { background-color: var(--erp-bg); border-color: var(--erp-text-muted); color: var(--erp-text-main); }
        .fc .fc-button-primary:not(:disabled).fc-button-active, .fc .fc-button-primary:not(:disabled):active { background-color: var(--erp-primary); border-color: var(--erp-primary); color: white; }
        
        .timeline-card { transition: all 0.3s ease; border-right: 4px solid var(--erp-primary); background: var(--erp-surface); }
        .timeline-card:hover { transform: translateX(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.05) !important; border-right-color: var(--erp-warning); }
        .timeline-time { font-size: 1.1rem; font-weight: 800; color: var(--erp-primary); letter-spacing: -0.5px; }
        .timeline-client { font-size: 1.1rem; font-weight: 800; color: var(--erp-text-main); }
        .timeline-service { font-size: 0.8rem; font-weight: 700; color: var(--erp-text-muted); background: var(--erp-bg); padding: 4px 10px; border-radius: 20px; display: inline-block; }

        .admin-delete-btn { cursor: pointer; opacity: 0.5; transition: 0.3s; color: var(--erp-danger); }
        .admin-delete-btn:hover { opacity: 1; transform: scale(1.2); color: #dc2626 !important; }
        .pending-requests-panel { background: var(--erp-surface); border: 1px solid var(--erp-border); border-top: 4px solid #d99124; border-radius: 18px; padding: 22px; margin-bottom: 24px; box-shadow: var(--erp-shadow); }
        .pending-requests-head { display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-bottom: 18px; }
        .pending-requests-title { display: flex; align-items: center; gap: 10px; margin: 0; color: var(--erp-text-main); font-size: 1.05rem; font-weight: 800; }
        .pending-count { min-width: 30px; height: 30px; padding: 0 9px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: #7a4a00; background: #ffe3b4; font-weight: 900; }
        .pending-requests-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
        .pending-request-card { border: 1px solid var(--erp-border); border-right: 4px solid #d99124; border-radius: 12px; padding: 16px; background: var(--erp-bg); }
        .pending-request-card h5 { margin: 0; color: var(--erp-text-main); font-weight: 800; }
        .pending-request-meta { display: flex; flex-wrap: wrap; gap: 7px 14px; color: var(--erp-text-muted); font-size: .78rem; margin: 10px 0 13px; }
        .pending-request-actions { display: flex; gap: 7px; flex-wrap: wrap; }
        .pending-request-actions button { border: 1px solid var(--erp-border); border-radius: 8px; padding: 8px 10px; font-weight: 700; font-size: .72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; background: var(--erp-surface); color: var(--erp-text-main); }
        .pending-request-actions .confirm { color: #158254; border-color: rgba(32,166,106,.35); }
        .pending-request-actions .alternative { color: #267ab0; border-color: rgba(38,139,210,.35); }
        .pending-request-actions .reject { color: #c13a4d; border-color: rgba(216,75,93,.35); }
        .pending-request-actions button:disabled { opacity: .45; cursor: wait; }
        .booking-status-pill { display: inline-flex; color: white; border-radius: 6px; padding: 3px 8px; font-size: .68rem; font-weight: 800; }
        .decision-error { background: rgba(216,75,93,.1); color: #c13a4d; border: 1px solid rgba(216,75,93,.25); padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; font-size: .78rem; }
        .booking-reschedule-notice { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 11px 14px; border: 1px solid rgba(32,166,106,.25); border-radius: 10px; background: rgba(32,166,106,.08); color: #158254; font-size: .78rem; font-weight: 800; }
        .fc-event.is-reschedule-eligible { cursor: grab; }
        .fc-event.is-reschedule-eligible:active { cursor: grabbing; }
        #bookingDetailsModal { display: none !important; }
        @media (max-width: 600px) { .pending-requests-panel { padding: 15px; } .pending-requests-list { grid-template-columns: 1fr; } .pending-request-actions button { flex: 1; justify-content: center; } }
      `}</style>

      {/* Header */}
      <ERPPageHero
        icon={CalendarIcon}
        eyebrow="جدول الاستديو"
        title="إدارة المواعيد والتقويم"
        description={<>{'اضغط مرتين على التقويم لبدء حجز جديد.'}{isAdmin && <> · يمكنك تعديل الموعد أو إلغاؤه مع الاحتفاظ بالسجل المحاسبي.</>}</>}
        actions={<button data-variant="primary" onClick={event => { bookingTriggerRef.current = event.currentTarget; setIsModalOpen(true); }}><CalendarPlus size={18} /> حجز موعد / إضافة خدمة</button>}
      />

      {rescheduleNotice && <div className="booking-reschedule-notice" role="status"><CheckCircle size={17} />{rescheduleNotice}<button type="button" onClick={() => setRescheduleNotice('')} style={{ marginRight: 'auto', border: 0, background: 'transparent', color: 'inherit' }} aria-label="إخفاء الرسالة"><X size={16}/></button></div>}

      <section className="pending-requests-panel" aria-labelledby="pending-requests-title">
        <div className="pending-requests-head">
          <h4 className="pending-requests-title" id="pending-requests-title"><Clock size={20} color="#d99124" /> طلبات بانتظار التأكيد <span className="pending-count">{pendingBookings.length}</span></h4>
          <button onClick={() => fetchData(true)} disabled={loading} style={{ border: 'none', background: 'transparent', color: 'var(--erp-primary)', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700 }}><RefreshCw size={15} className={loading ? 'client-spin' : ''}/> تحديث</button>
        </div>
        {decisionError && <div className="decision-error" role="alert">{decisionError}</div>}
        {pendingBookings.length === 0 ? (
          <div style={{ padding: '22px', textAlign: 'center', color: 'var(--erp-text-muted)', border: '1px dashed var(--erp-border)', borderRadius: '10px', fontSize: '.82rem' }}><CheckCircle size={23} style={{ marginBottom: '7px', color: 'var(--erp-success)' }}/><div>لا توجد طلبات جديدة بانتظار القرار.</div></div>
        ) : <div className="pending-requests-list">{pendingBookings.map(booking => <article className="pending-request-card" key={booking.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}><h5>{booking.client_name}</h5><span className="booking-status-pill" style={{ background: getStatusMeta(booking.status).color }}>{getStatusMeta(booking.status).label}</span></div>
          <div className="pending-request-meta"><span><CalendarIcon size={13}/> {formatBookingDate(booking.date)}</span><span><Clock size={13}/> {formatTime12(booking.start_time)} – {formatTime12(booking.end_time)}</span><span>{booking.service}</span></div>
          {booking.notes && <p style={{ color: 'var(--erp-text-muted)', fontSize: '.73rem', lineHeight: 1.7, margin: '0 0 12px' }}>{booking.notes}</p>}
          <div className="pending-request-actions"><button className="confirm" disabled={Boolean(decisionBusy)} onClick={() => submitDecision(booking, 'confirm')}><Check size={15}/> {decisionBusy === `confirm-${booking.id}` ? 'جارٍ التأكيد...' : 'تأكيد'}</button><button className="alternative" disabled={Boolean(decisionBusy)} onClick={() => setAlternativeModal({ open: true, booking, date: booking.date, start_time: normalizeTime(booking.start_time || '12:00'), end_time: normalizeTime(booking.end_time || '13:00', { endOfDay: true }), note: '' })}><CalendarPlus size={15}/> موعد بديل</button><button className="reject" disabled={Boolean(decisionBusy)} onClick={() => { if (window.confirm(`رفض طلب ${booking.client_name}؟`)) submitDecision(booking, 'reject'); }}><Ban size={15}/> {decisionBusy === `reject-${booking.id}` ? 'جارٍ الرفض...' : 'رفض'}</button></div>
        </article>)}</div>}
      </section>

      <div className="erp-bookings-layout">
        
        {/* FullCalendar Box */}
        <div className="erp-calendar-container">
          <div className="erp-calendar-inner" style={{ background: 'var(--erp-surface)', borderRadius: '20px', padding: '25px', boxShadow: 'var(--erp-shadow)', borderTop: '4px solid var(--erp-primary)', minHeight: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              <span style={{ color: 'var(--erp-primary)' }}>● مجدول</span>
              <span style={{ color: 'var(--erp-success)' }}>● منتهي</span>
              <span style={{ color: 'var(--erp-text-muted)' }}>● يوم الجمعة (إجازة)</span>
            </div>
            
            <FullCalendar
              key={`bookings-calendar-${clientColorsHydrated ? clientColorSignature : 'loading-colors'}`}
              plugins={[ dayGridPlugin, interactionPlugin, timeGridPlugin ]}
              initialView="dayGridMonth"
              locales={[arCalendarLocale]}
              locale="ar"
              buttonText={{ today: 'اليوم', month: 'شهر', week: 'أسبوع', day: 'يوم', list: 'قائمة' }}
              direction="rtl"
              firstDay={6}
              events={clientColorsHydrated ? calendarEvents : []}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventDisplay="block"
              eventDidMount={applyCalendarEventColors}
              editable={isAdmin}
              eventStartEditable={isAdmin}
              eventDurationEditable={isAdmin}
              eventDrop={handleCalendarRescheduleProposal}
              eventResize={handleCalendarRescheduleProposal}
              eventAllow={(dropInfo, draggedEvent) => Boolean(draggedEvent.extendedProps.reschedule_eligible) && dropInfo.start.getDay() !== 5}
              eventClassNames={arg => arg.event.extendedProps.reschedule_eligible ? ['is-reschedule-eligible'] : []}
              slotMinTime="12:00:00"
              slotMaxTime="24:00:00"
              allDaySlot={false}
              slotDuration="00:15:00"
              eventContent={(arg) => (
                <div style={{ overflow: 'hidden', lineHeight: 1.35, color: arg.event.extendedProps.text_color }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{arg.event.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.59rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><i aria-hidden="true" style={{ width: '7px', height: '7px', flex: '0 0 auto', borderRadius: '50%', background: getStatusMeta(arg.event.extendedProps.status).color, border: `1px solid ${arg.event.extendedProps.text_color}` }} />{getStatusMeta(arg.event.extendedProps.status).label}</div>
                </div>
              )}
              height="auto"
              headerToolbar={{
                right: 'dayGridMonth,timeGridWeek',
                center: 'title',
                left: 'prev,next today'
              }}
              dayCellClassNames={(arg) => {
                let classes = [];
                if (arg.date.getDay() === 5) classes.push('fc-day-fri');
                if (format(arg.date, 'yyyy-MM-dd') === selectedDate) classes.push('selected-day-highlight');
                return classes;
              }}
            />
          </div>
        </div>

        {/* Daily Bookings Sidebar */}
        <div className="erp-daily-bookings-container">
          <div style={{ background: 'var(--erp-surface)', borderRadius: '20px', display: 'flex', flexDirection: 'column', boxShadow: 'var(--erp-shadow)', borderTop: '4px solid #1e293b', height: '100%' }}>
            
            <div style={{ padding: '25px 25px 0 25px', textAlign: 'center' }}>
              <div style={{ background: 'rgba(67, 24, 255, 0.1)', color: 'var(--erp-primary)', display: 'inline-block', borderRadius: '50px', padding: '8px 25px', marginBottom: '15px', boxShadow: '0 2px 5px rgba(67,24,255,0.05)' }}>
                <i className="fas fa-calendar-day me-1"></i> جدول يوم: <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: arDateLocale })}</span>
              </div>
              <h5 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', margin: 0 }}>قائمة جلسات التصوير</h5>
              <hr style={{ opacity: 0.1, marginTop: '20px', marginBottom: 0 }} />
            </div>

            <div style={{ padding: '25px', overflowY: 'auto', flexGrow: 1, maxHeight: '600px' }}>
              {dailyBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ background: 'var(--erp-bg)', borderRadius: '50%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '80px', height: '80px', marginBottom: '15px' }}>
                    <Clock size={32} color="var(--erp-text-muted)" style={{ opacity: 0.5 }} />
                  </div>
                  <h6 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)' }}>يوم هادئ!</h6>
                  <p style={{ color: 'var(--erp-text-muted)', fontSize: '0.85rem' }}>لا توجد جلسات تصوير مجدولة.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {dailyBookings.map(b => (
                    <div key={b.id} className="timeline-card" style={{ padding: '15px', borderRadius: '12px', borderRightColor: getClientColor(b.client_name), opacity: b.status === 'منتهي' ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div className="timeline-time" style={{ color: 'var(--erp-text-main)', fontFamily: 'monospace' }}>
                          <span aria-hidden="true" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', marginLeft: 7, background: getClientColor(b.client_name), boxShadow: `0 0 0 2px ${getClientColor(b.client_name)}22` }} />
                          <Clock size={14} style={{ display: 'inline', marginLeft: '5px' }} />
                          {formatTime12(b.start_time)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {b.status === 'منتهي' ? (
                            <span style={{ background: 'var(--erp-success)', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>منتهي</span>
                          ) : (
                            <span style={{ background: 'var(--erp-primary)', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>مجدول</span>
                          )}
                          {isAdmin && (
                            <button type="button" className="admin-delete-btn" onClick={event => openBookingDetails(b, event.currentTarget)} aria-label={`فتح تفاصيل حجز ${b.client_name}`} style={{ border: 0, padding: 4, background: 'transparent' }}><Trash2 size={16} /></button>
                          )}
                        </div>
                      </div>
                      <h5 className="timeline-client" style={{ marginBottom: '10px', marginTop: 0 }}>{b.client_name}</h5>
                      <span className="timeline-service">{b.service}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

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
                      dayCellClassNames={(arg) => arg.date.getDay() === 5 ? ['fc-day-fri'] : []}
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
                          <BusinessTimeSelect min="12:00" max="23:00" value={dRow.start_time} onChange={(e) => updateDateRow(idx, 'start_time', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', fontWeight: 'bold' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>إلى الساعة</label>
                          <BusinessTimeSelect min="13:00" max="24:00" value={dRow.end_time} onChange={(e) => updateDateRow(idx, 'end_time', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', fontWeight: 'bold' }} />
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
                    <option value="كاش">كاش</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="انستاباي">إنستاباي</option>
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
        ownerActions={selectedBookingDetails && <OwnerRecordActions user={currentUser} entity="bookings" record={selectedBookingDetails} label={`${selectedBookingDetails.client_name} · ${formatBookingDate(selectedBookingDetails.date)}`} onEdit={selectedBookingDetails.status === 'confirmed' ? event => openReschedule(selectedBookingDetails, null, event.currentTarget) : null} onChanged={async () => { setSelectedBookingDetails(null); await fetchData(true); }} />}
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
                        <small className="text-muted d-block mb-1 fw-bold">الساعات</small>
                        <div className="fw-bold fs-5">{selectedBookingDetails.actual_hours || 0}</div>
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
                        <i className="fas fa-ban me-1"></i> {decisionBusy === `cancel-${selectedBookingDetails.id}` ? 'جارٍ الإلغاء...' : 'إلغاء الموعد'}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}><label style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--erp-text-muted)' }}>من<BusinessTimeSelect required min="12:00" max="23:00" value={alternativeModal.start_time} onChange={e => setAlternativeModal({ ...alternativeModal, start_time: e.target.value })} style={{ width: '100%', marginTop: '7px', padding: '11px', border: '1px solid var(--erp-border)', borderRadius: '8px', background: 'var(--erp-bg)', color: 'var(--erp-text-main)' }}/></label><label style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--erp-text-muted)' }}>إلى<BusinessTimeSelect required min="13:00" max="24:00" value={alternativeModal.end_time} onChange={e => setAlternativeModal({ ...alternativeModal, end_time: e.target.value })} style={{ width: '100%', marginTop: '7px', padding: '11px', border: '1px solid var(--erp-border)', borderRadius: '8px', background: 'var(--erp-bg)', color: 'var(--erp-text-main)' }}/></label></div>
              <label style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--erp-text-muted)' }}>ملاحظة للعميل<textarea rows="3" value={alternativeModal.note} onChange={e => setAlternativeModal({ ...alternativeModal, note: e.target.value })} style={{ width: '100%', marginTop: '7px', padding: '11px', border: '1px solid var(--erp-border)', borderRadius: '8px', background: 'var(--erp-bg)', color: 'var(--erp-text-main)', resize: 'vertical' }}/></label>
              <p style={{ padding: '10px', background: 'rgba(38,139,210,.08)', color: '#267ab0', borderRight: '3px solid #268bd2', margin: 0, fontSize: '.7rem' }}>أقل مدة ساعة، والزيادة كل 15 دقيقة، ضمن مواعيد العمل من 12:00 م إلى 12:00 ص.</p>
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
