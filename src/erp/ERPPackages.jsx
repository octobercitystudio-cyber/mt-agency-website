import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeftRight, CalendarCheck2, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, Edit3, Eye, Filter, History, MoreVertical, PackageCheck, PackagePlus, PlayCircle, Plus, ReceiptText, RefreshCw, Search, ShieldAlert, TimerReset, Trash2, UserPlus, WalletCards, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dataClient } from '../dataClient';
import { useData } from '../store/DataContext';
import './ERPPackages.css';
import { safeUiError } from '../lib/uiError';
import { cairoDateKey, centsToMoney, effectivePackageStatus, formatBookingDate, formatBookingStatus, formatDateTime12, formatDurationMinutes, formatEGP, formatPackageQuantity, formatPackageStatus, formatTime12, packageFinancialSummary, packageQuantitySummary, remainingCalendarDays } from '../lib/businessFormat';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import ERPPageHero from './ERPPageHero';
import { isStudioPackageService } from '../lib/serviceCatalog';
import { anchorPackageDraftToBookings, packageDraftExpiry, packageDraftIsDirty, resetPackageDraftToTemplate, templateToPackageDraft, validatePackageDraft } from '../lib/clientPackageDraft';
import useChangeSync from '../hooks/useChangeSync';
import ERPStartSessionDialog from './ERPStartSessionDialog';
import { eligibilityMap, studioBookingEligible } from './studioSessionEligibility';
import ERPClientModal from './ERPClientModal';
import useModalDialog from '../hooks/useModalDialog';
import { buildPackageServiceGroups, filterClientsByName, mergeCreatedClient } from '../lib/packageBookingPicker';
import { appointmentDurationMinutes, normalizePackageSaleAppointments, packageAppointmentUsage, packageCalendarWeek, partitionPackageAppointments, shiftPackageCalendarDate, validatePackageAppointment } from '../lib/packageSaleAppointments';
import ERPAddBookingModal from './ERPAddBookingModal';
import { packageBookingAvailability } from './packageBookingSelection';
import OwnerPackageControl from './OwnerPackageControl';
import PackagePaymentModal from './PackagePaymentModal';
import LegacyPackageImportDialog from './LegacyPackageImportDialog';

const today = () => cairoDateKey();
const initialForm = { client_id: '', service_id: '', name: '', billing_unit: 'hour', validity_mode_snapshot: 'rolling', starts_at: '', shooting_date: '', expires_at: '', quantity: '', validity_days: 90, payment_due_quantity: 0, deposit_percent_snapshot: 0, overage_price_snapshot: 0, total_price: '', paid_amount: 0, payment_method: 'cash', notes: '' };
const initialAppointment = () => ({ resource_id: '', date: today(), start_time: '12:00', end_time: '13:00', requested_quantity: 1, notes: '' });
const initialModal = { open: false, type: 'details', pkg: null, name: '', notes: '', starts_at: '', expires_at: '', status: 'active', target_quantity: '', target_total_price: '', target_paid_amount: '', payment_method: 'cash', reason: '', destructiveConfirmed: false, deleteConfirmation: '', audit: [], auditLoading: false };
const STATUS = { active: [formatPackageStatus('active'), 'active'], expired: [formatPackageStatus('expired'), 'expired'], suspended: [formatPackageStatus('suspended'), 'suspended'], completed: [formatPackageStatus('completed'), 'completed'], draft: [formatPackageStatus('draft'), 'draft'], cancelled: [formatPackageStatus('cancelled'), 'cancelled'], archived: [formatPackageStatus('archived'), 'archived'] };
const money = formatEGP;
const PAYMENT_METHODS = { cash: 'كاش', bank_transfer: 'تحويل بنكي', vodafone_cash: 'فودافون كاش', instapay: 'إنستاباي' };

