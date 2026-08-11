import { useCallback, useState, useEffect, useRef } from 'react';
import { dataClient } from '../dataClient';
import { CalendarPlus, Trash2, DollarSign, X, CheckCircle, Truck, Pointer, PackageCheck, Clock3, WalletCards, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import { calculateDurationMinutes, cairoDateKey, centsToMoney, effectivePackageStatus, formatBookingDate, formatEGP, formatPackageQuantity, formatTime12, isValidBusinessBooking } from '../lib/businessFormat';
import useModalDialog from '../hooks/useModalDialog';
import ERPClientModal from './ERPClientModal';
import { applyBookingClientToDraft, bookingClientIndicatorStyle, resolveCreatedBookingClient } from './bookingClientSelection';
import CustomServiceForm from './CustomServiceForm';
import './ERPProjectsCustomServices.css';
import './ERPAddBookingModal.css';
import { activeServiceCategories, isProjectServiceCategory } from '../lib/serviceCategories';
import { packageBookingAvailability, packageBookingSnapshot, packagesForBookingClient, validatePackageBookingDraft } from './packageBookingSelection';

const NEW_CLIENT_OPTION = '__create_new_client__';
export const CUSTOM_SERVICE_OPTION = '__custom_service__';

const ERPAddBookingModal = ({ isOpen, onClose, onSuccess, prefilledClientName = '', initialClientId = '', initialPackageId = '', returnFocusRef }) => {
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useModalDialog(isOpen, close, { returnFocusRef });
  const clientSelectRef = useRef(null);
  const initialSelectionAppliedRef = useRef(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [clientPackages, setClientPackages] = useState([]);
  const [bookings, setBookings] = useState([]); // for validation and calendar events
  const [loading, setLoading] = useState(true);
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState('');

  const [newBooking, setNewBooking] = useState({
    client_id: '',
    client_name: prefilledClientName,
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
    schedule_extra: false,
    client_package_id: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: bData }, { data: cData }, { data: sData }, { data: pData }] = await Promise.all([
      dataClient.from('bookings').select('*'),
      dataClient.from('clients').select('id,name,color'),
      dataClient.from('services').select('*'),
      dataClient.from('client_packages').select('*').order('expires_at', { ascending: true }),
    ]);

    if (bData) setBookings(bData);
    if (cData) {
      setClients(cData);
    }
    if (sData) setServices(sData);
    if (pData) setClientPackages(pData);

    if (!initialSelectionAppliedRef.current) {
      const initialClient = (cData || []).find(c => String(c.id) === String(initialClientId))
        || (cData || []).find(c => c.name === prefilledClientName);
      const initialPackage = initialClient && (pData || []).find(pkg => String(pkg.id) === String(initialPackageId) && String(pkg.client_id) === String(initialClient.id));
      if (initialClient) {
        const initialService = initialPackage && (sData || []).find(service => String(service.id) === String(initialPackage.service_id));
        setNewBooking(prev => ({
          ...applyBookingClientToDraft(prev, initialClient),
          client_package_id: initialPackage ? String(initialPackage.id) : '',
          category: initialService?.category || '',
          service: initialService?.name || '',
          base_price: initialService?.price || 0,
          schedule_extra: Boolean(initialPackage && initialPackage.billing_unit === 'reel'),
        }));
      }
      initialSelectionAppliedRef.current = true;
    }
    
    setLoading(false);
  }, [initialClientId, initialPackageId, prefilledClientName]);

  useEffect(() => {
    const timer = window.setTimeout(() => { if (isOpen) {
      initialSelectionAppliedRef.current = false;
      fetchData();
      setIsClientModalOpen(false);
      if (prefilledClientName) {
        setNewBooking(prev => ({ ...prev, client_id: '', client_name: prefilledClientName, color: '#4318ff', category: '', service: '', dates: [], paid: 0, discount: 0, discount_reason: '', base_price: 0, schedule_extra: false, client_package_id: '' }));
      } else {
        setNewBooking({ client_id: '', client_name: '', color: '#4318ff', category: '', service: '', dates: [], delivery_date: '', base_price: 0, discount: 0, discount_reason: '', paid: 0, payment_method: 'فودافون كاش', notes: '', schedule_extra: false, client_package_id: '' });
      }
    } }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData, isOpen, prefilledClientName]);

  const getClientColor = (clientName) => {
    const client = clients.find(c => c.name === clientName);
    return client?.color || '#4318ff';
  };

  const handleClientChange = (e) => {
    const value = e.target.value;
    if (value === NEW_CLIENT_OPTION) {
      setIsClientModalOpen(true);
      return;
    }
    const client = clients.find(item => String(item.id) === value);
    setNewBooking(current => ({ ...applyBookingClientToDraft(current, client), client_package_id: '', category: '', service: '', base_price: 0, schedule_extra: false }));
  };

  const handleClientCreated = async savedClient => {
    const { data: refreshedClients, error } = await dataClient.from('clients').select('id,name,color');
    const nextClients = error ? clients : (refreshedClients || []);
    const createdClient = resolveCreatedBookingClient(nextClients, savedClient);
    if (!createdClient?.id) throw new Error('تم إنشاء العميل لكن تعذر تحديد سجله الجديد.');
    setClients(current => {
      const withoutCreated = (error ? current : nextClients).filter(item => String(item.id) !== String(createdClient.id));
      return [...withoutCreated, createdClient];
    });
    setNewBooking(current => ({ ...applyBookingClientToDraft(current, createdClient), client_package_id: '', category: '', service: '', base_price: 0, schedule_extra: false }));
  };

  const handleCategoryChange = (e) => {
    setNewBooking({ ...newBooking, category: e.target.value, service: '', base_price: 0 });
  };

  const handleServiceChange = (e) => {
    const sName = e.target.value;
    if (sName === CUSTOM_SERVICE_OPTION) {
      setCustomError('');
      setNewBooking(previous => ({ ...previous, service: CUSTOM_SERVICE_OPTION, category: 'خدمة مخصصة', base_price: 0 }));
      return;
    }
    const srv = services.find(s => s.name === sName);
    setNewBooking({ ...newBooking, service: sName, base_price: srv?.price || 0 });
  };

  const handlePackageChange = event => {
    const packageId = event.target.value;
    if (!packageId) {
      setNewBooking(current => ({ ...current, client_package_id: '', category: '', service: '', base_price: 0, schedule_extra: false }));
      return;
    }
    const pkg = clientPackages.find(item => String(item.id) === String(packageId) && String(item.client_id) === String(newBooking.client_id));
    const availability = packageBookingAvailability(pkg, cairoDateKey());
    const service = services.find(item => String(item.id) === String(pkg?.service_id));
    if (!pkg || !availability.bookable || !service) return;
    setNewBooking(current => ({
      ...current,
      client_package_id: String(pkg.id),
      category: service.category || '',
      service: service.name,
      base_price: service.price || 0,
      paid: 0,
      discount: 0,
      discount_reason: '',
      schedule_extra: pkg.billing_unit === 'reel',
      dates: current.dates.map(date => ({ ...date, requested_quantity: date.requested_quantity || 1 })),
    }));
  };

  const handleCustomServiceSubmit = async payload => {
    if (customBusy) return;
    setCustomBusy(true); setCustomError('');
    const { data, error } = await dataClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify(payload) });
    setCustomBusy(false);
    if (error) { setCustomError(error.message || 'تعذر إنشاء الخدمة المخصصة.'); return; }
    ['erpProjectsUpdated','erpBookingsUpdated','erpRequestsUpdated','erpFinanceUpdated','erpClientDashboardUpdated'].forEach(name => window.dispatchEvent(new CustomEvent(name, { detail: { project_id: data?.id, booking_id: data?.booking_id } })));
    onSuccess?.(data);
    close();
  };

  const addDateRow = (dateStr = format(new Date(), 'yyyy-MM-dd')) => {
    setNewBooking({
      ...newBooking,
      dates: [...newBooking.dates, { date: dateStr, start_time: '12:00', end_time: '13:00', requested_quantity: 1 }]
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

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    const selectedPackage = clientPackages.find(pkg => String(pkg.id) === String(newBooking.client_package_id));
    const selectedService = selectedPackage
      ? services.find(service => String(service.id) === String(selectedPackage.service_id))
      : services.find(service => service.name === newBooking.service);
    if (selectedPackage) {
      if (String(selectedPackage.client_id) !== String(newBooking.client_id)) return alert('الباقة المختارة لا تخص هذا العميل.');
      const packageError = validatePackageBookingDraft({ pkg: selectedPackage, service: selectedService, dates: newBooking.dates, todayKey: cairoDateKey() });
      if (packageError) return alert(packageError);
    }

    const photoCategories = ['تصوير بالساعة', 'باقة يومية', 'باقة شهرية'];
    if (!selectedPackage && photoCategories.includes(newBooking.category)) {
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

    const needsDates = Boolean(selectedPackage) || (!['reel', 'project'].includes(String(selectedService?.billing_unit || '')) && !isProjectServiceCategory(newBooking.category)) || newBooking.schedule_extra;
    if (needsDates && newBooking.dates.length === 0) {
      alert('يجب تحديد موعد واحد على الأقل في التقويم أو عن طريق الضغط مرتين على اليوم المختار');
      return;
    }

    const minimumMinutes = Math.max(15, Number(selectedService?.minimum_booking_minutes || 60));
    const incrementMinutes = Math.max(15, Number(selectedService?.booking_increment_minutes || 15));
    if (needsDates && newBooking.dates.some((date) => !isValidBusinessBooking(date.start_time, date.end_time, minimumMinutes) || calculateDurationMinutes(date.start_time, date.end_time) % incrementMinutes !== 0)) {
      alert(`مواعيد الحجز من 12:00 م إلى 12:00 ص، بحد أدنى ${minimumMinutes} دقيقة وبزيادات ${incrementMinutes} دقيقة حسب إعدادات الخدمة.`);
      return;
    }

    if (selectedPackage) {
      const availableBalance = packageBookingSnapshot(selectedPackage, selectedService).quantity.available;
      const requestedBalance = selectedPackage.billing_unit === 'reel'
        ? newBooking.dates.reduce((sum, row) => sum + Math.max(0, Number(row.requested_quantity || 0)), 0)
        : newBooking.dates.reduce((sum, row) => sum + (calculateDurationMinutes(row.start_time, row.end_time) / 60), 0);
      if (requestedBalance <= 0 || requestedBalance > availableBalance + 0.0001) {
        return alert(`الرصيد المطلوب ${formatPackageQuantity(requestedBalance, selectedPackage.billing_unit)} يتجاوز المتاح ${formatPackageQuantity(availableBalance, selectedPackage.billing_unit)}.`);
      }
    }

    if (!needsDates) return alert('هذه الخدمة تُدار من صفحة الباقات أو المشروعات، وليس من جدول الاستديو.');
    if (!selectedPackage && Number(newBooking.paid) > 0) return alert('سجّل الدفعة من صفحة الباقات أو المالية لربطها بسجل العميل بدقة.');

    const bookingsToInsert = newBooking.dates.map(d => {
        let hours = 0;
        if (d.start_time && d.end_time) {
          const diffInMinutes = calculateDurationMinutes(d.start_time, d.end_time);
          hours = diffInMinutes > 0 ? +(diffInMinutes / 60).toFixed(2) : 0;
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
          delivery_date: newBooking.delivery_date || null,
          status: 'مؤكد',
          notes: newBooking.notes,
          payment: newBooking.paid,
          requested_quantity: d.requested_quantity || 1,
        };
      });
    bookingsToInsert.forEach((b, i) => { if(i > 0) b.payment = 0; });

    const client=clients.find(item=>String(item.id)===String(newBooking.client_id));const service=selectedService;if(!client||!service)return alert('اختر عميلًا وخدمة مسجلين.');const results=[];for(const item of bookingsToInsert)results.push(await dataClient.request('/bookings/request',{method:'POST',body:JSON.stringify({client_id:client.id,client_package_id:selectedPackage?.id||undefined,service_id:service.id,service:service.name,date:item.date,start_time:item.start_time,end_time:item.end_time,status:'confirmed',notes:item.notes,requested_quantity:selectedPackage?.billing_unit==='reel'?Number(item.requested_quantity||1):undefined,requested_reels:selectedPackage?.billing_unit==='reel'?Number(item.requested_quantity||1):undefined})}));const error=results.find(result=>result.error)?.error;

    if (!error) {
      alert('تم إضافة الحجز بنجاح');
      onSuccess && onSuccess();
      close();
    } else {
      alert('حدث خطأ أثناء إضافة الحجز');
    }
  };

  if (!isOpen) return null;

  const selectedPackage = clientPackages.find(pkg => String(pkg.id) === String(newBooking.client_package_id));
  const selectedService = selectedPackage
    ? services.find(service => String(service.id) === String(selectedPackage.service_id))
    : services.find(service => service.name === newBooking.service);
  const clientPackageOptions = packagesForBookingClient(clientPackages, newBooking.client_id, cairoDateKey());
  const packageSnapshot = packageBookingSnapshot(selectedPackage, selectedService);
  const projectOrReel = ['reel', 'project'].includes(String(selectedService?.billing_unit || '')) || isProjectServiceCategory(newBooking.category);
  const showCalendar = Boolean(selectedPackage) || !projectOrReel || newBooking.schedule_extra;
  const showDelivery = projectOrReel;
  const bookingCategoryGroups = activeServiceCategories(services);
  const remainingPrice = Math.max(0, newBooking.base_price - newBooking.discount - newBooking.paid);

  const calendarEvents = bookings.map(b => ({
    id: b.id,
    title: b.client_name,
    start: b.date,
    color: getClientColor(b.client_name),
  }));
  const mobileCalendarBookings = [...bookings]
    .filter(booking => String(booking.date || '').slice(0, 10) >= cairoDateKey() && !['cancelled', 'completed'].includes(booking.status))
    .sort((left, right) => `${left.date || ''} ${left.start_time || ''}`.localeCompare(`${right.date || ''} ${right.start_time || ''}`))
    .slice(0, 6);

  return (
    <>
    <div className="erp-modal-overlay erp-booking-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)' }} onMouseDown={event => event.target === event.currentTarget && close()}>
      <div ref={dialogRef} className="erp-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title" inert={isClientModalOpen ? true : undefined} style={{ background: 'var(--erp-surface)', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '25px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: 'none' }}>
        
        <div className="erp-booking-modal-header" style={{ position: 'sticky', top: 0, zIndex: 4, background: '#1e293b', color: 'white', padding: '25px', borderTopLeftRadius: '25px', borderTopRightRadius: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)' }}>
          <h2 id="booking-modal-title" style={{ margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', fontSize: '1.1rem' }}>
            <CalendarPlus color="var(--erp-warning)" size={24} style={{ marginLeft: '10px' }} /> تسجيل موعد أو شراء خدمة
          </h2>
          <button type="button" className="erp-booking-modal-close" aria-label="إغلاق نموذج الحجز" onClick={close} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}>جاري التحميل...</div>
        ) : newBooking.service === CUSTOM_SERVICE_OPTION ? (
          <div className="erp-custom-booking-flow" style={{ padding: '22px' }}>
            <CustomServiceForm key={`${newBooking.client_id || 'client'}-custom`} clients={clients} initialService="custom" initialClientId={newBooking.client_id} busy={customBusy} error={customError} onSubmit={handleCustomServiceSubmit}/>
          </div>
        ) : (
          <form className="erp-booking-form" onSubmit={handleSaveBooking} style={{ padding: '25px' }}>
            
            <div className="erp-booking-primary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div className="erp-booking-client-field">
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>اسم العميل</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select ref={clientSelectRef} aria-label="اسم العميل" value={newBooking.client_id ? String(newBooking.client_id) : ''} onChange={handleClientChange} required style={{ flex: 1, minHeight: '48px', background: 'var(--erp-bg)', border: '1px solid var(--erp-border)', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    <option value="" disabled>-- اختر العميل --</option>
                    <option value={NEW_CLIENT_OPTION}>＋ تسجيل عميل جديد</option>
                    <option disabled>──────────</option>
                    {clients.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                  <span className="erp-booking-client-color"><span data-testid="booking-client-color" aria-label="لون العميل المحفوظ" title="لون العميل المحفوظ في قاعدة العملاء" className="erp-booking-client-color__swatch" style={{ ...bookingClientIndicatorStyle(newBooking.color) }}/><small>لون العميل</small></span>
                </div>
              </div>

              <div className="erp-booking-package-picker">
                <label htmlFor="booking-client-package">الباقة المباعة</label>
                <select id="booking-client-package" value={newBooking.client_package_id} onChange={handlePackageChange} disabled={!newBooking.client_id}>
                  <option value="">{newBooking.client_id ? 'اختر باقة من رصيد العميل' : 'اختر العميل أولًا'}</option>
                  {clientPackageOptions.map(pkg => (
                    <option key={pkg.id} value={String(pkg.id)} disabled={!pkg.availability.bookable}>
                      {pkg.name} · {formatPackageQuantity(packageBookingSnapshot(pkg)?.quantity.available, pkg.billing_unit)} متاح{pkg.availability.bookable ? '' : ` — ${pkg.availability.reason}`}
                    </option>
                  ))}
                </select>
                {newBooking.client_id && !clientPackageOptions.length && <small className="erp-booking-package-empty">لا توجد باقات مباعة لهذا العميل؛ يمكنك متابعة حجز خدمة عادية.</small>}
              </div>
              
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>التصنيف الرئيسي</label>
                <select value={newBooking.category} onChange={handleCategoryChange} required disabled={Boolean(selectedPackage)} title={selectedPackage ? 'التصنيف مستمد من الباقة المختارة' : undefined} style={{ width: '100%', background: 'var(--erp-bg)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-primary)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <option value="" disabled>-- التصنيف --</option>
                  {bookingCategoryGroups.map(group => <option key={group.value} value={group.value}>{group.label} ({group.services.length.toLocaleString('ar-EG')})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>اسم الخدمة</label>
                <select value={newBooking.service} onChange={handleServiceChange} required disabled={Boolean(selectedPackage)} title={selectedPackage ? 'الخدمة مرتبطة بالباقة ولا يمكن تغييرها' : undefined} style={{ width: '100%', background: 'var(--erp-bg)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <option value="" disabled>-- اختر الخدمة --</option>
                  {services.filter(s => Number(s.is_active ?? 1) === 1 && !s.archived_at && s.category === newBooking.category).map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                  <option disabled>──────────</option>
                  <option value={CUSTOM_SERVICE_OPTION}>＋ خدمة مخصصة جديدة</option>
                </select>
              </div>
            </div>

            {packageSnapshot && <PackageBookingSummary snapshot={packageSnapshot}/>}

            <hr style={{ opacity: 0.1, margin: '20px 0' }} />

            {showDelivery && !selectedPackage && (
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
                    locale={ar}
                    direction="rtl"
                    firstDay={6}
                    events={calendarEvents}
                    height={350}
                    headerToolbar={{ left: 'prev,next', center: 'title', right: 'today' }}
                    buttonText={{ today: 'اليوم' }}
                    dayMaxEvents={2}
                    dateClick={(info) => addDateRow(info.dateStr)}
                    eventDidMount={(info) => { info.el.setAttribute('aria-label', `حجز ${info.event.title}`); info.el.setAttribute('title', info.event.title); }}
                    dayCellClassNames={(arg) => arg.date.getDay() === 5 ? ['fc-day-fri'] : []}
                  />
                </div>

                <section className="erp-booking-mobile-agenda" aria-label="الحجوزات القادمة الظاهرة في التقويم">
                  <header><strong>الحجوزات القادمة</strong><small>الاسم الكامل وموعده لمراجعة سريعة</small></header>
                  {mobileCalendarBookings.length ? <ul>{mobileCalendarBookings.map(booking => <li key={booking.id}><i style={{ background: getClientColor(booking.client_name) }}/><span><strong>{booking.client_name}</strong><small>{formatBookingDate(booking.date)} · {formatTime12(booking.start_time)}–{formatTime12(booking.end_time)}</small></span></li>)}</ul> : <p>لا توجد حجوزات قادمة؛ الأيام متاحة للاختيار.</p>}
                </section>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {newBooking.dates.map((dRow, idx) => (
                    <div key={idx} className="erp-booking-date-row" style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--erp-surface)', padding: '15px', borderRadius: '15px', border: '1px solid var(--erp-border)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>تاريخ الجلسة</label>
                        <input type="date" min={selectedPackage?.starts_at?.slice(0, 10)} max={selectedPackage?.expires_at?.slice(0, 10)} value={dRow.date} onChange={(e) => updateDateRow(idx, 'date', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', color: 'var(--erp-primary)', fontWeight: 'bold' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>من الساعة</label>
                        <BusinessTimeSelect min="12:00" max="23:00" value={dRow.start_time} onChange={(e) => updateDateRow(idx, 'start_time', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', fontWeight: 'bold' }} />
                      </div>
                      {selectedPackage?.billing_unit === 'reel' && <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>عدد الريلز</label>
                        <input type="number" min="1" max={packageSnapshot?.quantity.available || undefined} step="1" value={dRow.requested_quantity || 1} onChange={(e) => updateDateRow(idx, 'requested_quantity', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', color: 'var(--erp-primary)', fontWeight: 'bold' }}/>
                      </div>}
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

            {showDelivery && !selectedPackage && (
              <div style={{ background: 'rgba(255, 193, 7, 0.1)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255, 193, 7, 0.3)', marginBottom: '25px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                  <Truck size={16} style={{ marginLeft: '8px' }} /> موعد التسليم المتفق عليه
                </label>
                <input type="date" value={newBooking.delivery_date} onChange={e => setNewBooking({...newBooking, delivery_date: e.target.value})} required style={{ width: '100%', border: 'none', background: 'var(--erp-surface)', padding: '12px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }} />
              </div>
            )}

            {/* Finance Box */}
            {!selectedPackage && <div style={{ background: 'var(--erp-bg)', border: '1px solid var(--erp-border)', padding: '25px', borderRadius: '20px', marginBottom: '25px' }}>
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
            </div>}

            <div style={{ display: 'grid', gridTemplateColumns: selectedPackage ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
              {!selectedPackage && (
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>إيداع الدفعة في (خزينة)</label>
                <select value={newBooking.payment_method} onChange={e => setNewBooking({...newBooking, payment_method: e.target.value})} style={{ width: '100%', background: 'var(--erp-surface)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <option value="كاش">كاش</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="انستاباي">إنستاباي</option>
                </select>
              </div>
              )}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>ملاحظات إضافية للموعد</label>
                <input type="text" value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} placeholder="اكتب هنا أي تفاصيل إضافية..." style={{ width: '100%', border: 'none', background: 'var(--erp-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }} />
              </div>
            </div>

            <button type="submit" style={{ width: '100%', background: '#1e293b', color: 'white', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.2s' }}>
              اعتماد وتسجيل في النظام <CheckCircle size={20} style={{ marginRight: '10px' }} />
            </button>

          </form>
        )}
      </div>
    </div>
    <ERPClientModal
      isOpen={isClientModalOpen}
      nested
      returnFocusRef={clientSelectRef}
      onClose={() => setIsClientModalOpen(false)}
      onSuccess={handleClientCreated}
    />
    </>
  );
};

function PackageBookingSummary({ snapshot }) {
  const { pkg, service, quantity, financial, billingUnit, balancePercent, paymentPercent } = snapshot;
  const unitLabel = billingUnit === 'reel' ? 'ريلز' : 'ساعات';
  const status = effectivePackageStatus(pkg, cairoDateKey());
  return <section className="erp-booking-package-summary" aria-labelledby="booking-package-summary-title">
    <header>
      <div><span><PackageCheck/> الباقة المرتبطة</span><h3 id="booking-package-summary-title">{pkg.name}</h3><p>{service?.name || 'خدمة الباقة'} · {service?.category || 'تصنيف الخدمة'}</p></div>
      <strong className={`erp-booking-package-status ${status}`}>{status === 'active' ? 'نشطة وقابلة للحجز' : 'غير متاحة'}</strong>
    </header>
    <div className="erp-booking-package-panels">
      <section><h4><Clock3/> رصيد {unitLabel}</h4><dl><div><dt>إجمالي المشترى</dt><dd>{formatPackageQuantity(quantity.purchased, billingUnit)}</dd></div><div><dt>المستخدم فعليًا</dt><dd>{formatPackageQuantity(quantity.consumed, billingUnit)}</dd></div><div><dt>المحجوز في مواعيد</dt><dd>{formatPackageQuantity(quantity.held, billingUnit)}</dd></div><div className="available"><dt>متاح لحجز جديد</dt><dd>{formatPackageQuantity(quantity.available, billingUnit)}</dd></div></dl><div className="erp-booking-mini-progress"><span style={{ width: `${balancePercent}%` }}/></div></section>
      <section><h4><WalletCards/> الحالة المالية</h4><dl><div><dt>السعر الإجمالي</dt><dd>{formatEGP(centsToMoney(financial.totalCents))}</dd></div><div><dt>المدفوع</dt><dd>{formatEGP(centsToMoney(financial.paidCents))}</dd></div><div className={financial.outstandingCents ? 'due' : 'settled'}><dt>المتبقي</dt><dd>{formatEGP(centsToMoney(financial.outstandingCents))}</dd></div>{financial.creditCents > 0 && <div className="credit"><dt>رصيد دائن</dt><dd>{formatEGP(centsToMoney(financial.creditCents))}</dd></div>}</dl><div className="erp-booking-mini-progress payment"><span style={{ width: `${paymentPercent}%` }}/></div></section>
      <section><h4><CalendarPlus/> الصلاحية والشروط</h4><dl><div><dt>البداية</dt><dd>{formatBookingDate(pkg.starts_at)}</dd></div><div><dt>النهاية</dt><dd>{formatBookingDate(pkg.expires_at)}</dd></div><div><dt>حد استحقاق الدفع</dt><dd>{formatPackageQuantity(pkg.payment_due_quantity, billingUnit)}</dd></div><div><dt>نسبة العربون</dt><dd>{Number(pkg.deposit_percent_snapshot || 0).toLocaleString('ar-EG')}%</dd></div><div><dt>سعر التجاوز</dt><dd>{formatEGP(pkg.overage_price_snapshot)}</dd></div></dl>{pkg.validity_mode_snapshot === 'shooting_day' && <p className="erp-booking-daily-warning"><ShieldAlert/> باقة يومية؛ الحجز متاح في يوم التصوير فقط.</p>}</section>
    </div>
    <p className="erp-booking-finance-note">البيانات المالية للعرض فقط؛ لا يتم تسجيل دفعة جديدة من نافذة الحجز.</p>
  </section>;
}

export default ERPAddBookingModal;
