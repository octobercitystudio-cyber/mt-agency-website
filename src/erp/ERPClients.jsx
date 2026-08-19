import { useState, useEffect, useRef } from 'react';
import { dataClient } from '../dataClient';
import { UserPlus, Edit, Trash2, Search, Wallet, DollarSign, MessageCircle, CalendarPlus, CheckSquare, History, FileText, Camera, Calendar, Tag, Play, RotateCcw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ERPAddBookingModal from './ERPAddBookingModal';
import ERPClientModal from './ERPClientModal';
import { emptyClient } from './clientForm';
import { useData } from '../store/DataContext';
import ERPPageHero from './ERPPageHero';
import { ClientDirectory, ClientProfileDrawer } from './ERPClientCRM';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import { effectivePackageStatus, formatDurationMinutes, formatEGP, formatPaymentMethod, formatTime12, normalizeTime, packageFinancialSummary } from '../lib/businessFormat';
import './ERPClients.css';
import OwnerActionDialog from './OwnerActionDialog';

let globalClientsCache = null;
let globalClientsLastFetch = 0;

const ERPClients = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser: sessionUser } = useData();
  const [clients, setClients] = useState(globalClientsCache || []);
  const [loading, setLoading] = useState(!globalClientsCache);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isAddBookingModalOpen, setIsAddBookingModalOpen] = useState(false);
  const bookingTriggerRef = useRef(null);
  const [bookingClientName, setBookingClientName] = useState('');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  
  // History Modals
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyType, setHistoryType] = useState('bookings');
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isEditAppointmentModalOpen, setIsEditAppointmentModalOpen] = useState(false);
  const [currentEditAppointment, setCurrentEditAppointment] = useState(null);
  
  // Modal states
  const [isEditing, setIsEditing] = useState(false);
  const [currentClient, setCurrentClient] = useState(emptyClient);
  const [financeAction, setFinanceAction] = useState('pay_debt');
  const [financeAmount, setFinanceAmount] = useState('');
  const [financeMethod, setFinanceMethod] = useState('كاش');
  
  const [sortBy, setSortBy] = useState('active');
  const [statusFilter, setStatusFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [clientListError, setClientListError] = useState('');
  const [whatsappMsg, setWhatsappMsg] = useState('');

  // Active Packages Data
  const [activePackages, setActivePackages] = useState([]);

  // Bulk Edit State
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkOwnerQueue, setBulkOwnerQueue] = useState([]);
  const [bulkOwnerResults, setBulkOwnerResults] = useState([]);

  const fetchActivePackages = async (clientId) => {
    const { data, error } = await dataClient.from('client_packages').select('*').eq('client_id', clientId).eq('status', 'active').order('expires_at', { ascending: true });
    if (error || !data) { setActivePackages([]); return; }
    setActivePackages(data.filter(pkg => effectivePackageStatus(pkg) === 'active').map(pkg => ({ ...pkg, service: pkg.name, total_hours: pkg.billing_unit === 'hour' ? Number(pkg.purchased_quantity) : 0, total_reels: pkg.billing_unit === 'reel' ? Number(pkg.purchased_quantity) : 0, used_hours: pkg.billing_unit === 'hour' ? Number(pkg.consumed_quantity) : 0, used_reels: pkg.billing_unit === 'reel' ? Number(pkg.consumed_quantity) : 0, paid: Number(pkg.paid_amount), price: Number(pkg.total_price), discount: 0, custom_expiry: pkg.expires_at })));
  };

  const formatHours = (decimalVal) => {
    if (!decimalVal || decimalVal === 0) return "0 س";
    const h = Math.floor(decimalVal);
    const m = Math.round((decimalVal - h) * 60);
    const res = [];
    if (h > 0) res.push(`${h} س`);
    if (m > 0) res.push(`${m} د`);
    return res.join(" و ");
  };

  const fetchClients = async (force = false) => {
    setClientListError('');
    if (globalClientsCache) {
      setClients(globalClientsCache);
      setLoading(false);
      if (!force && (Date.now() - globalClientsLastFetch < 30000)) return;
    } else {
      setLoading(true);
    }
    
    const { data, error } = await dataClient.from('clients').select('*').order('id', { ascending: false });
    const { data: allBookingsData } = await dataClient.from('bookings').select('*');
    const { data: allPackagesData } = await dataClient.from('client_packages').select('*').eq('status', 'active');
    const { data: configData } = await dataClient.from('app_config').select('key, value').eq('key', 'points_validity_months');
    const validityMonths = configData && configData[0] ? parseInt(configData[0].value) || 0 : 0;

    if (!error && data) {
      if (validityMonths > 0) {
        for (let c of data) {
          if (c.points > 0 && c.points_updated_at) {
            const updatedDt = new Date(c.points_updated_at);
            updatedDt.setMonth(updatedDt.getMonth() + validityMonths);
            if (new Date() > updatedDt) {
              c.points = 0;
              c.points_updated_at = new Date().toISOString().split('T')[0];
              await dataClient.from('clients').update({ points: 0, points_updated_at: c.points_updated_at }).eq('id', c.id);
            }
          }
        }
      }

      const activePackagesByClient = {};
      const packageDebtByClient = {};
      const upcomingBookingByClient = {};
      const now = new Date();

      (allPackagesData || []).filter(pkg => effectivePackageStatus(pkg) === 'active').forEach(pkg => {
        if(!activePackagesByClient[pkg.client_id])activePackagesByClient[pkg.client_id]=[];
        activePackagesByClient[pkg.client_id].push(pkg.name);
        const due=packageFinancialSummary(pkg).outstandingCents;
        const threshold=Number(pkg.payment_due_quantity||0);
        if(due>0&&(threshold<=0||Number(pkg.consumed_quantity)>=threshold))packageDebtByClient[pkg.client_id]=true;
      });

      (allBookingsData || [])
        .filter(booking => booking.client_name && booking.date && new Date(`${booking.date}T${booking.start_time || '00:00:00'}`) >= now && !['ملغي', 'منتهي', 'cancelled', 'completed'].includes(booking.status))
        .sort((a, b) => new Date(`${a.date}T${a.start_time || '00:00:00'}`) - new Date(`${b.date}T${b.start_time || '00:00:00'}`))
        .forEach(booking => {
          if (!upcomingBookingByClient[booking.client_id]) upcomingBookingByClient[booking.client_id] = booking;
        });

      const enrichedData = data.map(c => ({
        ...c,
        isActive: !!activePackagesByClient[c.id],
        packagesList: activePackagesByClient[c.id] || [],
        hasPackageDebt: !!packageDebtByClient[c.id],
        nextBooking: upcomingBookingByClient[c.id] || null,
      }));
      setClients(enrichedData);
      globalClientsCache = enrichedData;
      if (selectedClient) {
        const updated = enrichedData.find(c => c.id === selectedClient.id);
        setSelectedClient(updated || null);
      }
    } else {
      setClientListError(error?.message || 'تعذر الوصول إلى بيانات العملاء الآن. حاول مرة أخرى.');
    }
    globalClientsLastFetch = Date.now();
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(() => fetchClients(), 0); return () => window.clearTimeout(timer); }, []); // Initial remote load.
  useEffect(() => { const timer = window.setTimeout(() => selectedClient ? fetchActivePackages(selectedClient.id) : setActivePackages([]), 0); return () => window.clearTimeout(timer); }, [selectedClient]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || sessionUser?.role !== 'owner') return;
    const selected=clients.filter(client => selectedIds.includes(client.id));
    setBulkOwnerResults(selected.map(client=>({id:client.id,name:client.name,status:'pending',message:'بانتظار فحص التأثير'})));
    setBulkOwnerQueue(selected);
  };
  const deleteClient = id => {
    if (sessionUser?.role !== 'owner') return;
    const client = clients.find(item => Number(item.id) === Number(id));
    if (client) setBulkOwnerQueue([client]);
  };

  const finishOwnerClientAction = async result => {
    if (selectedClient?.id === result.id) setSelectedClient(null);
    setBulkOwnerResults(current=>current.map(item=>Number(item.id)===Number(result.id)?{...item,status:'success',action:result.action,message:result.action==='hard_delete'?'تم الحذف النهائي':result.action==='archive'?'تمت الأرشفة':'تم تنفيذ الإجراء الآمن'}:item));
    const remaining = bulkOwnerQueue.filter(client => Number(client.id) !== Number(result.id));
    setBulkOwnerQueue(remaining);
    if (!remaining.length) setSelectedIds([]);
    await fetchClients(true);
  };
  const failOwnerClientAction=result=>setBulkOwnerResults(current=>current.map(item=>Number(item.id)===Number(result.id)?{...item,status:'failed',message:result.message||'تعذر تنفيذ الإجراء'}:item));
  const cancelBulkOwnerAction=()=>{const queuedIds=new Set(bulkOwnerQueue.map(item=>Number(item.id)));setBulkOwnerResults(current=>current.map(item=>queuedIds.has(Number(item.id))&&item.status==='pending'?{...item,status:'skipped',message:'تم تخطيه بواسطة المالك'}:item));setBulkOwnerQueue([]);setSelectedIds([])};

  const handleFinanceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    const { data: cfg } = await dataClient.from('app_config').select('key, value');
    let pSpent = 100, pEarn = 1;
    cfg?.forEach(c => {
      if (c.key === 'points_egp_spent') pSpent = Number(c.value) || 100;
      if (c.key === 'points_earned') pEarn = Number(c.value) || 1;
    });
    
    const pointsToAdd = Math.floor((financeAmount / pSpent) * pEarn);
    const newPoints = (selectedClient.points || 0) + pointsToAdd;
    const today = new Date().toISOString().split('T')[0];

    if (financeAction === 'pay_debt') {
      const newDebt = Math.max(0, (selectedClient.debt || 0) - financeAmount);
      await dataClient.from('clients').update({ debt: newDebt, points: newPoints, points_updated_at: today }).eq('id', selectedClient.id);
      await dataClient.request('/finance/manual', { method: 'POST', body: JSON.stringify({ entry_kind: 'income', category: 'legacy_client_debt', client_id: selectedClient.id, amount: financeAmount, method: financeMethod, detail: `سداد مديونية من العميل ${selectedClient.name}`, date: today, entity: 'الشركة' }) });
    } else {
      const newCredit = (selectedClient.credit || 0) + financeAmount;
      await dataClient.from('clients').update({ credit: newCredit, points: newPoints, points_updated_at: today }).eq('id', selectedClient.id);
      await dataClient.request('/finance/manual', { method: 'POST', body: JSON.stringify({ entry_kind: 'income', category: 'client_credit', client_id: selectedClient.id, amount: financeAmount, method: financeMethod, detail: `إيداع رصيد للعميل ${selectedClient.name}`, date: today, entity: 'الشركة' }) });
    }
    setIsFinanceModalOpen(false);
    setFinanceAmount(0);
    fetchClients();
  };

  const startSession = async (clientId, packageId) => {
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
      const { data: matches, error: lookupError } = await dataClient.from('bookings').select('id').eq('client_id', clientId).eq('client_package_id', packageId).eq('date', today).eq('status', 'confirmed').order('start_time', { ascending: true }).limit(1);
      if (lookupError || !matches?.length) return alert('لا يوجد موعد مؤكد اليوم مرتبط بهذه الباقة. أنشئ الحجز أولًا.');
      const { error } = await dataClient.request(`/bookings/${matches[0].id}/session/start`, { method: 'POST', body: '{}' });
      if (error) {
        console.error(error);
        alert('حدث خطأ أثناء بدء الجلسة');
      } else {
        window.dispatchEvent(new Event('sessionTimerUpdated'));
      }
    } catch (e) {
      console.error(e);
      alert('حدث خطأ بالاتصال');
    }
  };

  const openWhatsApp = () => {
    if (!selectedClient) return;
    const msg = `أهلاً بك أستاذ/ة ${selectedClient.name}،\n\nنود إعلامكم بآخر تحديثات حسابكم لدينا:\nالمديونية: ${selectedClient.debt || 0} ج.م\nالنقاط: ${selectedClient.points || 0}\n\nشكراً لثقتكم بنا.`;
    setWhatsappMsg(msg);
    setIsWhatsAppModalOpen(true);
  };

  const openHistory = async (type) => {
    if (!selectedClient) return;
    setHistoryType(type);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryData([]);

    const activeServiceNames = activePackages.map(p => p.service);

    if (type === 'finance') {
      const { data, error } = await dataClient.request(`/clients/${selectedClient.id}/payment-history`, { method: 'GET' });
      setHistoryData(error ? [] : data?.items || []);
    } else {
      const { data, error } = await dataClient.from('bookings').select('*').eq('client_name', selectedClient.name).order('id', { ascending: false });
      if (!error && data) {
        if (type === 'packages') {
          const packagesMap = {};
          data.forEach(b => {
            if (!b.service) return;
            const srvName = b.service;
            if (!packagesMap[srvName]) {
              packagesMap[srvName] = {
                id: b.id,
                serviceName: srvName,
                date: b.date,
                custom_price: b.custom_price > 0 ? b.custom_price : 0,
                discount: b.discount || 0,
                discount_reason: b.discount_reason || '',
                total_paid: 0,
                is_archived: b.service.includes('مؤرشف') || b.status === 'مؤرشف'
              };
            }
            if (b.custom_price > 0) {
              if (new Date(b.date) < new Date(packagesMap[srvName].date)) {
                packagesMap[srvName].date = b.date;
              }
              if (b.custom_price > packagesMap[srvName].custom_price) {
                packagesMap[srvName].custom_price = b.custom_price;
              }
            }
            if (b.discount > packagesMap[srvName].discount) {
              packagesMap[srvName].discount = b.discount;
              if (b.discount_reason) packagesMap[srvName].discount_reason = b.discount_reason;
            }
            packagesMap[srvName].total_paid += Number(b.payment || 0);
            if (b.service.includes('مؤرشف') || b.status === 'مؤرشف') {
               packagesMap[srvName].is_archived = true;
            }
          });
          
          let packagesList = Object.values(packagesMap).filter(p => p.custom_price > 0);
          packagesList = packagesList.filter(p => p.is_archived || !activeServiceNames.includes(p.serviceName));
          packagesList.sort((a, b) => new Date(b.date) - new Date(a.date));
          setHistoryData(packagesList);
        } else {
          let appointments = data.filter(b => b.actual_hours > 0 || b.actual_reels > 0 || (b.start_time && b.start_time !== '' && b.start_time !== '00:00'));
          
          if (activeServiceNames.length > 0) {
             appointments = appointments.filter(b => activeServiceNames.includes(b.service));
          } else {
             appointments = []; 
          }
          
          appointments.sort((a, b) => {
            const isFinishedA = a.status === 'منتهي' ? 1 : 0;
            const isFinishedB = b.status === 'منتهي' ? 1 : 0;
            if (isFinishedA !== isFinishedB) return isFinishedA - isFinishedB;

            const dateCmp = (a.date || '').localeCompare(b.date || '');
            if (dateCmp !== 0) return dateCmp;
            
            const timeCmp = (a.start_time || '').localeCompare(b.start_time || '');
            if (timeCmp !== 0) return timeCmp;
            
            return a.id - b.id;
          });
          setHistoryData(appointments);
        }
      }
    }
    setHistoryLoading(false);
  };

  const handleEditAppointmentClick = (row) => {
    if (row.status !== 'confirmed') {
      alert('يمكن تعديل موعد الحجز المؤكد فقط. الحالات الأخرى تُدار من شاشة الحجوزات والتايمر.');
      return;
    }
    setCurrentEditAppointment({ ...row, start_time: normalizeTime(row.start_time), end_time: normalizeTime(row.end_time, { endOfDay: true }) });
    setIsEditAppointmentModalOpen(true);
  };

  const handleSaveEditAppointment = async (e) => {
    e.preventDefault();
    const { error } = await dataClient.request(`/bookings/${currentEditAppointment.id}/admin-reschedule`, { method: 'POST', body: JSON.stringify({
      date: currentEditAppointment.date,
      start_time: currentEditAppointment.start_time,
      end_time: currentEditAppointment.end_time,
      notes: currentEditAppointment.notes
    }) });

    if (!error) {
      setIsEditAppointmentModalOpen(false);
      openHistory('bookings');
    } else {
      alert('حدث خطأ أثناء تعديل الموعد');
    }
  };

  const handleDeleteAppointment = async (id) => {
    if (!window.confirm('هل تريد حذف الموعد نهائيًا؟ سيختفي من سجل الحجوزات ويُعاد الرصيد المحجوز.')) return;
    const { error } = await dataClient.request(`/bookings/${id}`, { method: 'DELETE' });
    if (error) return alert(error.message || 'تعذر حذف الموعد.');
    openHistory('bookings');
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(sortedClients.map(c => c.id));
    else setSelectedIds([]);
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('ar');
  let sortedClients = clients.filter(c => {
    const matchesSearch = !normalizedSearch || [c.name, c.phone1, c.phone2, c.job, c.email]
      .some(value => String(value || '').toLocaleLowerCase('ar').includes(normalizedSearch));
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.isActive : !c.isActive);
    const hasDue = Number(c.debt) > 0 || c.hasPackageDebt;
    const matchesBalance = balanceFilter === 'all' || (balanceFilter === 'due' ? hasDue : balanceFilter === 'credit' ? Number(c.credit) > 0 : !hasDue && Number(c.credit || 0) <= 0);
    const matchesProfile = profileFilter === 'all' || (profileFilter === 'profiled' ? Boolean(c.job) : !c.job);
    return matchesSearch && matchesStatus && matchesBalance && matchesProfile;
  });

  if (sortBy === 'active') {
    sortedClients.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || b.id - a.id);
  } else if (sortBy === 'alpha') {
    sortedClients.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }

  const openNewClient = () => {
    setIsEditing(false);
    setCurrentClient(emptyClient);
    setIsClientModalOpen(true);
  };

  useEffect(() => {
    if (location.state?.openCreateClient !== true) return undefined;
    const timer = window.setTimeout(() => {
      setIsEditing(false);
      setCurrentClient(emptyClient);
      setIsClientModalOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.state, navigate]);

  const openEditClient = client => {
    setCurrentClient({ ...client, email: client.email || '', portalPassword: '' });
    setIsEditing(true);
    setIsClientModalOpen(true);
  };

  const openBookingForClient = client => {
    bookingTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBookingClientName(client.name);
    setIsAddBookingModalOpen(true);
  };

  const resetDirectory = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setBalanceFilter('all');
    setProfileFilter('all');
    setSortBy('active');
  };

  const filtersActive = Boolean(searchTerm || statusFilter !== 'all' || balanceFilter !== 'all' || profileFilter !== 'all' || sortBy !== 'active');
  const activeClientCount = clients.filter(client => client.isActive).length;
  const dueClientCount = clients.filter(client => Number(client.debt) > 0 || client.hasPackageDebt).length;

  return (
    <div>
      {/* Header and Controls */}
      <ERPPageHero
        icon={UserPlus}
        eyebrow="إدارة العلاقات"
        title="قاعدة العملاء"
        description="بيانات العملاء، أرصدتهم، باقاتهم وسجل التعاملات في مساحة واحدة."
        details={<div className="client-hero-summary"><div><span>إجمالي العملاء</span><strong>{clients.length.toLocaleString('ar-EG')}</strong></div><div><span>عملاء نشطون</span><strong>{activeClientCount.toLocaleString('ar-EG')}</strong></div><div><span>حسابات مستحقة</span><strong>{dueClientCount.toLocaleString('ar-EG')}</strong></div></div>}
        actions={<button data-variant="primary" className="erp-new-client-btn" onClick={openNewClient}><UserPlus size={18} /> عميل جديد</button>}
      />

      <main className="client-crm-page">
        <section className="client-crm-toolbar" aria-label="بحث وتصفية العملاء">
          <label className="client-crm-search"><Search size={18} /><input type="search" placeholder="ابحث بالاسم أو الهاتف أو النوع..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} /></label>
          <select aria-label="تصفية حسب الحالة" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">كل الحالات</option><option value="active">نشطون فقط</option><option value="inactive">غير نشطين</option>
          </select>
          <select aria-label="تصفية حسب الرصيد" value={balanceFilter} onChange={event => setBalanceFilter(event.target.value)}>
            <option value="all">كل الأرصدة</option><option value="due">عليهم مستحقات</option><option value="credit">لديهم رصيد</option><option value="clear">حسابات صافية</option>
          </select>
          <select aria-label="ترتيب العملاء" value={sortBy} onChange={event => setSortBy(event.target.value)}>
            <option value="active">النشطون أولًا</option><option value="default">الأحدث إضافة</option><option value="alpha">أبجديًا</option>
          </select>
          <button className="client-crm-toolbar__reset" type="button" onClick={resetDirectory} disabled={!filtersActive}><RotateCcw size={17} /> إعادة الضبط</button>
        </section>

        <div className="client-crm-secondary-filter">
          <span>نوع الملف</span>
          <button type="button" className={profileFilter === 'all' ? 'active' : ''} onClick={() => setProfileFilter('all')}>الكل</button>
          <button type="button" className={profileFilter === 'profiled' ? 'active' : ''} onClick={() => setProfileFilter('profiled')}>نوع مسجل</button>
          <button type="button" className={profileFilter === 'unprofiled' ? 'active' : ''} onClick={() => setProfileFilter('unprofiled')}>غير مكتمل</button>
        </div>

        <div className="client-crm-resultbar"><span>عرض <strong>{sortedClients.length.toLocaleString('ar-EG')}</strong> من {clients.length.toLocaleString('ar-EG')}</span>{loading && <span>جارٍ التحديث…</span>}</div>
        {selectedIds.length > 0 && sessionUser?.role === 'owner' && <div className="client-crm-bulkbar"><span>تم تحديد {selectedIds.length.toLocaleString('ar-EG')} عميل · ستتم مراجعة تأثير كل ملف</span><button type="button" onClick={handleBulkDelete}><Trash2 size={17} /> حذف / أرشفة المحدد</button></div>}
        {bulkOwnerResults.length>0&&<section className="client-bulk-outcomes" aria-live="polite"><header><div><strong>نتيجة إجراء العملاء المحددين</strong><span>{bulkOwnerResults.filter(item=>item.status!=='pending').length.toLocaleString('ar-EG')} من {bulkOwnerResults.length.toLocaleString('ar-EG')} تمت مراجعتهم</span></div>{bulkOwnerQueue.length===0&&<button type="button" onClick={()=>setBulkOwnerResults([])}>إغلاق النتائج</button>}</header><ul>{bulkOwnerResults.map(item=><li key={item.id} data-status={item.status}><span>{item.name}</span><strong>{item.status==='success'?(item.action==='hard_delete'?'محذوف':'مؤرشف'):item.status==='failed'?'فشل':item.status==='skipped'?'تم التخطي':'بانتظار المراجعة'}</strong><small>{item.message}</small></li>)}</ul></section>}

        <ClientDirectory clients={sortedClients} loading={loading} error={clientListError} selectedIds={selectedIds} onToggleAll={toggleSelectAll} onToggleOne={toggleSelectOne} onOpen={setSelectedClient} onBook={openBookingForClient} onEdit={openEditClient} onDelete={finishOwnerClientAction} currentUser={sessionUser} onRetry={() => fetchClients(true)} />
      </main>

      {bulkOwnerQueue[0] && <OwnerActionDialog entity="clients" record={bulkOwnerQueue[0]} label={bulkOwnerQueue[0].name} onClose={cancelBulkOwnerAction} onChanged={finishOwnerClientAction} onError={failOwnerClientAction} />}

      {selectedClient && <ClientProfileDrawer client={selectedClient} activePackages={activePackages} formatHours={formatHours} onClose={() => setSelectedClient(null)} onEdit={() => openEditClient(selectedClient)} onBook={() => openBookingForClient(selectedClient)} onOpenCalendar={() => navigate('/erp/bookings')} onWhatsApp={openWhatsApp} onFinance={action => { setFinanceAction(action); setFinanceMethod('كاش'); setIsFinanceModalOpen(true); }} onStartSession={startSession} onOpenHistory={openHistory} />}

      <div hidden>
      <div className="erp-page-tools" aria-label="بحث وفرز العملاء">
        <label className="erp-page-tools__search">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="ابحث باسم العميل..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
        {selectedIds.length > 0 && (
          <button onClick={handleBulkDelete} className="btn btn-danger">
            <Trash2 size={18} /> حذف المحدد ({selectedIds.length}) نهائياً
          </button>
        )}
        <select className="mobile-hidden" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="active">العملاء النشطين أولاً</option>
          <option value="default">حسب الإضافة (الأحدث)</option>
          <option value="alpha">أبجدياً (أ - ي)</option>
        </select>
      </div>

      {/* Main Layout */}
      <div className="erp-clients-layout">
        
        {/* Table Section */}
        <div style={{ background: 'var(--erp-surface)', borderRadius: '1rem', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="table-responsive desktop-table">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--erp-bg)', zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '15px 25px', borderBottom: '1px solid #dee2e6', width: '40px' }}>
                    <input type="checkbox" checked={selectedIds.length === sortedClients.length && sortedClients.length > 0} onChange={toggleSelectAll} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} />
                  </th>
                  <th style={{ padding: '15px', borderBottom: '1px solid #dee2e6', color: 'var(--erp-text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>العميل</th>
                  <th style={{ padding: '15px', borderBottom: '1px solid #dee2e6', color: 'var(--erp-text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>التواصل</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', color: 'var(--erp-text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody>
                {sortedClients.map(client => {
                  const isSelected = selectedClient?.id === client.id;
                  return (
                    <tr key={client.id} 
                      onClick={() => setSelectedClient(client)}
                      style={{ 
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: isSelected ? 'rgba(67, 24, 255, 0.15)' : 'transparent',
                        borderRight: isSelected ? '4px solid #4318ff' : '4px solid transparent',
                        boxShadow: isSelected ? 'inset 0 0 15px rgba(67, 24, 255, 0.05)' : 'none'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--erp-bg)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '15px 25px', borderBottom: '1px solid #dee2e6' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(client.id)} onChange={() => toggleSelectOne(client.id)} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: client.color || '#4318ff', color: 'var(--erp-surface)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '800', fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(67, 24, 255, 0.2)' }}>
                            {client.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {client.name}
                              {client.isActive && <span style={{ background: '#198754', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '50rem' }}>نشط</span>}
                              {(client.debt > 0 || client.hasPackageDebt) && <span className="animate__animated animate__flash animate__infinite animate__slower" style={{ background: '#dc3545', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '50rem', fontWeight: 'bold' }}>مستحق</span>}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginTop: '2px' }}>{client.job || 'لا يوجد وظيفة مسجلة'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
                          <div style={{ direction: 'ltr', textAlign: 'right' }}>
                            <div style={{ fontWeight: 'bold', color: '#4318ff', fontSize: '0.9rem' }}>{client.phone1}</div>
                            {client.phone2 && <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)' }}>{client.phone2}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={(e) => { e.stopPropagation(); setBookingClientName(client.name); setIsAddBookingModalOpen(true); }} style={{ background: 'rgba(67, 24, 255, 0.1)', color: '#4318ff', border: '1px solid rgba(67, 24, 255, 0.2)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                              <CalendarPlus size={16} /> حجز / إضافة
                            </button>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button onClick={(e) => { e.stopPropagation(); openEditClient(client); }} style={{ background: 'rgba(13, 110, 253, 0.1)', color: '#0d6efd', border: 'none', width: '35px', height: '35px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: '0.2s' }}>
                            <Edit size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteClient(client.id, client.name); }} style={{ background: 'rgba(220, 53, 69, 0.1)', color: '#dc3545', border: 'none', width: '35px', height: '35px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: '0.2s' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile View: Client Cards */}
            <div className="mobile-card-list">
              {sortedClients.map(client => {
                const isSelected = selectedClient?.id === client.id;
                return (
                  <div key={client.id} className="mobile-client-card" onClick={() => setSelectedClient(client)} style={{ border: isSelected ? '2px solid #4318ff' : '1px solid var(--erp-border)' }}>
                    <div className="mobile-client-card-header" style={{ alignItems: 'flex-start' }}>
                      <div className="mobile-client-avatar" style={{ background: client.color || '#4318ff' }}>
                        {client.name.charAt(0)}
                      </div>
                      <div className="mobile-client-info">
                        <div className="mobile-client-name" style={{ marginBottom: '2px' }}>
                          {client.name}
                          {client.isActive && <span style={{ background: '#198754', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '50rem' }}>نشط</span>}
                          {(client.debt > 0 || client.hasPackageDebt) && <span className="animate__animated animate__flash animate__infinite animate__slower" style={{ background: '#dc3545', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '50rem', fontWeight: 'bold' }}>مستحق</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <p className="mobile-client-job" style={{ color: 'var(--erp-text-muted)', fontSize: '0.8rem', margin: 0 }}>{client.job || 'عميل'}</p>
                          <span style={{ direction: 'ltr', fontSize: '0.85rem', color: '#4318ff', fontWeight: 'bold' }}>{client.phone1}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mobile-client-actions">
                      <button onClick={(e) => { e.stopPropagation(); setBookingClientName(client.name); setIsAddBookingModalOpen(true); }} className="mobile-client-action-btn" style={{ background: 'rgba(67, 24, 255, 0.1)', color: '#4318ff' }}>
                        <CalendarPlus size={20} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openEditClient(client); }} className="mobile-client-action-btn" style={{ background: 'rgba(13, 110, 253, 0.1)', color: '#0d6efd' }}>
                        <Edit size={20} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteClient(client.id, client.name); }} className="mobile-client-action-btn" style={{ background: 'rgba(220, 53, 69, 0.1)', color: '#dc3545' }}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className={`erp-clients-details ${!selectedClient ? 'mobile-hide-empty-details' : ''}`} style={{ background: 'var(--erp-surface)', borderRadius: '1rem', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', borderTop: '4px solid #0d6efd', padding: '30px', overflowY: 'auto', maxHeight: '750px' }}>
          {!selectedClient ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <CheckSquare size={60} color="#cbd5e1" style={{ marginBottom: '15px' }} />
              <h5 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)' }}>تفاصيل العميل</h5>
              <p style={{ color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>اضغط على أي عميل من القائمة لعرض تفاصيله.</p>
            </div>
          ) : (
            <div style={{ animation: 'fadeInLeft 0.5s ease-out' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px solid #dee2e6', paddingBottom: '25px', marginBottom: '25px' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: selectedClient.color || '#4318ff', color: 'var(--erp-surface)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '800', fontSize: '2rem', margin: '0 auto 15px auto', boxShadow: '0 4px 10px rgba(67, 24, 255, 0.2)' }}>
                  {selectedClient.name.charAt(0)}
                </div>
                <h4 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {selectedClient.name}
                  {(selectedClient.debt > 0 || selectedClient.hasPackageDebt) && <span className="animate__animated animate__flash animate__infinite animate__slower" style={{ background: '#dc3545', color: '#fff', fontSize: '0.9rem', padding: '3px 10px', borderRadius: '50rem', fontWeight: 'bold' }}>مستحق</span>}
                </h4>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#ffc107', border: '1px solid #ffecb5', padding: '8px 16px', borderRadius: '50px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
                    ⭐ رصيد النقاط: <span style={{ color: '#dc3545' }}>{selectedClient.points || 0}</span>
                  </span>
                  {(selectedClient.credit > 0) && (
                    <span style={{ background: 'rgba(25, 135, 84, 0.15)', color: '#198754', border: '1px solid #badbcc', padding: '8px 16px', borderRadius: '50px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
                      💰 رصيد بالشركة: {selectedClient.credit || 0} ج.م
                    </span>
                  )}
                </div>
                
                <div className="erp-client-actions-grid" style={{ display: 'flex', flexWrap: 'nowrap', gap: '10px', background: 'var(--erp-bg)', padding: '10px', borderRadius: '1rem', border: '1px solid #dee2e6', overflowX: 'auto', marginTop: '20px' }}>
                  <button onClick={() => navigate('/erp/bookings')} style={{ background: '#0d6efd', color: 'var(--erp-surface)', padding: '10px 5px', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>
                    <CalendarPlus size={20} /> <span style={{ fontSize: '0.8rem' }}>حجز جديد</span>
                  </button>
                  <button onClick={() => { setFinanceAction('deposit'); setIsFinanceModalOpen(true); }} style={{ background: '#0dcaf0', color: 'var(--erp-text-main)', padding: '10px 5px', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>
                    <Wallet size={20} /> <span style={{ fontSize: '0.8rem' }}>إيداع رصيد</span>
                  </button>
                  <button onClick={() => { setFinanceAction('pay_debt'); setIsFinanceModalOpen(true); }} style={{ background: '#ffc107', color: 'var(--erp-text-main)', padding: '10px 5px', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>
                    <DollarSign size={20} /> <span style={{ fontSize: '0.8rem' }}>سداد مديونية</span>
                  </button>
                  <button onClick={openWhatsApp} style={{ background: '#198754', color: 'var(--erp-surface)', padding: '10px 5px', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>
                    <MessageCircle size={20} /> <span style={{ fontSize: '0.8rem' }}>إرسال تقرير</span>
                  </button>
                </div>
                
                {activePackages.some(pkg => pkg.total_hours > 0 || pkg.total_reels > 0) && (
                  <button onClick={() => startSession(selectedClient.id, activePackages[0].id)} style={{ width: '100%', background: '#dc3545', color: 'var(--erp-surface)', padding: '1.5rem', borderRadius: '1rem', fontWeight: 'bold', fontSize: '1.5rem', border: '3px solid #ffcccc', boxShadow: '0 0.5rem 1rem rgba(0,0,0,.15)', marginTop: '15px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', animation: 'pulse 2s infinite' }}>
                    <Play fill="currentColor" /> ابدأ التصوير الآن
                  </button>
                )}
              </div>

              {selectedClient.debt > 0 && (
                <div style={{ background: 'rgba(220, 53, 69, 0.15)', border: '1px solid #f5c2c7', padding: '15px', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                  <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '0.9rem' }}>إجمالي المديونية المتأخرة المستحقة:</span>
                  <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>{formatEGP(selectedClient.debt)}</span>
                </div>
              )}

              {/* Active Packages */}
              {activePackages.length > 0 && (
                <div>
                  <h5 style={{ color: 'var(--erp-text-main)', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Camera color="#4318ff" size={20} /> باقة التصوير النشطة:
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {activePackages.map((pkg, idx) => {
                      const totalHours = pkg.total_hours;
                      const totalReels = pkg.total_reels;
                      const remHours = Math.max(0, totalHours - pkg.used_hours);
                      const remReels = Math.max(0, totalReels - pkg.used_reels);
                      const remainingPaid = Math.max(0, pkg.price - pkg.paid);
                      
                      return (
                        <div key={idx} style={{ background: 'var(--erp-surface)', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '20px', position: 'relative', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.05)' }}>
                          <div style={{ position: 'absolute', top: '15px', right: 0, bottom: '15px', width: '4px', background: '#0d6efd', borderRadius: '10px 0 0 10px' }}></div>
                          <h5 style={{ fontWeight: 'bold', color: '#0d6efd', marginBottom: '20px', textAlign: 'right', marginRight: '15px' }}>{pkg.service.replace(' (مؤرشف)', '')}</h5>
                          
                          {/* Stats 3 Boxes */}
                          {totalHours > 0 && (
                            <div className="erp-package-stats" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>المتبقي</div>
                                <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1.1rem', direction: 'rtl' }}>{formatHours(remHours)}</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>المستخدم</div>
                                <div style={{ fontWeight: 'bold', color: '#0d6efd', fontSize: '1.1rem', direction: 'rtl' }}>{formatHours(pkg.used_hours)}</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>الباقة</div>
                                <div style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', fontSize: '1.1rem', direction: 'rtl' }}>{totalHours} س</div>
                              </div>
                            </div>
                          )}

                          {totalReels > 0 && (
                            <div className="erp-package-stats" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>المتبقي</div>
                                <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1.1rem' }}>{remReels} ريل</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>المستخدم</div>
                                <div style={{ fontWeight: 'bold', color: '#0d6efd', fontSize: '1.1rem' }}>{pkg.used_reels} ريل</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>الباقة</div>
                                <div style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', fontSize: '1.1rem' }}>{totalReels} ريل</div>
                              </div>
                            </div>
                          )}

                          {/* Finance 3 Boxes */}
                          <div className="erp-package-stats" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ flex: 1, background: 'rgba(220, 53, 69, 0.15)', borderRadius: '10px', padding: '12px 5px', textAlign: 'center', border: '1px solid #f5c2c7' }}>
                              <div style={{ fontSize: '0.8rem', color: '#dc3545', marginBottom: '2px', fontWeight: 'bold' }}>المتبقي</div>
                              <div style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '1rem' }}>{formatEGP(remainingPaid)}</div>
                            </div>
                            <div style={{ flex: 1, background: 'rgba(25, 135, 84, 0.15)', borderRadius: '10px', padding: '12px 5px', textAlign: 'center', border: '1px solid #badbcc' }}>
                              <div style={{ fontSize: '0.8rem', color: '#198754', marginBottom: '2px', fontWeight: 'bold' }}>المدفوع</div>
                              <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1rem' }}>{formatEGP(pkg.paid)}</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '10px', padding: '12px 5px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '2px', fontWeight: 'bold' }}>التكلفة</div>
                              <div style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', fontSize: '1rem' }}>{formatEGP(pkg.price)}</div>
                            </div>
                          </div>

                          {pkg.discount > 0 && (
                            <div style={{ background: 'rgba(220, 53, 69, 0.15)', borderRadius: '10px', padding: '10px', textAlign: 'center', marginBottom: '15px', border: '1px solid #f5c2c7' }}>
                              <div style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '0.9rem' }}><Tag size={14} style={{ verticalAlign: 'middle', marginLeft: '5px' }} />الخصم: {pkg.discount} ج.م</div>
                            </div>
                          )}

                          {remainingPaid > 0 && (
                            <button onClick={() => { setFinanceMethod('كاش'); setIsFinanceModalOpen(true); }} style={{ width: '100%', background: '#ffc107', color: '#000', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
                              <Wallet size={18} /> سداد المتبقي
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* History Section */}
              <div className="erp-client-history-grid" style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                <button onClick={() => openHistory('packages')} style={{ flex: 1, background: 'transparent', border: '1px solid #dee2e6', padding: '15px', borderRadius: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }}>
                  <History size={24} color="#6c757d" /> <span style={{ color: 'var(--erp-text-main)', fontSize: '0.85rem', textAlign: 'center' }}>سجل الباقات والخدمات المنتهية</span>
                </button>
                <button onClick={() => openHistory('bookings')} style={{ flex: 1, background: 'transparent', border: '1px solid #dee2e6', padding: '15px', borderRadius: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }}>
                  <CalendarPlus size={24} color="#0d6efd" /> <span style={{ color: 'var(--erp-text-main)', fontSize: '0.85rem' }}>مواعيد التصوير</span>
                </button>
                <button onClick={() => openHistory('finance')} style={{ flex: 1, background: 'transparent', border: '1px solid #dee2e6', padding: '15px', borderRadius: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }}>
                  <FileText size={24} color="#198754" /> <span style={{ color: 'var(--erp-text-main)', fontSize: '0.85rem' }}>الدفعات النقدية</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
      </div>

      {/* --- MODALS --- */}
      {/* 1. Shared client modal */}
      <ERPClientModal
        isOpen={isClientModalOpen}
        client={isEditing ? currentClient : emptyClient}
        canManageAccess={sessionUser?.role === 'owner'}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={() => fetchClients(true)}
      />

      {/* 2. Finance Modal */}
      {isFinanceModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsFinanceModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{  maxWidth: '450px', borderRadius: '1.5rem', padding: '0', border: 'none', overflow: 'hidden' }}>
            <div style={{ background: financeAction === 'deposit' ? '#0dcaf0' : '#ffc107', padding: '25px', textAlign: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 'bold', color: 'var(--erp-text-main)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                <Wallet /> {financeAction === 'deposit' ? 'إيداع رصيد مالي للعميل بالشركة' : 'سداد دفعة من المديونية'}
              </h4>
            </div>
            <div style={{ padding: '30px', textAlign: 'center' }}>
              <form onSubmit={handleFinanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>المبلغ (ج.م)</label>
                  <input type="number" value={financeAmount} onChange={e => setFinanceAmount(Number(e.target.value))} required min="1" style={{ width: '100%', padding: '15px', borderRadius: '1rem', border: 'none', background: financeAction === 'deposit' ? 'rgba(13, 202, 240, 0.15)' : 'rgba(25, 135, 84, 0.15)', color: financeAction === 'deposit' ? '#0dcaf0' : '#198754', fontSize: '2rem', textAlign: 'center', fontWeight: 'bold' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>طريقة السداد / الخزينة</label>
                  <select value={financeMethod} onChange={e => setFinanceMethod(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '1rem', border: 'none', background: 'var(--erp-bg)', fontWeight: 'bold' }}>
                    <option value="كاش">كاش</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="انستاباي">إنستاباي</option>
                  </select>
                </div>
                <button type="submit" style={{ width: '100%', padding: '15px', borderRadius: '1rem', border: 'none', background: financeAction === 'deposit' ? '#0dcaf0' : '#ffc107', color: 'var(--erp-text-main)', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '10px', boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)' }}>تأكيد العملية</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. WhatsApp Modal */}
      {isWhatsAppModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsWhatsAppModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{  maxWidth: '600px', borderRadius: '1.5rem', padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#198754', padding: '25px', color: 'var(--erp-surface)' }}>
              <h4 style={{ margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageCircle /> معاينة وإرسال التقرير
              </h4>
            </div>
            <div style={{ padding: '30px', background: 'var(--erp-bg)' }}>
              <textarea style={{ width: '100%', padding: '20px', borderRadius: '1rem', border: 'none', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', resize: 'none', minHeight: '200px', fontWeight: 'bold', color: 'var(--erp-text-main)', lineHeight: '1.6' }} value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)}></textarea>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => { navigator.clipboard.writeText(whatsappMsg); alert('تم النسخ!'); }} style={{ flex: 1, padding: '12px', borderRadius: '50rem', border: '1px solid #dee2e6', background: 'var(--erp-surface)', color: 'var(--erp-text-main)', fontWeight: 'bold', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>نسخ النص</button>
                <button onClick={() => window.open(`https://wa.me/2${selectedClient.phone1}?text=${encodeURIComponent(whatsappMsg)}`, '_blank')} style={{ flex: 1, padding: '12px', borderRadius: '50rem', border: 'none', background: '#198754', color: 'var(--erp-surface)', fontWeight: 'bold', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>إرسال عبر واتساب الآن</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. History Modal */}
      {isHistoryModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{  maxWidth: '1000px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderRadius: '1.5rem', padding: '30px' }}>
            <h4 style={{ marginBottom: '25px', color: 'var(--erp-text-main)', fontWeight: 'bold' }}>
              {historyType === 'packages' ? 'سجل الباقات والخدمات المنتهية' : historyType === 'bookings' ? 'سجل مواعيد التصوير' : 'سجل الدفعات والمعاملات المالية'} 
              {' '} - {selectedClient.name}
            </h4>
            
            <div style={{ overflowY: 'auto', flex: 1, border: historyType === 'packages' ? 'none' : '1px solid #dee2e6', borderRadius: '1rem' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>جاري تحميل السجلات...</div>
              ) : historyData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>لا توجد سجلات.</div>
              ) : historyType === 'packages' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '5px' }}>
                  {historyData.map(pkg => {
                    const price = pkg.custom_price;
                    const discount = pkg.discount;
                    const paid = pkg.total_paid;
                    const remaining = price - paid;
                    const isArchived = pkg.is_archived;
                    
                    const dateObj = new Date(pkg.date);
                    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                    const dayName = days[dateObj.getDay()];
                    const formattedDate = `${dayName} ${dateObj.getDate().toString().padStart(2, '0')}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getFullYear()}`;

                    return (
                      <div key={pkg.id} style={{ background: 'var(--erp-bg)', border: '1px solid #dee2e6', borderRadius: '1rem', padding: '20px', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexDirection: 'row-reverse' }}>
                          <h5 style={{ margin: 0, fontWeight: 'bold', color: 'var(--erp-text-main)' }}>{pkg.serviceName}</h5>
                          <span style={{ padding: '5px 15px', borderRadius: '50rem', background: isArchived ? '#6c757d' : '#198754', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            {isArchived ? 'مؤرشفة (منتهية)' : 'نشطة'}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right', marginBottom: '15px', color: 'var(--erp-text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          <Calendar size={16} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                          تاريخ الاشتراك: {formattedDate}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center', marginBottom: '15px', direction: 'rtl' }}>
                          <div style={{ border: '1px solid #dee2e6', borderRadius: '0.5rem', padding: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', background: 'var(--erp-surface)' }}>
                            السعر: {price}
                          </div>
                          <div style={{ border: '1px solid #dee2e6', borderRadius: '0.5rem', padding: '10px', fontWeight: 'bold', color: '#198754', background: 'var(--erp-surface)' }}>
                            المدفوع: {paid}
                          </div>
                          <div style={{ border: '1px solid #dee2e6', borderRadius: '0.5rem', padding: '10px', fontWeight: 'bold', color: remaining > 0 ? '#dc3545' : '#198754', background: 'var(--erp-surface)' }}>
                            المتبقي: {remaining}
                          </div>
                        </div>
                        {discount > 0 && (
                          <div style={{ background: 'rgba(220, 53, 69, 0.15)', color: '#dc3545', borderRadius: '0.5rem', padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>
                            <Tag size={18} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                            خصم: {discount} ج.م
                            {pkg.discount_reason && <div style={{ fontSize: '0.85rem', marginTop: '5px', fontWeight: 'normal' }}>({pkg.discount_reason})</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--erp-bg)', zIndex: 10 }}>
                    <tr>
                      {historyType === 'finance' ? (
                        <>
                          <th style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>التاريخ</th>
                          <th style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>البيان</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>المبلغ</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>الطريقة</th>
                        </>
                      ) : (
                        <>
                          <th style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>التاريخ</th>
                          <th style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>الخدمة</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>توقيت</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>ساعات</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>ريلز</th>
                          <th style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>البيان</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>الحالة</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>المدفوع</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>إجراءات</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(row => (
                      <tr key={row.id}>
                        {historyType === 'finance' ? (
                          <>
                            <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', direction: 'ltr', textAlign: 'right' }}>{row.date}</td>
                            <td className="client-payment-history-detail" style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}><strong>{row.detail}</strong>{row.package_name&&<small>الباقة #{row.package_id} · {row.package_name}</small>}<span>{row.record_type==='payment'?(row.status==='approved'?'دفعة معتمدة':'حالة الدفعة: '+row.status):'معاملة مالية مسجلة'}{row.reference?` · المرجع: ${row.reference}`:''}</span>{row.note&&<em>ملاحظة: {row.note}</em>}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: row.record_type === 'payment' || row.entry_kind === 'income' ? '#198754' : '#dc3545' }}>{formatEGP(row.amount)}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>{formatPaymentMethod(row.method)}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {(() => {
                                const d = new Date(row.date);
                                const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                                return `${days[d.getDay()]} ${row.date}`;
                              })()}
                            </td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>{row.service}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', fontSize: '0.85rem' }}>
                              {(row.start_time && row.start_time !== '' && row.start_time !== '00:00') ? `${formatTime12(row.start_time)} - ${formatTime12(row.end_time, '?')}` : '-'}
                            </td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                              {row.actual_hours > 0 ? formatDurationMinutes(Number(row.actual_hours) * 60) : '-'}
                            </td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', fontWeight: 'bold' }}>
                              {(() => {
                                const isTimePackage = row.service && (row.service.includes('ساعة') || row.service.includes('يوم') || row.service.includes('شهر'));
                                return (!isTimePackage && row.actual_reels > 0) ? row.actual_reels : '-';
                              })()}
                            </td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', fontSize: '0.85rem', color: 'var(--erp-text-muted)' }}>{row.notes}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center' }}>
                              <span style={{ padding: '6px 12px', borderRadius: '0.5rem', background: row.status === 'منتهي' ? 'rgba(220, 53, 69, 0.15)' : 'rgba(13, 202, 240, 0.15)', color: row.status === 'منتهي' ? '#dc3545' : '#0dcaf0', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                {row.status || 'مؤكد'}
                              </span>
                            </td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', fontWeight: 'bold' }}>{formatEGP(row.payment || 0)}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                <button onClick={(e) => { e.stopPropagation(); handleEditAppointmentClick(row); }} style={{ background: 'rgba(13, 110, 253, 0.1)', color: '#0d6efd', border: 'none', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="تعديل">
                                  <Edit size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteAppointment(row.id); }} style={{ background: 'rgba(220, 53, 69, 0.1)', color: '#dc3545', border: 'none', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="حذف">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
              )}
            </div>
            
            <button onClick={() => setIsHistoryModalOpen(false)} style={{ width: '100%', marginTop: '20px', padding: '15px', borderRadius: '1rem', border: 'none', background: 'var(--erp-border)', color: 'var(--erp-text-main)', fontWeight: 'bold', cursor: 'pointer' }}>
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* New Add Booking Modal from ERPClients */}
      <ERPAddBookingModal 
        isOpen={isAddBookingModalOpen} 
        returnFocusRef={bookingTriggerRef}
        onClose={() => setIsAddBookingModalOpen(false)} 
        prefilledClientName={bookingClientName} 
      />

      {/* Edit Appointment Modal */}
      {isEditAppointmentModalOpen && currentEditAppointment && (
        <div className="erp-modal-overlay" onClick={() => setIsEditAppointmentModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{  maxWidth: '500px', borderRadius: '1.5rem', padding: '30px', border: 'none' }}>
            <h4 style={{ marginBottom: '25px', color: 'var(--erp-text-main)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Edit color="#0d6efd" /> تعديل موعد التصوير
            </h4>
            <form onSubmit={handleSaveEditAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>تاريخ الموعد</label><input required type="date" style={{ width: '100%', padding: '12px', borderRadius: '0.5rem', border: '1px solid var(--erp-border)', background: 'var(--erp-bg)', fontWeight: 'bold' }} value={currentEditAppointment.date || ''} onChange={e => setCurrentEditAppointment({...currentEditAppointment, date: e.target.value})} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>وقت البدء</label><BusinessTimeSelect min="12:00" max="23:00" style={{ width: '100%', padding: '12px', borderRadius: '0.5rem', border: '1px solid var(--erp-border)', background: 'var(--erp-bg)', fontWeight: 'bold' }} value={currentEditAppointment.start_time || ''} onChange={e => setCurrentEditAppointment({...currentEditAppointment, start_time: e.target.value})} /></div>
                <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>وقت الانتهاء</label><BusinessTimeSelect min="13:00" max="24:00" style={{ width: '100%', padding: '12px', borderRadius: '0.5rem', border: '1px solid var(--erp-border)', background: 'var(--erp-bg)', fontWeight: 'bold' }} value={currentEditAppointment.end_time || ''} onChange={e => setCurrentEditAppointment({...currentEditAppointment, end_time: e.target.value})} /></div>
              </div>
              <p style={{ margin: 0, padding: '10px 12px', borderRadius: '10px', background: 'rgba(13,110,253,.08)', color: '#0d6efd', fontSize: '.8rem', fontWeight: 700 }}>الساعات الفعلية وحالة الجلسة تُحدّثان تلقائيًا من تايمر التصوير لضمان دقة الحساب.</p>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>ملاحظات</label>
                <textarea style={{ width: '100%', padding: '12px', borderRadius: '0.5rem', border: '1px solid var(--erp-border)', background: 'var(--erp-bg)', fontWeight: 'bold', resize: 'vertical' }} value={currentEditAppointment.notes || ''} onChange={e => setCurrentEditAppointment({...currentEditAppointment, notes: e.target.value})} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '15px', borderRadius: '1rem', border: 'none', background: '#0d6efd', color: 'var(--erp-surface)', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '15px' }}>حفظ التعديلات</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ERPClients;