export default function ERPPackages() {
  const { currentUser } = useData();
  const navigate = useNavigate();
  const role = currentUser?.role;
  const canAssign = ['owner', 'admin', 'operations'].includes(role);
  const canAdjust = role === 'owner';
  const canViewDetails = ['owner', 'admin'].includes(role);
  const [packages, setPackages] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [todayBookings, setTodayBookings] = useState([]);
  const [calendarBookings, setCalendarBookings] = useState([]);
  const [resources, setResources] = useState([]);
  const [sessionEligibility, setSessionEligibility] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [formBusy, setFormBusy] = useState(false);
  const [saleBookings, setSaleBookings] = useState([]);
  const [appointment, setAppointment] = useState(initialAppointment);
  const [appointmentErrors, setAppointmentErrors] = useState({});
  const [editingAppointment, setEditingAppointment] = useState(-1);
  const [templateResetNotice, setTemplateResetNotice] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [modal, setModal] = useState(initialModal);
  const [ownerRefreshToken, setOwnerRefreshToken] = useState(0);
  const [sessionStart, setSessionStart] = useState({ open: false, pkg: null, person: null, bookings: [] });
  const [bookingPackage, setBookingPackage] = useState({ open: false, pkg: null });
  const [paymentPackage, setPaymentPackage] = useState({ open: false, pkg: null });
  const [details, setDetails] = useState({ open: false, pkg: null, data: null, loading: false, error: '', tab: 'payments' });
  const [legacyImportOpen, setLegacyImportOpen] = useState(false);
  const detailsDialogRef = useRef(null);
  const dialogTriggerRef = useRef(null);
  const clientPickerTriggerRef = useRef(null);
  const sessionTriggerRef = useRef(null);
  const bookingTriggerRef = useRef(null);
  const paymentTriggerRef = useRef(null);
  const packageRequestKeyRef = useRef('');
  const detailsRequestRef = useRef({ token: 0, packageId: null });

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    const [packageResult, clientsResult, servicesResult, bookingsResult, eligibilityResult, resourcesResult, calendarResult] = await Promise.all([
      dataClient.from('client_packages').select('*').order('expires_at', { ascending: true }),
      dataClient.from('clients').select('id,name,phone1,phone2').order('name', { ascending: true }),
      dataClient.from('services').select('*').eq('is_active', 1).order('name', { ascending: true }),
      dataClient.from('bookings').select('*').eq('date', today()).order('start_time', { ascending: true }),
      dataClient.request(`/studio-session-eligibility?date=${today()}`),
      dataClient.from('resources').select('id,name,type,is_active').eq('is_active', 1).order('name', { ascending: true }),
      dataClient.from('bookings').select('id,resource_id,date,start_time,end_time,status,client_name').gte('date', today()).order('date', { ascending: true }),
    ]);
    const failed = [packageResult, clientsResult, servicesResult, bookingsResult, eligibilityResult, resourcesResult, calendarResult].find(result => result.error);
    if (failed?.error) setError(safeUiError(failed.error, 'تعذر تحميل الباقات المباعة الآن.'));
    else {
      const studioServices = (servicesResult.data || []).filter(isStudioPackageService);
      const studioServiceIds = new Set(studioServices.map(service => Number(service.id)));
      setPackages((packageResult.data || []).filter(pkg => studioServiceIds.has(Number(pkg.service_id))));
      setClients(clientsResult.data || []);
      setServices(studioServices);
      setTodayBookings(bookingsResult.data || []);
      setSessionEligibility(eligibilityMap(eligibilityResult.data));
      setResources(resourcesResult.data || []);
      setCalendarBookings(calendarResult.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const closeAddDialog = useCallback(() => setFormOpen(false), []);
  const addDialogRef = useModalDialog(formOpen, closeAddDialog, { returnFocusRef: dialogTriggerRef });
  const closeActionDialog = useCallback(() => setModal(initialModal), []);
  const closeDetailsDialog = useCallback(() => {
    detailsRequestRef.current = { token: detailsRequestRef.current.token + 1, packageId: null };
    setDetails(current => ({ ...current, open: false, data: null, loading: false, error: '' }));
  }, []);

  const fetchDetails = useCallback(async packageId => {
    const normalizedId = Number(packageId); const token = detailsRequestRef.current.token + 1;
    detailsRequestRef.current = { token, packageId: normalizedId };
    setDetails(current => Number(current.pkg?.id) === normalizedId ? { ...current, loading: true, error: '' } : current);
    const { data, error: requestError } = await dataClient.request(`/client-packages/${packageId}/details`, { method: 'GET' });
    if (detailsRequestRef.current.token !== token || detailsRequestRef.current.packageId !== normalizedId) return;
    setDetails(current => Number(current.pkg?.id) === normalizedId ? { ...current, data: requestError ? null : data, loading: false, error: requestError ? safeUiError(requestError, 'تعذر تحميل كشف الباقة.') : '' } : current);
  }, []);

  const openDetailsDialog = (pkg, event) => {
    dialogTriggerRef.current = event.currentTarget;
    detailsRequestRef.current = { token: detailsRequestRef.current.token + 1, packageId: Number(pkg.id) };
    setDetails({ open: true, pkg, data: null, loading: true, error: '', tab: 'payments' });
    fetchDetails(pkg.id);
  };

  const openDetailPackageId = details.open ? details.pkg?.id : null;
  useChangeSync(useCallback(topics => {
    if (!topics.some(topic => ['client_packages', 'bookings', 'finance'].includes(topic))) return;
    fetchData();
    if (openDetailPackageId) fetchDetails(openDetailPackageId);
  }, [openDetailPackageId, fetchData, fetchDetails]));

  useEffect(() => {
    if (!details.open) return undefined;
    const dialog = detailsDialogRef.current;
    const close = closeDetailsDialog;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(dialog?.querySelectorAll(focusableSelector) || []).filter(element => element.offsetParent !== null);
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.querySelectorAll('.erp-sidebar,.erp-mobile-header,.erp-bottom-nav,.sold-packages > :not(.packages-modal)'));
    const previousA11y = background.map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
    background.forEach(element => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => (dialog?.querySelector('[data-dialog-initial]') || focusables()[0])?.focus());
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousA11y.forEach(({ element, inert, ariaHidden }) => { element.inert = inert; if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden); });
      window.requestAnimationFrame(() => dialogTriggerRef.current?.focus());
    };
  }, [details.open, closeDetailsDialog]);

  const client = id => clients.find(item => Number(item.id) === Number(id));
  const available = pkg => packageQuantitySummary(pkg).available;
  const daysToExpiry = pkg => remainingCalendarDays(pkg.expires_at);
  const effectiveStatus = pkg => effectivePackageStatus(pkg);
  const activePackages = packages.filter(pkg => effectiveStatus(pkg) === 'active');
  const expiring = activePackages.filter(pkg => daysToExpiry(pkg) >= 0 && daysToExpiry(pkg) <= 14);
  const remainingHours = activePackages.filter(pkg => pkg.billing_unit !== 'reel').reduce((sum, pkg) => sum + available(pkg), 0);
  const remainingReels = activePackages.filter(pkg => pkg.billing_unit === 'reel').reduce((sum, pkg) => sum + available(pkg), 0);
  const outstandingCents = packages.reduce((sum, pkg) => sum + packageFinancialSummary(pkg).outstandingCents, 0);

  const filtered = useMemo(() => packages.filter(pkg => {
    const person = clients.find(item => Number(item.id) === Number(pkg.client_id));
    const haystack = `${person?.name || ''} ${person?.phone1 || ''} ${pkg.name}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    const expiryDays = daysToExpiry(pkg);
    const displayedStatus = effectiveStatus(pkg);
    if (statusFilter !== 'all' && displayedStatus !== statusFilter) return false;
    if (serviceFilter !== 'all' && String(pkg.service_id) !== serviceFilter) return false;
    const days = expiryDays;
    if (expiryFilter === '14' && !(displayedStatus === 'active' && pkg.expires_at && days >= 0 && days <= 14)) return false;
    if (expiryFilter === 'expired' && displayedStatus !== 'expired') return false;
    return true;
  }), [packages, clients, search, statusFilter, serviceFilter, expiryFilter]);

  const selectService = serviceId => {
    const service = services.find(item => String(item.id) === String(serviceId));
    setFormErrors({});
    if (!service) { setTemplateResetNotice('اختر قالبًا جديدًا قبل متابعة خطة المواعيد المحفوظة. لم يتم حذف أي موعد.'); return setForm(current => ({ ...initialForm, client_id: current.client_id, service_id: '' })); }
    const next = anchorPackageDraftToBookings(templateToPackageDraft(service, { clientId: form.client_id, startsAt: '' }), saleBookings);
    setForm(next);
    const { invalid } = partitionPackageAppointments(saleBookings, next, packageDraftExpiry(next));
    setTemplateResetNotice(invalid.length ? `تم تغيير القالب مع الاحتفاظ بكل المواعيد. يحتاج ${invalid.length} موعد إلى تعديل ليتوافق مع الصلاحية الجديدة.` : saleBookings.length ? 'تم تغيير القالب مع الاحتفاظ بخطة المواعيد كاملة.' : '');
    setAppointment(current => ({ ...current, date: current.date || today() }));
    setAppointmentErrors({});
  };

  const openAddDialog = event => {
    dialogTriggerRef.current = event.currentTarget;
    packageRequestKeyRef.current = globalThis.crypto?.randomUUID?.() || `package-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setForm(initialForm); setFormErrors({}); setSaleBookings([]); setAppointment(initialAppointment()); setAppointmentErrors({}); setEditingAppointment(-1); setTemplateResetNotice(''); setClientSearch(''); setClientModalOpen(false); setError('');
    setFormOpen(true);
  };

  const openPackageDialog = async (type, pkg, event) => {
    dialogTriggerRef.current = event.currentTarget;
    setModal({ ...initialModal, open: true, type, pkg, name: pkg.name || '', notes: pkg.notes || '', starts_at: String(pkg.starts_at || '').slice(0, 10), expires_at: String(pkg.expires_at || '').slice(0, 10), status: pkg.status || 'active', target_quantity: Number(pkg.purchased_quantity || 0), target_total_price: Number(pkg.total_price || 0), target_paid_amount: Number(pkg.paid_amount || 0), auditLoading: true });
    const { data } = await dataClient.request(`/audit-logs?entity_type=client_packages&entity_id=${pkg.id}`, { method: 'GET' });
    setModal(current => current.open && Number(current.pkg?.id) === Number(pkg.id) ? { ...current, audit: data || [], auditLoading: false } : current);
  };

  const sessionBookingsFor = pkg => todayBookings.filter(booking => Number(booking.client_package_id) === Number(pkg.id) && (booking.status === 'in_progress' || studioBookingEligible(booking, sessionEligibility)));
  const packageCanStartToday = pkg => sessionBookingsFor(pkg).some(booking => booking.status === 'confirmed' && studioBookingEligible(booking, sessionEligibility));
  const openSessionStart = (pkg, person, event) => {
    sessionTriggerRef.current = event.currentTarget;
    setSessionStart({ open: true, pkg, person, bookings: sessionBookingsFor(pkg) });
  };
  const handleSessionStarted = async booking => {
    setTodayBookings(current => current.map(item => Number(item.id) === Number(booking.id) ? { ...item, status: 'in_progress' } : item));
    setNotice(`بدأ تصوير ${booking.client_name || sessionStart.person?.name || 'العميل'} والتايمر يعمل الآن.`);
    window.setTimeout(() => setNotice(''), 4000);
    await fetchData();
  };
  const openPackageBooking = (pkg, event) => {
    bookingTriggerRef.current = event.currentTarget;
    event.currentTarget.blur();
    setBookingPackage({ open: true, pkg });
  };
  const handlePackageBookingCreated = async () => {
    setBookingPackage({ open: false, pkg: null });
    setOwnerRefreshToken(value => value + 1);
    setNotice('تم حجز الموعد وخصم الرصيد المحجوز من الباقة.');
    window.setTimeout(() => setNotice(''), 4000);
    await fetchData();
  };
  const openPackagePayment = (pkg, event) => {
    paymentTriggerRef.current = event.currentTarget;
    setPaymentPackage({ open: true, pkg });
  };
  const handlePackagePaymentCreated = async response => {
    setPaymentPackage({ open: false, pkg: null });
    setOwnerRefreshToken(value => value + 1);
    setNotice(`تم حفظ دفعة بقيمة ${money(response.amount)} في مدفوعات العميل وتحديث رصيد الباقة.`);
    window.setTimeout(() => setNotice(''), 5000);
    await fetchData();
  };

  const selectedTemplate = useMemo(() => services.find(item => String(item.id) === String(form.service_id)), [services, form.service_id]);
  const serviceGroups = useMemo(() => buildPackageServiceGroups(services), [services]);
  const visibleClients = useMemo(() => filterClientsByName(clients, clientSearch, form.client_id), [clients, clientSearch, form.client_id]);
  const anchoredDraft = useMemo(() => anchorPackageDraftToBookings(form, saleBookings), [form, saleBookings]);
  const expiryPreview = anchoredDraft.expires_at || '—';
  const formDirty = useMemo(() => selectedTemplate ? packageDraftIsDirty(form, selectedTemplate) : false, [form, selectedTemplate]);
  const updateFormField = (field, value) => { setForm(current => ({ ...current, [field]: value })); setFormErrors(current => ({ ...current, [field]: undefined })); };
  const resetFormTemplate = () => { if (selectedTemplate) { const next=anchorPackageDraftToBookings(resetPackageDraftToTemplate(form, selectedTemplate, { startsAt: '' }), saleBookings); const { invalid }=partitionPackageAppointments(saleBookings,next,packageDraftExpiry(next)); setForm(next); setFormErrors({}); setTemplateResetNotice(invalid.length ? `تمت استعادة شروط القالب ولم نحذف أي موعد. عدّل ${invalid.length} موعد خارج الصلاحية قبل الحفظ.` : saleBookings.length ? 'تمت استعادة شروط القالب مع الاحتفاظ بكل المواعيد.' : 'تمت استعادة شروط القالب.'); setAppointmentErrors(invalid.length ? { date: 'توجد مواعيد خارج صلاحية القالب المستعاد. عدّلها أو احذفها يدويًا.' } : {}); } };
  const selectClient = clientId => { updateFormField('client_id', clientId); setClientSearch(''); };
  const handleClientCreated = createdClient => {
    if (!createdClient?.id) return;
    setClients(current => mergeCreatedClient(current, createdClient));
    setForm(current => ({ ...current, client_id: String(createdClient.id) }));
    setFormErrors(current => ({ ...current, client_id: undefined }));
    setClientSearch('');
    Promise.resolve(dataClient.from('clients').select('id,name,phone1').order('name', { ascending: true }))
      .then(result => { if (!result.error) setClients(mergeCreatedClient(result.data || [], createdClient)); })
      .catch(() => {});
  };

  const appointmentUsage = useMemo(() => packageAppointmentUsage(saleBookings, form.billing_unit, form.quantity), [saleBookings, form.billing_unit, form.quantity]);
  const saveAppointment = () => {
    const candidateBookings = editingAppointment >= 0 ? saleBookings.map((item, index) => index === editingAppointment ? appointment : item) : [...saleBookings, appointment];
    const candidateDraft = anchorPackageDraftToBookings(form, candidateBookings);
    const validation = validatePackageAppointment(appointment, { unit: form.billing_unit, minimumMinutes: Number(selectedTemplate?.minimum_booking_minutes || 60), incrementMinutes: Number(selectedTemplate?.booking_increment_minutes || 15), startsAt: candidateDraft.starts_at, expiresAt: candidateDraft.expires_at, shootingDate: candidateDraft.validity_mode_snapshot === 'shooting_day' ? candidateDraft.shooting_date : '', appointments: saleBookings, occupied: calendarBookings, editIndex: editingAppointment });
    const nextUsage = packageAppointmentUsage(candidateBookings, form.billing_unit, form.quantity);
    if (nextUsage.exceeded) validation.balance = 'المواعيد المختارة تتجاوز رصيد الباقة.';
    setAppointmentErrors(validation); if (Object.keys(validation).length) return;
    setSaleBookings(current => editingAppointment >= 0 ? current.map((item, index) => index === editingAppointment ? { ...appointment } : item) : [...current, { ...appointment }]);
    setEditingAppointment(-1); setAppointment({ ...initialAppointment(), resource_id: appointment.resource_id, date: appointment.date }); setAppointmentErrors({});
  };
  const editAppointment = index => { setEditingAppointment(index); setAppointment({ ...saleBookings[index] }); setAppointmentErrors({}); };
  const removeAppointment = index => { setSaleBookings(current => current.filter((_, itemIndex) => itemIndex !== index)); if (editingAppointment === index) { setEditingAppointment(-1); setAppointment(initialAppointment()); } };

  const submitPackage = async event => {
    event.preventDefault(); if (formBusy) return; setError('');
    const validation = validatePackageDraft(anchoredDraft); setFormErrors(validation);
    const appointmentValidation = saleBookings.map(item => validatePackageAppointment(item, { unit: form.billing_unit, minimumMinutes: Number(selectedTemplate?.minimum_booking_minutes || 60), incrementMinutes: Number(selectedTemplate?.booking_increment_minutes || 15), startsAt: anchoredDraft.starts_at, expiresAt: anchoredDraft.expires_at, shootingDate: anchoredDraft.validity_mode_snapshot === 'shooting_day' ? anchoredDraft.shooting_date : '', appointments: saleBookings, occupied: calendarBookings, editIndex: saleBookings.indexOf(item) })).find(item => Object.keys(item).length);
    if (appointmentValidation) setAppointmentErrors(appointmentValidation);
    if (Object.keys(validation).length || appointmentValidation || appointmentUsage.exceeded) return;
    setFormBusy(true);
    const { error: requestError } = await dataClient.request('/client-packages', { method: 'POST', body: JSON.stringify({
      client_id: Number(form.client_id), service_id: Number(form.service_id), name: form.name, billing_unit: form.billing_unit,
      starts_at: anchoredDraft.starts_at, shooting_date: anchoredDraft.shooting_date, quantity: Number(form.quantity), validity_days: Number(form.validity_days),
      expires_at: anchoredDraft.expires_at, payment_due_quantity: Number(form.payment_due_quantity), deposit_percent_snapshot: Number(form.deposit_percent_snapshot),
      overage_price_snapshot: Number(form.overage_price_snapshot), total_price: Number(form.total_price), paid_amount: Number(form.paid_amount),
      payment_method: form.payment_method, notes: form.notes, bookings: normalizePackageSaleAppointments(saleBookings), idempotency_key: packageRequestKeyRef.current,
    }) });
    setFormBusy(false);
    if (requestError) return setError(safeUiError(requestError, 'تعذر إضافة الباقة للعميل.'));
    packageRequestKeyRef.current = ''; setForm(initialForm); setFormErrors({}); setSaleBookings([]); setAppointment(initialAppointment()); setFormOpen(false); setNotice(`تمت إضافة الباقة${saleBookings.length ? ` و${saleBookings.length} موعد` : ''} بنجاح.`);
    window.setTimeout(() => setNotice(''), 4000); await fetchData();
  };

  const handleLegacyImported = async result => {
    setLegacyImportOpen(false);
    setNotice(`تم نقل ${Number(result?.imported_count || 0).toLocaleString('ar-EG')} باقة من البرنامج القديم دون تغيير بيانات العملاء أو الخزنة.`);
    window.setTimeout(() => setNotice(''), 7000);
    await fetchData();
  };

  return <div className="sold-packages" dir="rtl">
    <ERPPageHero icon={WalletCards} eyebrow="إدارة المبيعات والرصيد" title="الباقات المباعة" description="الرصيد الحقيقي من قاعدة البيانات، مستقل تمامًا عن تجميع الحجوزات." actions={canAssign && <div className="packages-hero-actions">{role === 'owner' && <button type="button" data-variant="secondary" onClick={() => setLegacyImportOpen(true)}><Archive/> نقل من البرنامج القديم</button>}<button data-variant="primary" onClick={openAddDialog}><PackagePlus/> إضافة باقة لعميل</button></div>}/>
    <section className="packages-summary"><Metric icon={CheckCircle2} label="الباقات النشطة" value={activePackages.length}/><Metric icon={CalendarClock} label="تنتهي خلال 14 يومًا تقويميًا" value={expiring.length} warning/><Metric icon={Clock3} label="متاح لحجز جديد" value={`${formatDurationMinutes(remainingHours * 60, { compact: true })} / ${remainingReels.toLocaleString('ar-EG')} ر`}/><Metric icon={CircleDollarSign} label="قيمة مستحقة" value={money(centsToMoney(outstandingCents))} danger/></section>
    {notice && <div className="packages-notice success" role="status"><CheckCircle2/> {notice}</div>}{error && <div className="packages-notice error" role="alert"><ShieldAlert/><span>{error}</span><button onClick={fetchData}>إعادة المحاولة</button></div>}
    <section className="packages-filters"><label className="packages-search"><Search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم العميل أو الهاتف أو الباقة"/></label><label><Filter/> الحالة<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">كل الحالات</option>{Object.entries(STATUS).map(([key, [label]]) => <option value={key} key={key}>{label}</option>)}</select></label><label>الخدمة<select value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}><option value="all">كل الخدمات</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label>الانتهاء<select value={expiryFilter} onChange={event => setExpiryFilter(event.target.value)}><option value="all">كل التواريخ</option><option value="14">خلال 14 يومًا</option><option value="expired">منتهية التاريخ</option></select></label><button className="packages-refresh" onClick={fetchData}><RefreshCw className={loading ? 'packages-spin' : ''}/></button></section>
    {loading ? <Empty icon={RefreshCw} title="جارٍ تحميل الباقات" text="نسترجع أرصدة الباقات المباعة من الخادم." spin/> : filtered.length ? <><div className="packages-table-wrap"><table><thead><tr><th>العميل والباقة</th><th>الرصيد</th><th>فترة الصلاحية</th><th>الحالة المالية</th><th>الحالة والإجراءات</th></tr></thead><tbody>{filtered.map(pkg => { const person = client(pkg.client_id); const sessionBookings = sessionBookingsFor(pkg); const pkgStatus=effectiveStatus(pkg); const canPay=canAssign&&packageFinancialSummary(pkg).outstandingCents>0&&['active','expired','suspended','completed'].includes(pkgStatus); return <PackageRow key={pkg.id} pkg={pkg} person={person} canAdjust={canAdjust} canViewDetails={canViewDetails} canBook={canAssign && packageBookingAvailability(pkg, today()).bookable} canPay={canPay} canStart={canAssign && packageCanStartToday(pkg)} running={sessionBookings.some(booking => booking.status === 'in_progress')} status={pkgStatus} onBook={event => openPackageBooking(pkg, event)} onPay={event => openPackagePayment(pkg, event)} onStart={event => openSessionStart(pkg, person, event)} onDetails={event => openDetailsDialog(pkg, event)} onOwner={event => openPackageDialog('details', pkg, event)}/>; })}</tbody></table></div><div className="packages-mobile-list">{filtered.map(pkg => { const person = client(pkg.client_id); const sessionBookings = sessionBookingsFor(pkg); const pkgStatus=effectiveStatus(pkg); const canPay=canAssign&&packageFinancialSummary(pkg).outstandingCents>0&&['active','expired','suspended','completed'].includes(pkgStatus); return <PackageCard key={pkg.id} pkg={pkg} person={person} canAdjust={canAdjust} canViewDetails={canViewDetails} canBook={canAssign && packageBookingAvailability(pkg, today()).bookable} canPay={canPay} canStart={canAssign && packageCanStartToday(pkg)} running={sessionBookings.some(booking => booking.status === 'in_progress')} status={pkgStatus} onBook={event => openPackageBooking(pkg, event)} onPay={event => openPackagePayment(pkg, event)} onStart={event => openSessionStart(pkg, person, event)} onDetails={event => openDetailsDialog(pkg, event)} onOwner={event => openPackageDialog('details', pkg, event)}/>; })}</div></> : <Empty icon={Archive} title="لا توجد باقات مطابقة" text="غيّر عوامل البحث أو أضف أول باقة مباعة."/>}

    {formOpen && <AddPackageDialog dialogRef={addDialogRef} form={form} errors={formErrors} clients={visibleClients} serviceGroups={serviceGroups} selectedTemplate={selectedTemplate} dirty={formDirty} expiry={expiryPreview} busy={formBusy} clientSearch={clientSearch} childOpen={clientModalOpen} clientPickerTriggerRef={clientPickerTriggerRef} onClientSearch={setClientSearch} onOpenClient={() => setClientModalOpen(true)} onSelectClient={selectClient} onClose={closeAddDialog} onSubmit={submitPackage} onSelectService={selectService} onField={updateFormField} onReset={resetFormTemplate} resetNotice={templateResetNotice} resources={resources} calendarBookings={calendarBookings} appointments={saleBookings} appointment={appointment} appointmentErrors={appointmentErrors} editingAppointment={editingAppointment} usage={appointmentUsage} onAppointment={setAppointment} onSaveAppointment={saveAppointment} onEditAppointment={editAppointment} onRemoveAppointment={removeAppointment}/>}
    <ERPClientModal isOpen={clientModalOpen} nested returnFocusRef={clientPickerTriggerRef} onClose={() => setClientModalOpen(false)} onSuccess={handleClientCreated}/>

    {modal.open && <OwnerPackageControl pkg={modal.pkg} person={client(modal.pkg?.client_id)} resources={resources} returnFocusRef={dialogTriggerRef} childOpen={bookingPackage.open || paymentPackage.open} refreshToken={ownerRefreshToken} onClose={closeActionDialog} onChanged={fetchData} onNewBooking={event => openPackageBooking(modal.pkg, event)} onNewPayment={event => openPackagePayment(modal.pkg, event)}/>}
    {details.open && <PackageDetailsDialog dialogRef={detailsDialogRef} details={details} onClose={closeDetailsDialog} onRetry={() => fetchDetails(details.pkg.id)} onTab={tab => setDetails(current => ({ ...current, tab }))}/>}
    <ERPAddBookingModal isOpen={bookingPackage.open} initialClientId={bookingPackage.pkg?.client_id} initialPackageId={bookingPackage.pkg?.id} returnFocusRef={bookingTriggerRef} onClose={() => setBookingPackage({ open: false, pkg: null })} onSuccess={handlePackageBookingCreated}/>
    <PackagePaymentModal isOpen={paymentPackage.open} pkg={paymentPackage.pkg} person={client(paymentPackage.pkg?.client_id)} returnFocusRef={paymentTriggerRef} onClose={() => setPaymentPackage({ open: false, pkg: null })} onSuccess={handlePackagePaymentCreated}/>
    <ERPStartSessionDialog open={sessionStart.open} bookings={sessionStart.bookings} clientName={sessionStart.person?.name} contextName={sessionStart.pkg?.name} returnFocusRef={sessionTriggerRef} onClose={() => setSessionStart({ open: false, pkg: null, person: null, bookings: [] })} onStarted={handleSessionStarted} onCreateBooking={() => navigate(`/erp/bookings?client_id=${sessionStart.pkg?.client_id || ''}&package_id=${sessionStart.pkg?.id || ''}`)}/>
    <LegacyPackageImportDialog open={legacyImportOpen} clients={clients} services={services} onClose={() => setLegacyImportOpen(false)} onImported={handleLegacyImported}/>
  </div>;
}

