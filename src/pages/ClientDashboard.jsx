import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign,
  Clock3, Eye, FileCheck2, FileText, FileUp, FolderKanban, Home, LogOut, RefreshCw, RotateCcw, Send, X, XCircle
} from 'lucide-react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import ClientDashboardOverview from './ClientDashboardOverview';
import ClientFinanceView from './ClientFinanceView';
import ClientProjectsView from './ClientProjectsView';
import './ClientProjectsView.css';
import useChangeSync from '../hooks/useChangeSync';
import {
  BUSINESS_HOURS_LABEL,
  formatBookingDate,
  formatEGP,
  formatTime12,
  calculateDurationMinutes,
  effectivePackageStatus,
  isValidBusinessBooking,
  normalizeTime,
} from '../lib/businessFormat';
import './ClientDashboard.css';
import { isStudioPackageService } from '../lib/serviceCatalog';

const STATUS_META = {
  pending: { label: 'بانتظار التأكيد', tone: 'waiting' },
  confirmed: { label: 'مؤكد', tone: 'success' },
  alternative_proposed: { label: 'موعد بديل مقترح', tone: 'info' },
  rejected: { label: 'مرفوض', tone: 'danger' },
  cancel_requested: { label: 'طلب الإلغاء قيد المراجعة', tone: 'waiting' },
  late_cancel_requested: { label: 'طلب إلغاء متأخر', tone: 'danger' },
  completed: { label: 'مكتمل', tone: 'success' },
  in_progress: { label: 'جارٍ الآن', tone: 'info' },
};

const initialBooking = { client_package_id: '', date: '', start_time: '12:00', end_time: '13:00', notes: '' };
const initialReschedule = { booking: null, date: '', start_time: '12:00', end_time: '13:00', reason: '' };
const previewDate = (days = 0) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const createLocalClientPreview = () => ({
  client: { id: 1, name: 'سارة أحمد', phone1: '01000000000', points: 180 },
  packages: [
    { id: 201, client_id: 1, service_id: 101, name: 'باقة صناعة المحتوى', billing_unit: 'hour', purchased_quantity: 10, held_quantity: 2, consumed_quantity: 5.5, payment_due_quantity: 5, paid_amount: 6000, total_price: 12000, starts_at: previewDate(-35), expires_at: previewDate(55), status: 'active' },
    { id: 9002, client_id: 'local-client-preview', service_id: 902, source_invoice_id: 9601, name: 'باقة الريلز الشهرية', billing_unit: 'reel', purchased_quantity: 8, held_quantity: 1, consumed_quantity: 3, payment_due_quantity: 0, paid_amount: 6500, total_price: 8000, starts_at: previewDate(-15), expires_at: previewDate(45), status: 'active' },
  ],
  bookings: [
    { id: 301, client_id: 1, client_name: 'سارة أحمد', client_package_id: 201, service: 'تصوير محتوى منتجات', date: previewDate(0), start_time: '13:00:00', end_time: '15:00:00', status: 'confirmed', requested_quantity: 2, notes: 'تصوير الحملة الصيفية' },
    { id: 9102, client_id: 'local-client-preview', client_name: 'سارة أحمد', client_package_id: 9002, service: 'تصوير ريلز', date: previewDate(11), start_time: '18:00:00', end_time: '19:30:00', status: 'pending', notes: '' },
    { id: 307, client_id: 1, client_name: 'سارة أحمد', client_package_id: 201, service: 'جلسة تصوير سابقة', date: previewDate(-10), start_time: '15:00:00', end_time: '16:45:00', status: 'completed', requested_quantity: 2, billable_quantity: 1.75, actual_seconds: 6300, notes: '' },
  ],
  payments: [
    { id: 9301, amount: 6500, method: 'تحويل بنكي', status: 'approved', reference: 'proof-9403', created_at: `${previewDate(-15)}T13:00:00`, reviewed_at: `${previewDate(-14)}T14:00:00` },
  ],
  proofs: [
    { id: 9401, client_package_id: 201, invoice_id: null, amount: 2000, original_name: 'instapay-preview.jpg', status: 'pending', created_at: `${previewDate(-2)}T16:30:00` },
    { id: 9402, client_package_id: null, invoice_id: 9601, amount: 1000, original_name: 'transfer-old.jpg', status: 'rejected', admin_note: 'الصورة غير واضحة، يرجى رفع إيصال كامل.', created_at: `${previewDate(-6)}T12:30:00` },
    { id: 9403, payment_id: 9301, client_package_id: null, invoice_id: 9601, amount: 6500, original_name: 'approved-transfer.jpg', status: 'approved', created_at: `${previewDate(-15)}T13:00:00` },
  ],
  services: [
    { id: 101, name: 'صناعة المحتوى', is_active: 1 },
    { id: 902, name: 'تصوير ريلز', is_active: 1 },
  ],
  offers: [{ id: 9501, created_by_role: 'owner', offer_number: 'OFF-PREVIEW-01', title: 'حملة إطلاق موسمية', subtotal: 18000, discount: 1500, total: 16500, valid_until: previewDate(14), status: 'sent', notes: 'يشمل التصوير والمونتاج والتسليم الرقمي.', items: [{ id: 1, description: 'إنتاج 6 فيديوهات قصيرة', quantity: 6, unit: 'reel', unit_price: 2000, total: 12000 }, { id: 2, description: 'جلسة تصوير منتجات', quantity: 5, unit: 'hour', unit_price: 1200, total: 6000 }] }],
  invoices: [{ id: 9601, invoice_number: 'INV-PREVIEW-01', total: 8000, paid_amount: 6500, issued_at: previewDate(-15), due_at: previewDate(7), status: 'issued' }],
  projects: [{
    id: 9701, client_id: 'local-client-preview', name: 'إطلاق منصة الحجز الجديدة', service_type: 'website',
    status: 'active', progress_percent: 62, starts_at: previewDate(-26), due_at: previewDate(24),
    financial: { total: 28000, paid: 18000, remaining: 10000, status: 'partial' },
    milestones: [
      { id: 1, title: 'جمع المتطلبات', status: 'completed' }, { id: 2, title: 'تصميم الواجهات', status: 'completed' },
      { id: 3, title: 'التطوير', status: 'active' }, { id: 4, title: 'المراجعة والتسليم', status: 'pending' },
    ],
    bookings: [{ id: 1, date: previewDate(7), start_time: '17:00:00', end_time: '18:00:00', status: 'confirmed' }],
    items: [{ id: 1, title: 'التصميم المتجاوب', status: 'completed' }, { id: 2, title: 'لوحة الإدارة', status: 'in_progress' }],
  }, {
    id: 9702, client_id: 'local-client-preview', name: 'حملة ريلز افتتاح الفرع', service_type: 'reels',
    status: 'planning', progress_percent: 18, starts_at: previewDate(-3), due_at: previewDate(18),
    financial: { total: 12000, paid: 4000, remaining: 8000, status: 'partial' },
    milestones: [{ id: 1, title: 'اعتماد الأفكار', status: 'active' }, { id: 2, title: 'التصوير', status: 'pending' }, { id: 3, title: 'المونتاج', status: 'pending' }, { id: 4, title: 'التسليم', status: 'pending' }],
    bookings: [{ id: 2, date: previewDate(11), start_time: '18:00:00', end_time: '19:30:00', status: 'pending' }], items: [],
  }],
});

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status || 'غير محدد', tone: 'neutral' };
  return <span className={`client-status client-status--${meta.tone}`}>{meta.label}</span>;
};

const timeLabel = (value) => formatTime12(value, '--:--');
const effectiveOfferStatus = offer => {
  if (offer?.status !== 'sent' || !offer.valid_until) return offer?.status;
  return new Date(`${offer.valid_until}T23:59:59`) < new Date() ? 'expired' : 'sent';
};

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { currentUser, logout } = useData();
  const clientId = currentUser?.client_id;
  const isLocalPreview = import.meta.env.DEV && currentUser?.role === 'client' && currentUser?.is_local_preview;
  const [activeTab, setActiveTab] = useState('home');
  const [client, setClient] = useState(null);
  const [packages, setPackages] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [services, setServices] = useState([]);
  const [offers, setOffers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionServerOffset, setSessionServerOffset] = useState(0);
  const [appNotifications, setAppNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [bookingForm, setBookingForm] = useState(initialBooking);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [reschedule, setReschedule] = useState(initialReschedule);
  const [actionBusy, setActionBusy] = useState(null);
  const [proofForm, setProofForm] = useState({ target: '', amount: '', file: null });
  const [proofBusy, setProofBusy] = useState(false);
  const [offerDetail, setOfferDetail] = useState(null);
  const [offerDetailBusy, setOfferDetailBusy] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptConfirm, setAcceptConfirm] = useState(false);
  const offerDialogRef = useRef(null);
  const offerTriggerRef = useRef(null);

  const fetchClientData = useCallback(async (background = false) => {
    if (!clientId) return;
    if (!background) setLoading(true);
    if (!background) setLoadError('');
    if (isLocalPreview) {
      const preview = createLocalClientPreview();
      const previewClientId = 1;
      const [clientResult, packagesResult, bookingsResult, paymentsResult, proofsResult, servicesResult, invoicesResult, projectsResult] = await Promise.all([
        supabase.from('clients').select('*').eq('id', previewClientId).single(),
        supabase.from('client_packages').select('*').eq('client_id', previewClientId).order('expires_at', { ascending: true }),
        supabase.from('bookings').select('*').eq('client_id', previewClientId).order('date', { ascending: false }),
        supabase.from('payments').select('*').eq('client_id', previewClientId).order('created_at', { ascending: false }),
        supabase.from('payment_proofs').select('*').eq('client_id', previewClientId).order('created_at', { ascending: false }),
        supabase.from('services').select('*').eq('is_active', 1),
        supabase.from('invoices').select('*').eq('client_id', previewClientId).order('issued_at', { ascending: false }),
        supabase.request('/client/projects', { method: 'GET' }),
      ]);
      const availableServices = servicesResult.data || preview.services;
      const studioServiceIds = new Set(availableServices.filter(isStudioPackageService).map(service => Number(service.id)));
      setClient(clientResult.data || preview.client);
      setPackages((packagesResult.data || preview.packages).filter(pkg => studioServiceIds.has(Number(pkg.service_id))));
      setBookings(bookingsResult.data || preview.bookings);
      setPayments(paymentsResult.data || preview.payments);
      setProofs(proofsResult.data || preview.proofs);
      setServices(availableServices);
      setOffers(preview.offers);
      setInvoices(invoicesResult.data || preview.invoices);
      setProjects(projectsResult.data?.projects || preview.projects);
      setActiveSessions([]);
      setAppNotifications([]);
      setLoading(false);
      return;
    }
    const [clientResult, packagesResult, bookingsResult, paymentsResult, proofsResult, servicesResult, offersResult, invoicesResult, sessionsResult, notificationsResult, projectsResult] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('client_packages').select('*').eq('client_id', clientId).order('expires_at', { ascending: true }),
      supabase.from('bookings').select('*').eq('client_id', clientId).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('payment_proofs').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('services').select('*').eq('is_active', 1),
      supabase.request('/client/offers', { method: 'GET' }),
      supabase.from('invoices').select('*').eq('client_id', clientId).order('issued_at', { ascending: false }),
      supabase.request('/studio-sessions/active', { method: 'GET' }),
      supabase.request('/app-notifications', { method: 'GET' }),
      supabase.request('/client/projects', { method: 'GET' }),
    ]);
    const error = [clientResult, packagesResult, bookingsResult, paymentsResult, proofsResult, servicesResult, offersResult, invoicesResult, sessionsResult, notificationsResult, projectsResult].find(result => result.error)?.error;
    if (error) {
      setLoadError(error.message || 'تعذر تحميل بيانات حسابك. حاول مرة أخرى.');
    } else {
      setClient(clientResult.data);
      const availableServices = servicesResult.data || [];
      const studioServiceIds = new Set(availableServices.filter(isStudioPackageService).map(service => Number(service.id)));
      setPackages((packagesResult.data || []).filter(pkg => studioServiceIds.has(Number(pkg.service_id))));
      setBookings(bookingsResult.data || []);
      setPayments(paymentsResult.data || []);
      setProofs(proofsResult.data || []);
      setServices(availableServices);
      setOffers((offersResult.data || []).filter(offer => offer.status !== 'draft').map(offer => ({ ...offer, status: effectiveOfferStatus(offer) })));
      setInvoices(invoicesResult.data || []);
      setActiveSessions(sessionsResult.data?.items || []);
      if (sessionsResult.data?.server_now) setSessionServerOffset(new Date(sessionsResult.data.server_now).getTime() - Date.now());
      setAppNotifications(notificationsResult.data || []);
      setProjects(projectsResult.data?.projects || []);
    }
    if (!background) setLoading(false);
  }, [clientId, isLocalPreview]);

  // The dashboard data is remote session state and must be synchronized on identity change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchClientData(); }, [fetchClientData]);
  useChangeSync(useCallback((topics) => {
    if (topics.some(topic => ['bookings', 'client_packages', 'finance', 'notifications', 'offers', 'services', 'projects'].includes(topic))) fetchClientData(true);
  }, [fetchClientData]), Boolean(clientId) && !isLocalPreview);

  const activePackages = useMemo(() => packages.filter(pkg => effectivePackageStatus(pkg) === 'active'), [packages]);
  const upcomingBookings = useMemo(() => bookings
    .filter(item => {
      const startTime = normalizeTime(item.start_time);
      if (!item.date || !startTime || ['rejected', 'completed'].includes(item.status)) return false;
      return new Date(`${item.date}T${startTime}:00`) >= new Date();
    })
    .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)), [bookings]);

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 6 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 6 }),
  }), [currentMonth]);

  const selectedBookings = bookings.filter(item => isSameDay(new Date(`${item.date}T12:00:00`), selectedDay));

  const serviceForPackage = (pkg) => services.find(service => Number(service.id) === Number(pkg.service_id));

  const showNotice = (type, message) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    if (isLocalPreview) return showNotice('success', 'هذه معاينة محلية؛ لم يُرسل أي طلب إلى الخادم.');
    const pkg = activePackages.find(item => String(item.id) === String(bookingForm.client_package_id));
    if (!pkg) return showNotice('error', 'اختر الباقة التي تريد الحجز منها.');
    const service = serviceForPackage(pkg);
    const minimum = Math.max(15, Number(service?.minimum_booking_minutes || 60));
    const increment = Math.max(15, Number(service?.booking_increment_minutes || 15));
    const duration = calculateDurationMinutes(bookingForm.start_time, bookingForm.end_time);
    if (!isValidBusinessBooking(bookingForm.start_time, bookingForm.end_time, minimum) || duration % increment !== 0) {
      return showNotice('error', `راجع الوقت: أقل حجز ${minimum} دقيقة، والزيادة كل ${increment} دقيقة، ${BUSINESS_HOURS_LABEL}.`);
    }
    setBookingBusy(true);
    const { error } = await supabase.request('/bookings/request', {
      method: 'POST',
      body: JSON.stringify({
        client_package_id: Number(pkg.id), service_id: service?.id || pkg.service_id,
        service: pkg.name, date: bookingForm.date, start_time: bookingForm.start_time,
        end_time: bookingForm.end_time, notes: bookingForm.notes,
      }),
    });
    setBookingBusy(false);
    if (error) return showNotice('error', error.message || 'تعذر إرسال طلب الحجز.');
    setBookingForm(initialBooking);
    showNotice('success', 'تم إرسال طلب الحجز، وحالته الآن بانتظار التأكيد.');
    await fetchClientData();
  };

  const submitReschedule = async (event) => {
    event.preventDefault();
    const pkg = activePackages.find(item => Number(item.id) === Number(reschedule.booking?.client_package_id));
    const service = pkg ? serviceForPackage(pkg) : services.find(item => Number(item.id) === Number(reschedule.booking?.service_id));
    const minimum = Math.max(15, Number(service?.minimum_booking_minutes || 60));
    const increment = Math.max(15, Number(service?.booking_increment_minutes || 15));
    const duration = calculateDurationMinutes(reschedule.start_time, reschedule.end_time);
    if (!isValidBusinessBooking(reschedule.start_time, reschedule.end_time, minimum) || duration % increment !== 0) {
      showNotice('error', `الموعد البديل يجب أن يكون ${BUSINESS_HOURS_LABEL}، بحد أدنى ${minimum} دقيقة وبزيادات ${increment} دقيقة.`);
      return;
    }
    if (isLocalPreview) {
      setReschedule(initialReschedule);
      showNotice('success', 'تمت محاكاة طلب تغيير الموعد محليًا دون تعديل أي بيانات.');
      return;
    }
    setActionBusy(`reschedule-${reschedule.booking.id}`);
    const { error } = await supabase.request('/reschedule-requests', {
      method: 'POST', body: JSON.stringify({ booking_id: reschedule.booking.id, date: reschedule.date,
        start_time: reschedule.start_time, end_time: reschedule.end_time, reason: reschedule.reason }),
    });
    setActionBusy(null);
    if (error) return showNotice('error', error.message || 'تعذر إرسال طلب تغيير الموعد.');
    setReschedule(initialReschedule);
    showNotice('success', 'تم إرسال طلب تغيير الموعد للإدارة.');
  };

  const requestCancel = async (booking) => {
    if (isLocalPreview) return showNotice('success', `تمت محاكاة طلب إلغاء ${booking.service} محليًا.`);
    const reason = window.prompt('سبب الإلغاء (اختياري):') ?? null;
    if (reason === null) return;
    setActionBusy(`cancel-${booking.id}`);
    const { error } = await supabase.request(`/bookings/${booking.id}/cancel-request`, {
      method: 'POST', body: JSON.stringify({ reason }),
    });
    setActionBusy(null);
    if (error) return showNotice('error', error.message || 'تعذر إرسال طلب الإلغاء.');
    showNotice('success', 'تم إرسال طلب الإلغاء للإدارة.');
    await fetchClientData();
  };

  const decideAlternative = async (booking, action) => {
    if (isLocalPreview) return showNotice('success', action === 'accept' ? 'تمت محاكاة قبول الموعد البديل.' : 'تمت محاكاة طلب موعد آخر.');
    setActionBusy(`alternative-${action}-${booking.id}`);
    const { error } = await supabase.request(`/bookings/${booking.id}/alternative-decision`, { method: 'POST', body: JSON.stringify({ action }) });
    setActionBusy(null);
    if (error) return showNotice('error', error.message || 'تعذر حفظ قرار الموعد البديل.');
    showNotice('success', action === 'accept' ? 'تم تأكيد الموعد البديل.' : 'تم إبلاغ الإدارة بطلب موعد آخر.');
    await fetchClientData();
  };

  const uploadProof = async (event) => {
    event.preventDefault();
    if (!proofForm.file || !proofForm.target) return;
    if (isLocalPreview) return showNotice('success', 'تم رفع التحويل وهو الآن قيد مراجعة المالك. هذه معاينة محلية ولم تُحفظ بيانات.');
    const [targetType, targetId] = proofForm.target.split(':');
    const body = new FormData();
    body.append('amount', proofForm.amount);
    body.append('proof', proofForm.file);
    body.append(targetType === 'package' ? 'client_package_id' : 'invoice_id', targetId);
    setProofBusy(true);
    const { error } = await supabase.request('/payment-proofs', { method: 'POST', body });
    setProofBusy(false);
    if (error) return showNotice('error', error.message || 'تعذر رفع إثبات التحويل.');
    setProofForm({ target: '', amount: '', file: null });
    showNotice('success', 'تم رفع التحويل وهو الآن قيد مراجعة المالك.');
    await fetchClientData();
  };

  const selectPaymentTarget = (type, id, suggestedOutstanding) => {
    const source = type === 'package' ? activePackages : invoices;
    const target = source.find(item => Number(item.id) === Number(id));
    const calculatedOutstanding = target
      ? Math.max(0, Number(type === 'package' ? target.total_price : target.total) + Number(type === 'package' ? target.overage_amount || 0 : 0) - Number(target.paid_amount || 0))
      : 0;
    const outstanding = Number.isFinite(Number(suggestedOutstanding)) && suggestedOutstanding !== undefined
      ? Number(suggestedOutstanding)
      : calculatedOutstanding;
    setProofForm(previous => ({ ...previous, target: `${type}:${id}`, amount: outstanding > 0 ? String(outstanding) : '' }));
    setActiveTab('finance');
    window.setTimeout(() => document.getElementById('client-transfer-proof')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 50);
  };

  const viewClientOffer = async (event, offer) => {
    offerTriggerRef.current = event.currentTarget;
    if (isLocalPreview) {
      setOfferDetail(offer);
      setOfferDetailBusy(false);
      return;
    }
    setOfferDetail({ id: offer.id });
    setOfferDetailBusy(true);
    const { data, error } = await supabase.request(`/offers/${offer.id}`, { method: 'GET' });
    setOfferDetailBusy(false);
    if (error) {
      setOfferDetail(null);
      showNotice('error', error.message || 'تعذر تحميل تفاصيل العرض.');
      return;
    }
    setOfferDetail(data);
  };

  const closeOfferDetail = useCallback(() => { setOfferDetail(null); setAcceptConfirm(false); }, []);
  const offerDetailId = offerDetail?.id;

  useEffect(() => {
    if (!offerDetailId) return undefined;
    const dialog = offerDialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []);
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeOfferDetail(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable(); if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => focusable()[0]?.focus());
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; requestAnimationFrame(() => offerTriggerRef.current?.focus()); };
  }, [offerDetailId, closeOfferDetail]);

  const acceptOffer = async () => {
    if (!offerDetail) return;
    if (isLocalPreview) {
      setOfferDetail(old => ({ ...old, status: 'accepted' }));
      setAcceptConfirm(false);
      showNotice('success', 'تمت محاكاة قبول العرض محليًا دون إنشاء فاتورة أو تعديل بيانات.');
      return;
    }
    setAcceptBusy(true);
    const { error } = await supabase.request(`/offers/${offerDetail.id}/accept`, { method: 'POST', body: '{}' });
    setAcceptBusy(false);
    if (error) return showNotice('error', error.message || 'تعذر قبول العرض.');
    closeOfferDetail();
    showNotice('success', 'تم قبول العرض وإنشاء الفاتورة والخدمات المرتبطة بنجاح.');
    await fetchClientData();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const markNotificationRead = async (notification) => {
    setAppNotifications(items => items.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
    if (!isLocalPreview) await supabase.request(`/app-notifications/${notification.id}/read`, { method: 'POST', body: '{}' });
  };

  if (!clientId) return <div className="client-state"><Clock3 /><p>جارٍ التحقق من الجلسة...</p></div>;
  if (loading && !client) return <div className="client-state"><RefreshCw className="client-spin" /><p>نجهز لوحة حسابك...</p></div>;
  if (loadError && !client) return <div className="client-state client-state--error"><XCircle /><h2>تعذر تحميل لوحة الحساب</h2><p>{loadError}</p><button onClick={fetchClientData}>إعادة المحاولة</button></div>;

  return (
    <div className="client-app" dir="rtl">
      <aside className="client-sidebar">
        <div className="client-brand"><img src="/logo.webp" alt="MT Agency" /><div><strong>MT Agency</strong><span>مساحة العميل</span></div></div>
        <nav aria-label="التنقل الرئيسي">
          {[
            ['home', Home, 'الرئيسية'], ['schedule', CalendarDays, 'المواعيد'],
            ['projects', FolderKanban, 'أعمالي'], ['finance', CircleDollarSign, 'المالية والفواتير'], ['offers', FileText, 'العروض'],
          ].map(([key, Icon, label]) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}><Icon size={19}/><span>{label}</span></button>)}
        </nav>
        <button className="client-logout" onClick={handleLogout}><LogOut size={18}/> تسجيل الخروج</button>
      </aside>

      <main className="client-main">
        <header className={`client-topbar ${activeTab === 'home' ? 'client-topbar--home' : ''}`}>
          <div><span className="client-eyebrow">مساحة العميل الخاصة</span><h1>أهلًا، {client?.name || currentUser?.full_name}</h1><p>تابع باقاتك ومشروعاتك ومواعيدك وحالتك المالية من مكان واحد.</p></div>
          <div className="client-topbar-actions"><button className="client-primary" onClick={() => setActiveTab('schedule')}><CalendarDays size={18}/> طلب حجز جديد</button>{activeTab === 'home' && <button className="client-secondary" onClick={() => setActiveTab('finance')}><FileUp size={18}/> رفع إثبات تحويل</button>}</div>
        </header>

        <ClientActiveSession sessions={activeSessions} serverOffset={sessionServerOffset} />
        {appNotifications.filter(item => !item.read_at).slice(0, 3).map(item => <div className={`client-system-alert client-system-alert--${item.severity || 'info'}`} key={item.id} role="status"><div><CircleDollarSign/><span><strong>{item.title}</strong>{item.message}</span></div><button type="button" onClick={() => markNotificationRead(item)} aria-label="تعليم الإشعار كمقروء"><X/></button></div>)}
        {isLocalPreview && <div className="client-notice client-notice--success" role="status">معاينة عميل محلية ببيانات تمثيلية فقط — لن تُرسل الإجراءات أو الملفات إلى الخادم.</div>}
        {notice && <div className={`client-notice client-notice--${notice.type}`} role="status">{notice.message}</div>}
        {loadError && <div className="client-notice client-notice--error">تعذر تحديث بعض البيانات. <button onClick={fetchClientData}>حاول مجددًا</button></div>}

        {activeTab === 'home' && <ClientDashboardOverview
          activePackages={activePackages}
          upcomingBookings={upcomingBookings}
          onNavigate={setActiveTab}
          onBookPackage={packageId => {
            setBookingForm(previous => ({ ...previous, client_package_id: String(packageId) }));
            setActiveTab('schedule');
          }}
        />}

        {activeTab === 'schedule' && <section className="client-view client-schedule-layout">
          <div className="client-schedule-main">
            <div className="client-page-title"><span>الطلب ← الانتظار ← القرار</span><h2>المواعيد والحجوزات</h2><p>حالة كل طلب تظهر فور مراجعتها من الإدارة.</p></div>
            <div className="client-calendar-panel">
              <div className="client-calendar-head"><button aria-label="الشهر التالي" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight/></button><h3>{format(currentMonth, 'MMMM yyyy', { locale: ar })}</h3><button aria-label="الشهر السابق" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft/></button></div>
              <div className="client-weekdays">{['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'].map(day => <span key={day}>{day}</span>)}</div>
              <div className="client-calendar-grid">{calendarDays.map(day => {
                const dayBookings = bookings.filter(item => isSameDay(new Date(`${item.date}T12:00`), day));
                return <button key={day.toISOString()} className={`${!isSameMonth(day, currentMonth) ? 'outside' : ''} ${isSameDay(day, selectedDay) ? 'selected' : ''}`} onClick={() => setSelectedDay(day)}><span className="client-day-number">{format(day, 'd')}</span><span className="client-day-events">{dayBookings.slice(0, 2).map(item => <i className={`event-${STATUS_META[item.status]?.tone || 'neutral'}`} key={item.id}>{timeLabel(item.start_time)} · {item.client_name || 'حجزك'}</i>)}{dayBookings.length > 2 && <em>+{dayBookings.length - 2}</em>}</span></button>;
              })}</div>
            </div>
            <section className="client-panel client-day-list"><div className="client-section-head"><div><span>تفاصيل اليوم</span><h2>{format(selectedDay, 'EEEE d MMMM', { locale: ar })}</h2></div></div>
              {selectedBookings.map(booking => <BookingRow key={booking.id} booking={booking} busy={actionBusy} onAlternativeDecision={action => decideAlternative(booking, action)} onReschedule={() => setReschedule({ ...initialReschedule, booking, date: booking.date, start_time: normalizeTime(booking.start_time), end_time: normalizeTime(booking.end_time, { endOfDay: true }) })} onCancel={() => requestCancel(booking)}/>) }
              {!selectedBookings.length && <div className="client-empty client-empty--compact"><CalendarDays/><p>لا توجد حجوزات في هذا اليوم.</p></div>}
            </section>
            <section className="client-panel client-booking-history"><div className="client-section-head"><div><span>سجل الطلبات</span><h2>كل الحجوزات</h2></div></div>{bookings.map(booking => <BookingRow key={booking.id} booking={booking} busy={actionBusy} onAlternativeDecision={action => decideAlternative(booking, action)} onReschedule={() => setReschedule({ ...initialReschedule, booking, date: booking.date, start_time: normalizeTime(booking.start_time), end_time: normalizeTime(booking.end_time, { endOfDay: true }) })} onCancel={() => requestCancel(booking)}/>)}{!bookings.length && <div className="client-empty"><CalendarDays/><h3>لم تطلب أي حجز بعد</h3></div>}</section>
          </div>
          <aside className="client-request-card"><div className="client-request-title"><span><Send size={15}/> طلب جديد</span><h2>احجز موعد تصوير</h2><p>اختر باقتك ثم أرسل الوقت المناسب لك.</p></div><form onSubmit={submitBooking}>
            <label>الباقة<select required value={bookingForm.client_package_id} onChange={e => setBookingForm({ ...bookingForm, client_package_id: e.target.value })}><option value="">اختر الباقة</option>{activePackages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}</select></label>
            <label>التاريخ<input required type="date" min={format(new Date(), 'yyyy-MM-dd')} value={bookingForm.date} onChange={e => setBookingForm({ ...bookingForm, date: e.target.value })}/></label>
            <div className="client-time-fields"><label>من<BusinessTimeSelect required min="12:00" max="23:00" value={bookingForm.start_time} onChange={e => setBookingForm({ ...bookingForm, start_time: e.target.value })}/></label><label>إلى<BusinessTimeSelect required min="13:00" max="24:00" value={bookingForm.end_time} onChange={e => setBookingForm({ ...bookingForm, end_time: e.target.value })}/></label></div>
            <p className="client-policy"><Clock3 size={17}/> مواعيد العمل {BUSINESS_HOURS_LABEL}. أقل حجز ساعة، وبعدها يمكن الزيادة كل 15 دقيقة.</p>
            <label>ملاحظات<textarea rows="3" value={bookingForm.notes} onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })} placeholder="تفاصيل تساعدنا في تجهيز الجلسة"/></label>
            <button className="client-primary" disabled={bookingBusy || !activePackages.length}>{bookingBusy ? <RefreshCw className="client-spin"/> : <Send/>}{bookingBusy ? 'جارٍ الإرسال...' : 'إرسال طلب الحجز'}</button>
            {!activePackages.length && <small className="client-field-error">يلزم وجود باقة فعالة لإرسال طلب حجز.</small>}
          </form></aside>
        </section>}

        {activeTab === 'projects' && <ClientProjectsView projects={projects}/>}

        {activeTab === 'offers' && <section className="client-view">
          <div className="client-page-title"><span>عروض المالك الخاصة بك</span><h2>العروض</h2><p>راجع العروض المرسلة إليك من مالك الشركة، واقبل المناسب منها.</p></div>
          <section className="client-panel"><div className="client-section-head"><div><span>عروض MT Agency</span><h2>العروض المتاحة</h2></div><strong className="client-commercial-count">{offers.length}</strong></div><div className="client-offer-list">{offers.map(offer => <article key={offer.id}><header><div><span>{offer.offer_number}</span><h3>{offer.title}</h3></div><ClientOfferStatus status={offer.status}/></header><div className="client-offer-value"><span>القيمة النهائية</span><strong>{formatEGP(offer.total)}</strong></div><div className="client-offer-meta"><span>صالح حتى {offer.valid_until ? formatBookingDate(offer.valid_until) : 'غير محدد'}</span>{offer.discount > 0 && <span>خصم {formatEGP(offer.discount)}</span>}</div><button onClick={event => viewClientOffer(event, offer)}><Eye/> عرض التفاصيل {offer.status === 'sent' ? 'والقبول' : ''}</button></article>)}{!offers.length && <div className="client-empty"><FileText/><h3>لا توجد عروض مرسلة حاليًا</h3><p>سيظهر العرض هنا فور إرساله من المالك.</p></div>}</div></section>
        </section>}

        {activeTab === 'finance' && <ClientFinanceView activePackages={activePackages} invoices={invoices} payments={payments} proofs={proofs} proofForm={proofForm} proofBusy={proofBusy} onProofFormChange={updates => setProofForm(previous => ({ ...previous, ...updates }))} onSubmitProof={uploadProof} onSelectTarget={selectPaymentTarget} />}
      </main>

      {offerDetail && <div className="client-modal client-offer-modal" onMouseDown={event => { if (event.target === event.currentTarget) closeOfferDetail(); }}><section ref={offerDialogRef} className="client-modal-card client-offer-dialog" role="dialog" aria-modal="true" aria-labelledby="client-offer-title"><button className="client-modal-close" onClick={closeOfferDetail} aria-label="إغلاق تفاصيل العرض"><X/></button>{offerDetailBusy ? <div className="client-empty"><RefreshCw className="client-spin"/><h3>جارٍ تحميل العرض</h3></div> : <><span className="client-eyebrow"><FileCheck2/> {offerDetail.offer_number}</span><h2 id="client-offer-title">{offerDetail.title}</h2><p>صالح حتى {offerDetail.valid_until ? formatBookingDate(offerDetail.valid_until) : 'غير محدد'}</p><div className="client-offer-detail-lines">{offerDetail.items?.map(item => <article key={item.id}><div><strong>{item.description}</strong><span>{Number(item.quantity).toLocaleString('ar-EG')} {item.unit === 'hour' ? 'ساعة' : item.unit === 'reel' ? 'ريل' : 'وحدة'} × {Number(item.unit_price).toLocaleString('ar-EG')} ج.م</span></div><b>{Number(item.total).toLocaleString('ar-EG')} ج.م</b></article>)}</div><div className="client-offer-detail-total"><span>الإجمالي الفرعي <b>{Number(offerDetail.subtotal).toLocaleString('ar-EG')} ج.م</b></span><span>الخصم <b>{Number(offerDetail.discount).toLocaleString('ar-EG')} ج.م</b></span><strong>القيمة النهائية <b>{Number(offerDetail.total).toLocaleString('ar-EG')} ج.م</b></strong></div>{offerDetail.notes && <p className="client-offer-notes">{offerDetail.notes}</p>}{offerDetail.status === 'sent' ? <div className="client-offer-accept"><p><CheckCircle2/> بقبول العرض سيتم إنشاء فاتورة، وباقة استديو أو مشروع خدمة حسب نوع كل بند.</p>{acceptConfirm ? <div className="client-accept-confirm"><strong>هل تؤكد قبول العرض بالقيمة الموضحة؟</strong><div><button type="button" onClick={() => setAcceptConfirm(false)}>تراجع</button><button type="button" className="client-primary" disabled={acceptBusy} onClick={acceptOffer}>{acceptBusy ? <RefreshCw className="client-spin"/> : <CheckCircle2/>}{acceptBusy ? 'جارٍ القبول...' : 'نعم، أؤكد القبول'}</button></div></div> : <button className="client-primary" onClick={() => setAcceptConfirm(true)}><CheckCircle2/> قبول عرض السعر</button>}</div> : <div className="client-offer-accepted"><CheckCircle2/> تم قبول هذا العرض سابقًا.</div>}</>}</section></div>}

      {reschedule.booking && <div className="client-modal" role="dialog" aria-modal="true" aria-label="طلب تغيير موعد"><div className="client-modal-card"><button className="client-modal-close" onClick={() => setReschedule(initialReschedule)} aria-label="إغلاق"><XCircle/></button><span className="client-eyebrow"><RotateCcw size={15}/> تغيير الموعد</span><h2>اقترح موعدًا بديلًا</h2><p>الطلب الحالي: {formatBookingDate(reschedule.booking.date)}، {timeLabel(reschedule.booking.start_time)}</p><form onSubmit={submitReschedule}><label>التاريخ الجديد<input required type="date" min={format(new Date(), 'yyyy-MM-dd')} value={reschedule.date} onChange={e => setReschedule({ ...reschedule, date: e.target.value })}/></label><div className="client-time-fields"><label>من<BusinessTimeSelect required min="12:00" max="23:00" value={reschedule.start_time} onChange={e => setReschedule({ ...reschedule, start_time: e.target.value })}/></label><label>إلى<BusinessTimeSelect required min="13:00" max="24:00" value={reschedule.end_time} onChange={e => setReschedule({ ...reschedule, end_time: e.target.value })}/></label></div><label>السبب<textarea rows="3" value={reschedule.reason} onChange={e => setReschedule({ ...reschedule, reason: e.target.value })}/></label><p className="client-policy"><Clock3/> تغيير أو إلغاء الموعد يكون قبل 48 ساعة. الاستثناءات تُراجع مع الإدارة.</p><button className="client-primary" disabled={Boolean(actionBusy)}><Send/> إرسال الطلب</button></form></div></div>}
    </div>
  );
}