function AddPackageDialog({ dialogRef, form, errors, clients, serviceGroups, selectedTemplate, dirty, expiry, busy, clientSearch, childOpen, clientPickerTriggerRef, onClientSearch, onOpenClient, onSelectClient, onClose, onSubmit, onSelectService, onField, onReset, resetNotice, resources, calendarBookings, appointments, appointment, appointmentErrors, editingAppointment, usage, onAppointment, onSaveAppointment, onEditAppointment, onRemoveAppointment }) {
  const errorFor = field => errors[field] ? <small className="packages-field-error" role="alert">{errors[field]}</small> : null;
  const anchoredDraft = anchorPackageDraftToBookings(form, appointments);
  const original = selectedTemplate ? templateToPackageDraft(selectedTemplate, { clientId: form.client_id, startsAt: form.starts_at }) : null;
  const financial = packageFinancialSummary({ total_price: form.total_price, paid_amount: form.paid_amount, overage_amount: 0 });
  const reelBalance = form.billing_unit === 'reel';
  const balanceUnit = reelBalance ? 'ريل' : 'ساعة';
  const balanceUnitPlural = reelBalance ? 'ريلز' : 'ساعات';
  const daily = form.validity_mode_snapshot === 'shooting_day';
  const [calendarAnchor, setCalendarAnchor] = useState(appointment.date || today());
  const resourceName = id => resources.find(resource => Number(resource.id) === Number(id))?.name || 'مورد';
  const occupiedForSelection = calendarBookings.filter(item => Number(item.resource_id) === Number(appointment.resource_id) && String(item.date).slice(0, 10) === appointment.date && ['confirmed', 'in_progress'].includes(item.status));
  const calendarDays = useMemo(() => packageCalendarWeek(calendarAnchor, { startsAt: anchoredDraft.starts_at, expiresAt: expiry === '—' ? '' : expiry, shootingDate: daily ? anchoredDraft.shooting_date : '', resourceId: appointment.resource_id, occupied: calendarBookings, appointments }), [calendarAnchor, anchoredDraft.starts_at, anchoredDraft.shooting_date, expiry, daily, appointment.resource_id, calendarBookings, appointments]);
  const calendarLabel = calendarDays.length ? `${calendarDays[0].date} — ${calendarDays.at(-1).date}` : '';
  const chooseCalendarDay = day => { if (day.disabled) return; setCalendarAnchor(day.date); onAppointment(current => ({ ...current, date: day.date })); };
  return <div className="packages-modal packages-sale-modal" onMouseDown={event => { if (!childOpen && event.target === event.currentTarget) onClose(); }}>
    <form ref={dialogRef} className="packages-dialog large packages-sale-dialog" role="dialog" aria-modal="true" aria-labelledby="add-package-title" aria-describedby="add-package-description" aria-hidden={childOpen ? 'true' : undefined} inert={childOpen ? true : undefined} onSubmit={onSubmit} noValidate>
      <button type="button" aria-label="إغلاق نافذة إضافة الباقة" className="packages-close" onClick={onClose}><X/></button>
      <span className="packages-dialog-kicker"><PackagePlus/> عملية بيع جديدة</span>
      <h3 id="add-package-title">إضافة باقة لعميل</h3>
      <p id="add-package-description">اختر العميل والقالب؛ ستظهر شروطه كاملة ويمكن مراجعتها أو تعديلها قبل إنشاء الرصيد والدفعة.</p>
      <div className="packages-form-grid packages-sale-selectors">
        <div className="packages-client-picker">
          <div className="packages-client-picker-heading"><span>العميل</span><button ref={clientPickerTriggerRef} type="button" className="packages-new-client" onClick={onOpenClient}><UserPlus/>＋ عميل جديد</button></div>
          <label className="packages-client-search"><span>البحث باسم العميل</span><span className="packages-client-search-control"><Search/><input data-dialog-initial type="search" value={clientSearch} onChange={event => onClientSearch(event.target.value)} placeholder="اكتب اسم العميل" autoComplete="off"/></span></label>
          <label className="packages-client-select"><span className="sr-only">اختر العميل</span><select aria-label="اختر العميل" aria-invalid={Boolean(errors.client_id)} value={form.client_id} onChange={event => onSelectClient(event.target.value)}><option value="">اختر العميل</option>{clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errorFor('client_id')}</label>
        </div>
        <label>قالب الخدمة<select aria-invalid={Boolean(errors.service_id)} value={form.service_id} onChange={event => onSelectService(event.target.value)}><option value="">اختر الخدمة</option>{serviceGroups.map(group => <optgroup key={group.key} label={group.label}>{group.services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select>{errorFor('service_id')}</label>
      </div>
      {selectedTemplate && <section className={`packages-template-snapshot${dirty ? ' is-dirty' : ''}`} aria-label="ملخص قالب الخدمة">
        <div><span>القالب المختار</span><strong>{selectedTemplate.name}</strong><small>{dirty ? 'تم تعديل بعض شروط القالب' : 'مطابق لشروط القالب الأصلية'}</small></div>
        <dl><div><dt>الرصيد الأصلي</dt><dd>{original?.quantity} {original?.billing_unit === 'reel' ? 'ريل' : 'ساعة'}</dd></div><div><dt>الصلاحية</dt><dd>{original?.validity_days} يوم</dd></div><div><dt>سعر القالب</dt><dd>{money(original?.total_price)}</dd></div><div><dt>المقدم</dt><dd>{original?.deposit_percent_snapshot}%</dd></div><div><dt>حد الاستحقاق</dt><dd>{original?.payment_due_quantity} {original?.billing_unit === 'reel' ? 'ريل' : 'ساعة'}</dd></div><div><dt>سعر {original?.billing_unit === 'reel' ? 'الريل' : 'الساعة'} الإضافي</dt><dd>{money(original?.overage_price_snapshot)}</dd></div></dl>
        <button type="button" className="packages-reset-template" onClick={onReset} disabled={!dirty || busy}><TimerReset/> استعادة شروط القالب</button>
        {resetNotice && <p className="packages-reset-outcome" role="status">{resetNotice}</p>}
      </section>}
      <fieldset className="packages-sale-section packages-payment-section packages-sale-basics">
        <legend><CircleDollarSign/><span><strong>السعر والدفع</strong><small>راجع الرقمين الأساسيين قبل الحفظ.</small></span></legend>
        <div className="packages-form-grid packages-sale-grid">
          <label>السعر الإجمالي<input aria-invalid={Boolean(errors.total_price)} type="number" min="0" step="0.01" value={form.total_price} onChange={event => onField('total_price', event.target.value)}/>{errorFor('total_price')}</label>
          <label>المبلغ المدفوع<input aria-invalid={Boolean(errors.paid_amount)} type="number" min="0" step="0.01" max={form.total_price || undefined} value={form.paid_amount} onChange={event => onField('paid_amount', event.target.value)}/><small className="packages-field-help">سيُسجل هذا المبلغ فقط كإيراد.</small>{errorFor('paid_amount')}</label>
        </div>
      </fieldset>
      <details className="packages-progressive-section">
        <summary><span><strong>تعديل تفاصيل الباقة</strong><small>الاسم والرصيد والصلاحية والشروط التجارية</small></span></summary>
        <div className="packages-sale-groups">
        <fieldset className="packages-sale-section packages-balance-section">
          <legend><Clock3/><span><strong>الرصيد والصلاحية</strong><small>حدد ما يملكه العميل ومدة استخدامه.</small></span></legend>
          <div className="packages-form-grid packages-sale-grid">
            <label>اسم الباقة<input aria-invalid={Boolean(errors.name)} value={form.name} onChange={event => onField('name', event.target.value)}/>{errorFor('name')}</label>
            <label>وحدة الرصيد<select aria-invalid={Boolean(errors.billing_unit)} value={form.billing_unit} onChange={event => onField('billing_unit', event.target.value)}><option value="hour">ساعة</option><option value="reel">ريل</option></select>{errorFor('billing_unit')}</label>
            <label>رصيد الباقة ({balanceUnitPlural})<input aria-invalid={Boolean(errors.quantity)} type="number" min="0.01" step={reelBalance ? '1' : '0.01'} value={form.quantity} onChange={event => onField('quantity', event.target.value)}/><small className="packages-field-help">الرصيد الذي يصبح متاحًا للعميل بوحدة {balanceUnit}.</small>{errorFor('quantity')}</label>
            <label>حد الاستحقاق ({balanceUnit})<input aria-invalid={Boolean(errors.payment_due_quantity)} type="number" min="0" max={form.quantity || undefined} step={reelBalance ? '1' : '0.01'} value={form.payment_due_quantity} onChange={event => onField('payment_due_quantity', event.target.value)}/><small className="packages-field-help">يظهر تنبيه السداد عند بلوغ هذا الاستهلاك.</small>{errorFor('payment_due_quantity')}</label>
            <div className="packages-validity-anchor packages-field-wide" role="status"><CalendarClock/><span><strong>بداية الصلاحية: {anchoredDraft.starts_at ? formatBookingDate(anchoredDraft.starts_at) : 'تُحدد عند أول حجز تصوير'}</strong><small>{daily ? 'الباقة اليومية صالحة في يوم أول حجز فقط.' : `كل الأيام التقويمية محسوبة، بما فيها الجمعة. الانتهاء: ${expiry === '—' ? 'بعد تحديد أول حجز' : expiry}`}</small></span></div>
            {!daily && <label>مدة الصلاحية بالأيام<input aria-invalid={Boolean(errors.validity_days)} type="number" min="1" step="1" value={form.validity_days} onChange={event => onField('validity_days', event.target.value)}/><small className="packages-field-help">يوم أول حجز هو اليوم رقم 1.</small>{errorFor('validity_days')}</label>}
          </div>
        </fieldset>
        <fieldset className="packages-sale-section packages-payment-section">
          <legend><CircleDollarSign/><span><strong>السعر والدفع</strong><small>راجع الاتفاق التجاري والدفعة الافتتاحية.</small></span></legend>
          <div className="packages-form-grid packages-sale-grid">
            <label>نسبة المقدم %<input aria-invalid={Boolean(errors.deposit_percent_snapshot)} type="number" min="0" max="100" step="0.01" value={form.deposit_percent_snapshot} onChange={event => onField('deposit_percent_snapshot', event.target.value)}/>{errorFor('deposit_percent_snapshot')}</label>
            <label>سعر {reelBalance ? 'الريل' : 'الساعة'} الإضافي<input aria-invalid={Boolean(errors.overage_price_snapshot)} type="number" min="0" step="0.01" value={form.overage_price_snapshot} onChange={event => onField('overage_price_snapshot', event.target.value)}/><small className="packages-field-help">يُحفظ مع الباقة ولا يتغير بتعديل القالب لاحقًا.</small>{errorFor('overage_price_snapshot')}</label>
            <label className="packages-field-wide">طريقة الدفع<select aria-invalid={Boolean(errors.payment_method)} value={form.payment_method} onChange={event => onField('payment_method', event.target.value)}><option value="cash">كاش</option><option value="bank_transfer">تحويل بنكي</option><option value="vodafone_cash">فودافون كاش</option><option value="instapay">إنستاباي</option></select>{errorFor('payment_method')}</label>
          </div>
        </fieldset>
        </div>
        <label className="packages-sale-notes">ملاحظات البيع<textarea value={form.notes} onChange={event => onField('notes', event.target.value)} placeholder="ملاحظات الاتفاق أو شروط خاصة تظهر مع الباقة"/></label>
      </details>
      <details className="packages-progressive-section packages-progressive-appointments">
        <summary><span><strong>إضافة موعد الآن (اختياري)</strong><small>{appointments.length ? `${appointments.length} موعد في الخطة` : 'يمكن حفظ الباقة بدون موعد'}</small></span></summary>
        <fieldset className="packages-sale-section packages-appointments-section">
        <legend><CalendarCheck2/><span><strong>المواعيد (اختيارية)</strong><small>أضف موعدًا أو أكثر، أو احفظ الباقة بدون موعد.</small></span></legend>
        <div className="packages-inline-calendar" aria-label="تقويم توافر المواعيد">
          <header>
            <div><strong>اختر يومًا من التقويم</strong><small>{appointment.resource_id ? `الإشغال الخاص بـ ${resourceName(appointment.resource_id)}` : 'اختر المورد لعرض إشغاله بدقة'}</small></div>
            <nav aria-label="التنقل بين أسابيع التقويم"><button type="button" aria-label="الأسبوع السابق" onClick={() => setCalendarAnchor(current => shiftPackageCalendarDate(current, -7))}><ChevronRight/></button><span>{calendarLabel}</span><button type="button" aria-label="الأسبوع التالي" onClick={() => setCalendarAnchor(current => shiftPackageCalendarDate(current, 7))}><ChevronLeft/></button></nav>
          </header>
          <div className={`packages-calendar-week${daily ? ' is-daily' : ''}`} role="group" aria-label={daily ? 'يوم التصوير المحدد' : `أيام الأسبوع ${calendarLabel}`}>
            {calendarDays.map(day => { const value=new Date(`${day.date}T12:00:00Z`); const active=appointment.date===day.date; return <button type="button" key={day.date} className={`${active ? 'is-selected ' : ''}${day.occupiedCount ? 'has-bookings ' : ''}${day.plannedCount ? 'has-plan' : ''}`.trim()} disabled={day.disabled} aria-pressed={active} aria-label={`${new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(value)}، ${day.occupiedCount} محجوز، ${day.plannedCount} في الخطة`} onClick={() => chooseCalendarDay(day)}><span>{new Intl.DateTimeFormat('ar-EG',{weekday:'short',timeZone:'UTC'}).format(value)}</span><strong>{new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'short',timeZone:'UTC'}).format(value)}</strong><small>{day.disabled ? 'خارج الصلاحية' : day.occupiedCount ? `${day.occupiedCount} محجوز` : 'متاح'}</small>{day.plannedCount > 0 && <em>{day.plannedCount} في الخطة</em>}</button>; })}
          </div>
          <div className="packages-calendar-legend" aria-hidden="true"><span><i className="available"/>متاح</span><span><i className="occupied"/>به حجوزات</span><span><i className="planned"/>ضمن الخطة</span></div>
        </div>
        <div className="packages-appointment-editor">
          <label>المورد<select aria-invalid={Boolean(appointmentErrors.resource_id)} value={appointment.resource_id} onChange={event => onAppointment(current => ({ ...current, resource_id: event.target.value }))}><option value="">اختر المورد</option>{resources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label>
          <label>التاريخ<input aria-invalid={Boolean(appointmentErrors.date || appointmentErrors.past)} type="date" min={today()} value={appointment.date} onChange={event => { setCalendarAnchor(event.target.value); onAppointment(current => ({ ...current, date: event.target.value })); }}/></label>
          <label>من<BusinessTimeSelect aria-invalid={Boolean(appointmentErrors.time || appointmentErrors.past)} min="12:00" max="23:45" step={15} required value={appointment.start_time} onChange={event => onAppointment(current => ({ ...current, start_time: event.target.value }))}/></label>
          <label>إلى<BusinessTimeSelect aria-invalid={Boolean(appointmentErrors.time)} min="12:15" max="24:00" step={15} required value={appointment.end_time} onChange={event => onAppointment(current => ({ ...current, end_time: event.target.value }))}/></label>
          {reelBalance && <label>عدد الريلز<input type="number" min="1" step="1" value={appointment.requested_quantity} onChange={event => onAppointment(current => ({ ...current, requested_quantity: event.target.value }))}/></label>}
          <button type="button" className="packages-add-appointment" onClick={onSaveAppointment}><Plus/>{editingAppointment >= 0 ? 'حفظ تعديل الموعد' : 'إضافة الموعد'}</button>
        </div>
        {Object.values(appointmentErrors).filter(Boolean).length > 0 && <div className="packages-appointment-error" role="alert">{Object.values(appointmentErrors).filter(Boolean)[0]}</div>}
        {occupiedForSelection.length > 0 && <div className="packages-occupied" aria-live="polite"><strong>المحجوز في هذا اليوم:</strong>{occupiedForSelection.map(item => <span key={item.id}>{formatTime12(item.start_time)}–{formatTime12(item.end_time)} · {item.client_name}</span>)}</div>}
        <div className="packages-appointment-list">{appointments.length ? appointments.map((item, index) => <article key={`${item.date}-${item.start_time}-${index}`}><CalendarClock/><div><strong>{item.date} · {formatTime12(item.start_time)}–{formatTime12(item.end_time)}</strong><span>{resourceName(item.resource_id)} · {formatDurationMinutes(appointmentDurationMinutes(item))}{reelBalance ? ` · ${item.requested_quantity} ريل` : ''}</span><small>متاح مبدئيًا · يتم التأكيد عند الحفظ</small></div><div className="packages-appointment-actions"><button type="button" aria-label="تعديل الموعد" onClick={() => onEditAppointment(index)}><Edit3/></button><button type="button" aria-label="حذف الموعد" onClick={() => onRemoveAppointment(index)}><Trash2/></button></div></article>) : <p className="packages-appointment-empty">حفظ الباقة بدون موعد الآن.</p>}</div>
        <div className={`packages-usage-strip ${usage.exceeded ? 'conflict' : ''}`} aria-live="polite"><span>المحدد <b>{usage.selected.toFixed(reelBalance ? 0 : 2)} {balanceUnitPlural}</b></span><span>المتبقي <b>{usage.remaining.toFixed(reelBalance ? 0 : 2)} {balanceUnitPlural}</b></span></div>
        </fieldset>
      </details>
      <div className="packages-sale-summary"><div><span>الإجمالي</span><strong>{money(form.total_price)}</strong></div><div><span>المدفوع</span><strong>{money(form.paid_amount)}</strong></div><div><span>المتبقي</span><strong>{money(centsToMoney(financial.outstandingCents))}</strong></div><div><span>تاريخ الانتهاء</span><strong>{expiry}</strong></div></div>
      <button className="packages-submit" disabled={busy}>{busy ? <RefreshCw className="packages-spin"/> : <PackagePlus/>}{busy ? 'جارٍ إنشاء الباقة ومواعيدها...' : appointments.length ? `حفظ الباقة و${appointments.length} موعد` : 'حفظ الباقة بدون موعد'}</button>
    </form>
  </div>;
}

function Metric({icon:Icon,label,value,warning,danger}){return <article className={warning?'warning':danger?'danger':''}><Icon/><div><span>{label}</span><strong>{value}</strong></div></article>}
function StatusBadge({status}){return <span className={`package-status ${STATUS[status]?.[1]||'unknown'}`}>{formatPackageStatus(status)}</span>}
function BalanceBar({pkg}){const summary=packageQuantitySummary(pkg);const total=Math.max(1,summary.purchased);return <div className="package-balance"><div className="package-balance-labels"><span>مستخدم <b>{formatPackageQuantity(summary.consumed,pkg.billing_unit)}</b></span><span>محجوز قادمًا <b>{formatPackageQuantity(summary.held,pkg.billing_unit)}</b></span><span>متاح جديد <b>{formatPackageQuantity(summary.available,pkg.billing_unit)}</b></span></div><div className="package-balance-bar" aria-label={`مستخدم ${formatPackageQuantity(summary.consumed,pkg.billing_unit)}، محجوز ${formatPackageQuantity(summary.held,pkg.billing_unit)}، متاح ${formatPackageQuantity(summary.available,pkg.billing_unit)}`}><i className="consumed" style={{width:`${Math.min(100,summary.consumed/total*100)}%`}}/><i className="held" style={{width:`${Math.min(100,summary.held/total*100)}%`}}/><i className="available" style={{width:`${Math.min(100,summary.available/total*100)}%`}}/></div><small>إجمالي الباقة {formatPackageQuantity(summary.purchased,pkg.billing_unit)} · المتبقي غير المستهلك {formatPackageQuantity(summary.remaining,pkg.billing_unit)}</small></div>}
function FinancialStack({pkg}){const financial=packageFinancialSummary(pkg);return <dl className="package-financial-stack"><div><dt>إجمالي سعر الباقة</dt><dd>{money(centsToMoney(financial.totalCents))}</dd></div><div><dt>المدفوع</dt><dd>{money(centsToMoney(financial.paidCents))}</dd></div><div className={financial.outstandingCents>0?'due':'settled'}><dt>المتبقي</dt><dd>{money(centsToMoney(financial.outstandingCents))}</dd></div>{financial.creditCents>0&&<div className="credit"><dt>رصيد دائن للعميل</dt><dd>{money(centsToMoney(financial.creditCents))}</dd></div>}{financial.overageCents>0&&<p>يشمل المتبقي قيمة تجاوز قدرها <strong>{money(centsToMoney(financial.overageCents))}</strong></p>}</dl>}
function Actions({canAdjust,canViewDetails,canBook,canPay,canStart,running,onBook,onPay,onStart,onDetails,onOwner,sessionLabel}){return <div className="package-actions-wrap">{canBook&&<button type="button" className="package-booking-button" onClick={onBook} aria-label={`حجز موعد من ${sessionLabel || 'الباقة'}`}><CalendarCheck2 aria-hidden="true"/> حجز موعد</button>}{canPay&&<button type="button" className="package-payment-button" onClick={onPay} aria-label={`تسجيل دفعة على ${sessionLabel || 'الباقة'}`}><CircleDollarSign aria-hidden="true"/> تسجيل دفعة</button>}{running?<div className="package-session-running" role="status"><span/> التصوير جارٍ</div>:canStart?<button type="button" className="package-session-start" onClick={onStart} aria-label={`ابدأ التصوير وحساب ساعات ${sessionLabel || 'الباقة'}`}><PlayCircle aria-hidden="true"/> ابدأ التصوير</button>:null}{canViewDetails&&<button className="package-details-button" onClick={onDetails}><Eye/> عرض التفاصيل</button>}{canAdjust?<button className="package-owner-button" onClick={onOwner}><MoreVertical/> تحكم المالك</button>:<small className="packages-readonly">إجراءات التصحيح للمالك فقط</small>}</div>}
function PackageRow({pkg,person,canAdjust,canViewDetails,canBook,canPay,canStart,running,status,onBook,onPay,onStart,onDetails,onOwner}){const days=remainingCalendarDays(pkg.expires_at);return <tr><td><strong>{person?.name||'عميل'}</strong><span>{person?.phone1}</span><b>{pkg.name}</b><small>#{pkg.id}</small></td><td><BalanceBar pkg={pkg}/></td><td><strong>{pkg.starts_at?formatBookingDate(pkg.starts_at):'تبدأ عند أول حجز'}</strong><span>{pkg.expires_at?`حتى ${formatBookingDate(pkg.expires_at)}`:'الانتهاء يُحسب تلقائيًا'}</span><small>{status==='expired'?'انتهت الصلاحية':pkg.expires_at?`${days.toLocaleString('ar-EG-u-nu-latn')} يوم تقويمي متبقٍ · الجمعة محسوبة`:'بانتظار أول حجز تصوير'}</small></td><td><FinancialStack pkg={pkg}/></td><td><StatusBadge status={status}/><Actions canAdjust={canAdjust} canViewDetails={canViewDetails} canBook={canBook} canPay={canPay} canStart={canStart} running={running} onBook={onBook} onPay={onPay} onStart={onStart} onDetails={onDetails} onOwner={onOwner} sessionLabel={`${pkg.name} للعميل ${person?.name||'عميل'}`}/></td></tr>}
function PackageCard({pkg,person,canAdjust,canViewDetails,canBook,canPay,canStart,running,status,onBook,onPay,onStart,onDetails,onOwner}){const days=remainingCalendarDays(pkg.expires_at);return <article className="package-mobile-card"><header><div><strong>{person?.name||'عميل'}</strong><span>{pkg.name} · #{pkg.id}</span></div><StatusBadge status={status}/></header><BalanceBar pkg={pkg}/><FinancialStack pkg={pkg}/><dl className="package-validity-inline"><div><dt>بداية الصلاحية</dt><dd>{pkg.starts_at?formatBookingDate(pkg.starts_at):'عند أول حجز تصوير'}</dd></div><div><dt>نهاية الصلاحية</dt><dd>{pkg.expires_at?formatBookingDate(pkg.expires_at):'تُحسب تلقائيًا'}</dd></div><div><dt>الأيام التقويمية المتبقية</dt><dd>{pkg.expires_at?(status==='expired'?'0':days.toLocaleString('ar-EG-u-nu-latn')):'—'} <small>الجمعة محسوبة</small></dd></div></dl><Actions canAdjust={canAdjust} canViewDetails={canViewDetails} canBook={canBook} canPay={canPay} canStart={canStart} running={running} onBook={onBook} onPay={onPay} onStart={onStart} onDetails={onDetails} onOwner={onOwner} sessionLabel={`${pkg.name} للعميل ${person?.name||'عميل'}`}/></article>}

function PackageDetailsDialog({dialogRef,details,onClose,onRetry,onTab}){
  const data=details.data;const tab=details.tab;const packageInfo=data?.package;const financial=data?.financial;const quantities=data?.quantities;const validity=data?.validity;
  const pendingValidity=validity?.state==='pending_activation'||(!validity?.starts_at&&!validity?.expires_at);const remainingValidity=pendingValidity?null:validity?.remaining_calendar_days;
  const tabs=[['payments',ReceiptText,'سجل المدفوعات',data?.payments?.length||0],['used',History,'المواعيد المستخدمة',data?.used_bookings?.length||0],['settlements',ArrowLeftRight,'تسويات الوقت',data?.settlement_allocations?.length||0],['upcoming',CalendarCheck2,'المواعيد القادمة',data?.upcoming_bookings?.length||0],['audit',ShieldAlert,'سجل المالك',data?.audit_timeline?.length||0]];
  const moveTab=(event,index)=>{let nextIndex=null;if(event.key==='ArrowLeft')nextIndex=(index+1)%tabs.length;if(event.key==='ArrowRight')nextIndex=(index-1+tabs.length)%tabs.length;if(event.key==='Home')nextIndex=0;if(event.key==='End')nextIndex=tabs.length-1;if(nextIndex===null)return;event.preventDefault();const tabButtons=event.currentTarget.parentElement?.querySelectorAll('[role="tab"]');onTab(tabs[nextIndex][0]);requestAnimationFrame(()=>tabButtons?.[nextIndex]?.focus());};
  return <div className="packages-modal packages-details-modal" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section ref={dialogRef} className="package-statement" role="dialog" aria-modal="true" aria-labelledby="package-details-title" aria-describedby="package-details-description"><header className="package-statement-header"><div><span><PackageCheck/> كشف الباقة التشغيلي</span><h2 id="package-details-title">{packageInfo?.name||details.pkg?.name||'تفاصيل الباقة'}</h2><p id="package-details-description">{packageInfo?`${packageInfo.client.name} · الباقة #${packageInfo.id}${packageInfo.invoice_number?` · ${packageInfo.invoice_number}`:''}`:'نجمع المدفوعات والجلسات والأرصدة في كشف واحد.'}</p></div>{packageInfo&&<StatusBadge status={packageInfo.effective_status}/>}<button data-dialog-initial type="button" className="package-statement-close" onClick={onClose} aria-label="إغلاق تفاصيل الباقة"><X/></button></header>
    {details.loading?<div className="package-statement-state"><RefreshCw className="packages-spin"/><strong>جارٍ إعداد كشف الباقة</strong><p>نراجع التخصيصات والجلسات الفعلية والأرصدة.</p></div>:details.error?<div className="package-statement-state error"><ShieldAlert/><strong>تعذر تحميل التفاصيل</strong><p>{details.error}</p><button onClick={onRetry}>إعادة المحاولة</button></div>:data&&<div className="package-statement-scroll">
      <section className="package-health-strip" aria-label="مؤشرات صحة الباقة"><HealthItem label="تحصيل الباقة" value={`${financial.payment_progress_percent}%`} note={`${money(financial.paid_amount)} مدفوع`} progress={financial.payment_progress_percent} tone="payment"/><HealthItem label="استهلاك الرصيد" value={formatPackageQuantity(quantities.used,packageInfo.billing_unit)} note={`من ${formatPackageQuantity(quantities.purchased,packageInfo.billing_unit)}`} progress={quantities.purchased?Math.min(100,quantities.used/quantities.purchased*100):0} tone="usage"/><HealthItem label="الأيام التقويمية المتبقية" value={remainingValidity===null?'—':remainingValidity.toLocaleString('ar-EG-u-nu-latn')} note={pendingValidity?'تبدأ عند أول حجز':'الجمعة محسوبة'} progress={pendingValidity?0:validity.state==='expired'?100:validity.state==='near_expiry'?72:35} tone={validity.state}/></section>
      <div className="package-statement-summaries"><section className="package-statement-finance"><header><CircleDollarSign/><div><span>الحالة المالية</span><h3>ملخص التحصيل</h3></div></header><dl><div><dt>إجمالي سعر الباقة</dt><dd>{money(financial.total_price)}</dd></div><div><dt>المدفوع</dt><dd>{money(financial.paid_amount)}</dd></div><div className={Number(financial.outstanding)>0?'due':'settled'}><dt>المتبقي</dt><dd>{money(financial.outstanding)}</dd></div>{Number(financial.customer_credit)>0&&<div className="credit"><dt>رصيد دائن للعميل</dt><dd>{money(financial.customer_credit)}</dd></div>}</dl>{Number(financial.overage_amount)>0&&<p className="package-overage-note">يتضمن الرصيد المتبقي تجاوزًا بقيمة <strong>{money(financial.overage_amount)}</strong>.</p>}{financial.has_legacy_reconciliation&&<div className="package-reconciliation"><ShieldAlert/><p><strong>تسوية سجل قديم: {money(data.reconciliation.legacy_unallocated_amount)}</strong>{data.reconciliation.disclosure}</p></div>}</section>
      <section className="package-statement-hours"><header><TimerReset/><div><span>حركة الرصيد</span><h3>الساعات والاستخدام</h3></div></header><dl><div><dt>إجمالي المشترى</dt><dd>{formatPackageQuantity(quantities.purchased,packageInfo.billing_unit)}</dd></div><div><dt>المستخدم فعليًا</dt><dd>{formatPackageQuantity(quantities.used,packageInfo.billing_unit)}</dd></div><div><dt>محجوز قادمًا</dt><dd>{formatPackageQuantity(quantities.upcoming_held,packageInfo.billing_unit)}</dd></div><div><dt>المتبقي</dt><dd>{formatPackageQuantity(quantities.remaining,packageInfo.billing_unit)}</dd></div><div className="available"><dt>متاح لحجز جديد</dt><dd>{formatPackageQuantity(quantities.available,packageInfo.billing_unit)}</dd></div></dl></section>
      <section className={`package-statement-validity ${validity.state}`}><header><CalendarClock/><div><span>فترة التعاقد</span><h3>صلاحية الباقة</h3></div></header><dl><div><dt>تاريخ البداية</dt><dd>{validity.starts_at?formatBookingDate(validity.starts_at):'عند أول حجز تصوير'}</dd></div><div><dt>تاريخ الانتهاء</dt><dd>{validity.expires_at?formatBookingDate(validity.expires_at):'يُحسب تلقائيًا'}</dd></div><div><dt>الأيام التقويمية المتبقية</dt><dd>{remainingValidity===null?'—':`${remainingValidity.toLocaleString('ar-EG-u-nu-latn')} يوم`}</dd></div></dl><p>{pendingValidity?'لم تبدأ الصلاحية بعد؛ تبدأ عند أول حجز تصوير مؤكد.':'يوم أول حجز هو اليوم رقم 1، وتُحسب كل الأيام التالية بما فيها الجمعة.'}</p></section></div>
      <section className="package-history"><nav role="tablist" aria-label="سجلات الباقة" aria-orientation="horizontal">{tabs.map(([key,Icon,label,count],index)=><button key={key} id={`package-tab-${key}`} role="tab" aria-selected={tab===key} aria-controls={`package-panel-${key}`} tabIndex={tab===key?0:-1} className={tab===key?'active':''} onClick={()=>onTab(key)} onKeyDown={event=>moveTab(event,index)}><Icon/><span>{label}</span><b>{count}</b></button>)}</nav><div id={`package-panel-${tab}`} role="tabpanel" aria-labelledby={`package-tab-${tab}`} tabIndex="0">{tab==='payments'?<PaymentHistory items={data.payments}/>:tab==='used'?<UsedHistory items={data.used_bookings} billingUnit={packageInfo.billing_unit}/>:tab==='settlements'?<SettlementHistory items={data.settlement_allocations||[]} packageId={packageInfo.id}/>:tab==='upcoming'?<UpcomingHistory items={data.upcoming_bookings} billingUnit={packageInfo.billing_unit}/>:<AuditHistory items={data.audit_timeline||[]}/>}</div></section>
    </div>}</section></div>;
}
function HealthItem({label,value,note,progress,tone}){return <article className={tone}><span>{label}</span><strong>{value}</strong><small>{note}</small><div aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,progress))}%`}}/></div></article>}
function PaymentHistory({items}){if(!items.length)return <HistoryEmpty icon={ReceiptText} title="لا توجد دفعات مخصصة" text="لم تُسجل تخصيصات دفع مباشرة أو سجلات فاتورة قديمة لهذه الباقة."/>;return <div className="package-history-list">{items.map(item=><article key={`${item.allocation_source}-${item.allocation_id}`} className={item.is_exact_package_amount?'exact':'legacy'}><div className="package-history-icon">{item.is_exact_package_amount?<CheckCircle2/>:<ShieldAlert/>}</div><div className="package-history-main"><header><strong>{item.is_exact_package_amount?money(item.amount):'دفعة فاتورة قديمة'}</strong><span className={`package-record-status ${item.status}`}>{item.status==='approved'?'معتمدة':item.status||'مسجلة'}</span></header><p>{formatDateTime12(item.reviewed_at||item.created_at)} · {PAYMENT_METHODS[item.method]||item.method||'طريقة غير محددة'}</p><small>{item.reference?`مرجع ${item.reference}`:'دون مرجع'}{item.invoice_number?` · فاتورة ${item.invoice_number}`:''}{item.proof_name?' · يوجد إثبات مرفق':''}</small>{item.note&&<small className="package-payment-note">ملاحظة: {item.note}</small>}{!item.is_exact_package_amount&&<em>{item.allocation_note} مبلغ حركة الفاتورة: {money(item.amount)}</em>}</div></article>)}</div>}
function UsedHistory({items,billingUnit}){if(!items.length)return <HistoryEmpty icon={History} title="لا توجد جلسات مستخدمة" text="سيظهر هنا الوقت الفعلي المحفوظ بعد إنهاء أول جلسة مرتبطة بالباقة."/>;return <div className="package-history-list">{items.map(item=>{const legacy=item.record_type==='legacy_consumption';return <article key={item.id} className={legacy?'legacy-consumption':''}><div className="package-history-icon">{legacy?<ShieldAlert/>:<Clock3/>}</div><div className="package-history-main"><header><strong>{item.service||'جلسة تصوير'}</strong><span className={`package-record-status ${legacy?'reconciled':'completed'}`}>{legacy?'مصالحة':'مكتملة'}</span></header>{legacy?<><p>قيد استهلاك محفوظ منذ {formatBookingDate(item.date)}</p><dl><div><dt>المخصوم من الباقة</dt><dd>{formatPackageQuantity(item.consumed_quantity,billingUnit)}</dd></div></dl><em>{item.reconciliation_note}</em></>:<><p>{formatBookingDate(item.date)} · {formatTime12(item.start_time)} – {formatTime12(item.end_time)}</p><dl><div><dt>الوقت الفعلي المحفوظ</dt><dd>{formatPackageQuantity(Number(item.actual_seconds||0)/3600,'hour')}</dd></div><div><dt>المخصوم من الباقة</dt><dd>{formatPackageQuantity(item.consumed_quantity||item.actual_quantity,billingUnit)}</dd></div></dl><small>{item.ended_by_name?`أنهى الجلسة ${item.ended_by_name}`:'جلسة نهائية محفوظة'}{item.adjustment_reason?` · ${item.adjustment_reason}`:''}</small></>}</div></article>})}</div>}
function SettlementHistory({items,packageId}){if(!items.length)return <HistoryEmpty icon={ArrowLeftRight} title="لا توجد تسويات وقت" text="ستظهر هنا الجلسات التي وزّعت وقتها بين هذه الباقة وباقة أو نظام آخر."/>;const labels={original_package:'مغطى من هذه الباقة',new_package:'باقة جديدة',existing_package:'باقة أخرى',package_overage:'سعر ساعة إضافية',custom_invoice:'فاتورة مخصصة',custom_project:'مشروع مخصص',waive:'دون رسوم'};return <div className="package-history-list">{items.map(item=>{const incoming=Number(item.target_client_package_id)===Number(packageId);return <article key={`${item.settlement_id}-${item.event_key}`}><div className="package-history-icon"><ArrowLeftRight/></div><div className="package-history-main"><header><strong>{item.service||'جلسة تصوير'} · {labels[item.allocation_type]||item.allocation_type}</strong><span className="package-record-status completed">{incoming?'وارد للباقة':'تسوية موثقة'}</span></header><p>{formatDateTime12(item.settled_at||item.created_at)}</p><dl><div><dt>الوقت الفعلي</dt><dd>{formatPackageQuantity(Number(item.actual_minutes||0)/60,'hour')}</dd></div><div><dt>المخصص في هذا القيد</dt><dd>{formatPackageQuantity(Number(item.minutes||0)/60,'hour')}</dd></div>{Number(item.amount_snapshot||item.amount_due)>0&&<div><dt>القيمة</dt><dd>{money(item.amount_snapshot||item.amount_due)}</dd></div>}</dl>{item.client_note&&<small>{item.client_note}</small>}</div></article>})}</div>}
function UpcomingHistory({items,billingUnit}){if(!items.length)return <HistoryEmpty icon={CalendarCheck2} title="لا توجد مواعيد قادمة" text="لا توجد حجوزات مستقبلية مرتبطة بهذه الباقة في الحالات النشطة."/>;return <div className="package-history-list">{items.map(item=><article key={item.id}><div className="package-history-icon"><CalendarCheck2/></div><div className="package-history-main"><header><strong>{item.service||'موعد تصوير'}</strong><span className={`package-record-status ${item.status}`}>{formatBookingStatus(item.status)}</span></header><p>{formatBookingDate(item.date)} · {formatTime12(item.start_time)} – {formatTime12(item.end_time)}</p><small>المخطط: {formatPackageQuantity(item.requested_quantity,billingUnit)}{item.resource_name?` · ${item.resource_name}`:''}</small></div></article>)}</div>}
function AuditHistory({items}){if(!items.length)return <HistoryEmpty icon={ShieldAlert} title="لا توجد تصحيحات" text="ستظهر هنا تعديلات المالك والإلغاءات والأرشفة."/>;return <div className="package-history-list">{items.map(item=><article key={item.id}><div className="package-history-icon"><ShieldAlert/></div><div className="package-history-main"><header><strong>{item.action}</strong><span className="package-record-status reconciled">موثق</span></header><p>{formatDateTime12(item.created_at)} · {item.actor_name||'مالك النظام'}</p></div></article>)}</div>}
function HistoryEmpty({icon:Icon,title,text}){return <div className="package-history-empty"><Icon/><strong>{title}</strong><p>{text}</p></div>}
function Empty({icon:Icon,title,text,spin}){return <div className="packages-empty"><Icon className={spin?'packages-spin':''}/><h3>{title}</h3><p>{text}</p></div>}