function ClientActiveSession({ sessions, serverOffset }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!sessions.length) return undefined;
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [sessions.length]);
  if (!sessions.length) return null;
  const session = sessions[0];
  const elapsed = Math.max(0, Math.floor(((tick + serverOffset) - new Date(session.started_at).getTime()) / 1000));
  const parts = [Math.floor(elapsed / 3600), Math.floor((elapsed % 3600) / 60), elapsed % 60].map(value => String(value).padStart(2, '0'));
  const available = Math.max(0, Number(session.purchased_quantity || 0) - Number(session.held_quantity || 0) - Number(session.consumed_quantity || 0));
  return <section className="client-live-session" aria-live="polite"><span className="client-live-session__pulse"/><div><small>جلسة التصوير جارية الآن</small><h2>{session.service}</h2><p>{session.package_name || 'بدون باقة'}{session.client_package_id ? ` • المتاح قبل الإنهاء ${available.toLocaleString('ar-EG')} ${session.billing_unit === 'reel' ? 'ريل' : 'ساعة'}` : ''}</p></div><time dir="ltr">{parts.join(':')}</time><span className="client-live-session__state"><Clock3/> يتحدث تلقائيًا</span></section>;
}

function BookingRow({ booking, busy, onAlternativeDecision, onReschedule, onCancel }) {
  const canChange = ['confirmed', 'alternative_proposed'].includes(booking.status);
  const canCancel = ['pending', 'confirmed', 'alternative_proposed'].includes(booking.status);
  return <article className="client-booking-row"><div className="client-booking-date"><strong>{format(new Date(`${booking.date}T12:00`), 'd')}</strong><span>{format(new Date(`${booking.date}T12:00`), 'MMM', { locale: ar })}</span></div><div className="client-booking-info"><StatusBadge status={booking.status}/><h3>{booking.service}</h3><p><CalendarDays size={15}/>{formatBookingDate(booking.date)}</p><p><Clock3 size={15}/>{timeLabel(booking.start_time)} – {timeLabel(booking.end_time)}</p></div>{(canChange || canCancel) && <div className="client-booking-actions">{booking.status === 'alternative_proposed' && <><button disabled={Boolean(busy)} onClick={() => onAlternativeDecision('accept')}><CheckCircle2/> قبول الموعد</button><button className="danger" disabled={Boolean(busy)} onClick={() => onAlternativeDecision('reject')}><RotateCcw/> موعد آخر</button></>}{booking.status !== 'alternative_proposed' && canChange && <button disabled={Boolean(busy)} onClick={onReschedule}><RotateCcw/> تغيير</button>}{canCancel && <button className="danger" disabled={Boolean(busy)} onClick={onCancel}><XCircle/> {busy === `cancel-${booking.id}` ? 'جارٍ...' : 'إلغاء'}</button>}</div>}</article>;
}

function ClientOfferStatus({ status }) {
  const states = {
    sent: ['بانتظار قبولك', 'waiting'],
    accepted: ['مقبول', 'success'],
    expired: ['منتهي الصلاحية', 'danger'],
  };
  const meta = states[status] || ['للعرض فقط', 'neutral'];
  return <span className={`client-status client-status--${meta[1]}`}>{meta[0]}</span>;
}
