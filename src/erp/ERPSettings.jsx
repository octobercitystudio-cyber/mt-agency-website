import { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'cropperjs';
import { Settings } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useData } from '../store/DataContext';
import ERPPageHero from './ERPPageHero';
import OwnerRecordActions from './OwnerRecordActions';

const ROLE_DETAILS = {
  owner: { label: 'مالك', note: 'صلاحيات كاملة وإدارة الحسابات.' },
  admin: { label: 'مدير', note: 'إدارة التشغيل والعملاء والخدمات.' },
  operations: { label: 'تشغيل وحجوزات', note: 'الحجوزات والعملاء دون الحسابات المالية الحساسة.' },
  finance: { label: 'مالية', note: 'المدفوعات والتقارير المالية.' },
  staff: { label: 'موظف محدود', note: 'وصول محدود حسب مهام الموظف.' },
};

const formatServicePrice = value => {
  const price = Number(value);
  return (Number.isFinite(price) ? price : 0).toFixed(1);
};

const ERPSettings = () => {
  const { currentUser } = useData();
  const isOwner = currentUser?.role === 'owner';
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [resources, setResources] = useState([]);
  const [resourceForm, setResourceForm] = useState({ id: null, name: '', type: 'studio' });
  const [editingUser, setEditingUser] = useState(null);
  const [p_cfg, setP_cfg] = useState({
    points_egp_spent: 100,
    points_earned: 1,
    points_redeem_threshold: 50,
    points_redeem_points: 10,
    points_discount_egp: 20,
    points_validity_months: 6
  });
  const [backupFreq, setBackupFreq] = useState('يوميا');
  const [currentLogo, setCurrentLogo] = useState('https://via.placeholder.com/150?text=No+Logo');

  // Form states
  const emptyService = { name: '', category: 'باقة شهرية', billing_unit: 'hour', price: '', total_hours: 0, payment_due_hours: 0, deposit_percent: 0, overage_price: 0, validity_days: 90, total_reels: 0, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, reason: '' };
  const [addForm, setAddForm] = useState(emptyService);
  const [editForm, setEditForm] = useState({ id: '', ...emptyService });
  const [archiveForm, setArchiveForm] = useState({ open: false, service: null, loading: false, references: 0, breakdown: {}, reason: '', confirmed: false, deleteConfirmation: '', error: '' });
  const serviceDialogTriggerRef = useRef(null);
  const [addUserForm, setAddUserForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'staff' });
  const [userState, setUserState] = useState({ busy: false, type: '', message: '' });

  const fetchData = async () => {
    const { data: sData } = await supabase.from('services').select('*').order('id', { ascending: true });
    if (sData) setServices(sData);

    const { data: cfgData } = await supabase.from('app_config').select('*');
    if (cfgData) {
      let cfgObj = { ...p_cfg };
      cfgData.forEach(item => {
        if (item.key.startsWith('points_')) cfgObj[item.key] = Number(item.value);
        if (item.key === 'backup_freq') setBackupFreq(item.value);
        if (item.key === 'system_logo') setCurrentLogo(item.value);
      });
      setP_cfg(cfgObj);
    }
    
    if (isOwner) {
      const [{ data: uData, error: usersError }, { data: resourceData }] = await Promise.all([supabase.request('/users', { method: 'GET' }), supabase.from('resources').select('*').order('id')]);
      if (usersError) setUserState({ busy: false, type: 'error', message: usersError.message || 'تعذر تحميل حسابات النظام.' });
      else setUsers(uData || []);
      setResources(resourceData || []);
    } else {
      setUsers([]);
    }
  };

  useEffect(() => { const timer = window.setTimeout(fetchData, 0); return () => window.clearTimeout(timer); }, [isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = ['addServiceModal', 'editServiceModal'];
    const cleanups = ids.map(id => {
      const modal = document.getElementById(id); if (!modal) return () => {};
      const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusables = () => [...modal.querySelectorAll(focusableSelector)].filter(element => element.offsetParent !== null);
      const onShown = () => window.requestAnimationFrame(() => (modal.querySelector('[data-service-initial]') || focusables()[0])?.focus());
      const onHidden = () => window.requestAnimationFrame(() => serviceDialogTriggerRef.current?.focus());
      const onKeyDown = event => {
        if (!modal.classList.contains('show')) return;
        if (event.key === 'Escape') { event.preventDefault(); window.bootstrap.Modal.getOrCreateInstance(modal).hide(); return; }
        if (event.key !== 'Tab') return; const items = focusables(); if (!items.length) { event.preventDefault(); return; }
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      modal.addEventListener('shown.bs.modal', onShown); modal.addEventListener('hidden.bs.modal', onHidden); document.addEventListener('keydown', onKeyDown);
      return () => { modal.removeEventListener('shown.bs.modal', onShown); modal.removeEventListener('hidden.bs.modal', onHidden); document.removeEventListener('keydown', onKeyDown); };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, []);

  const handleSavePointsSettings = async (e) => {
    e.preventDefault();
    const btn = e.nativeEvent.submitter;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> جاري الحفظ...';
    btn.disabled = true;

    for (const [key, value] of Object.entries(p_cfg)) {
      const { data } = await supabase.from('app_config').select('id').eq('key', key).single();
      if (data) await supabase.from('app_config').update({ value: value.toString() }).eq('key', key);
      else await supabase.from('app_config').insert([{ key, value: value.toString() }]);
    }
    
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-check me-2"></i> تم الحفظ بنجاح';
      btn.classList.replace('btn-warning', 'btn-success');
      setTimeout(() => { btn.innerHTML = originalText; btn.classList.replace('btn-success', 'btn-warning'); btn.disabled = false; }, 2000);
    }, 500);
  };

  const handleSaveBackupFreq = async (e) => {
    e.preventDefault();
    const { data } = await supabase.from('app_config').select('id').eq('key', 'backup_freq').single();
    if (data) await supabase.from('app_config').update({ value: backupFreq }).eq('key', 'backup_freq');
    else await supabase.from('app_config').insert([{ key: 'backup_freq', value: backupFreq }]);
    alert('تم تحديث إعدادات النسخ الاحتياطي بنجاح');
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!isOwner) return;
    const btn = e.nativeEvent.submitter;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> جاري الحفظ...';
    
    const { error } = await supabase.request('/services', { method: 'POST', body: JSON.stringify({
      name: addForm.name,
      category: addForm.category,
      billing_unit: addForm.billing_unit,
      price: Number(addForm.price) || 0,
      total_hours: Number(addForm.total_hours) || 0,
      payment_due_hours: Number(addForm.payment_due_hours) || 0,
      deposit_percent: Number(addForm.deposit_percent) || 0,
      overage_price: Number(addForm.overage_price) || 0,
      validity_days: Number(addForm.validity_days) || 0,
      total_reels: Number(addForm.total_reels) || 0,
      minimum_booking_minutes: Number(addForm.minimum_booking_minutes) || 60,
      booking_increment_minutes: Number(addForm.booking_increment_minutes) || 15,
      auto_start_timer: addForm.auto_start_timer ? 1 : 0,
      reason: addForm.reason || 'إنشاء قالب خدمة جديد بواسطة المالك',
    }) });

    if (!error) {
      await fetchData();
      setAddForm(emptyService);
      window.bootstrap.Modal.getInstance(document.getElementById('addServiceModal'))?.hide();
    } else {
      alert('حدث خطأ أثناء حفظ الخدمة');
    }
    btn.innerHTML = originalText;
  };

  const handleEditService = async (e) => {
    e.preventDefault();
    if (!isOwner) return;
    const btn = e.nativeEvent.submitter;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> جاري الحفظ...';
    
    const { error } = await supabase.request(`/services/${editForm.id}`, { method: 'PATCH', body: JSON.stringify({
      name: editForm.name,
      category: editForm.category,
      billing_unit: editForm.billing_unit,
      price: Number(editForm.price) || 0,
      total_hours: Number(editForm.total_hours) || 0,
      payment_due_hours: Number(editForm.payment_due_hours) || 0,
      deposit_percent: Number(editForm.deposit_percent) || 0,
      overage_price: Number(editForm.overage_price) || 0,
      validity_days: Number(editForm.validity_days) || 0,
      total_reels: Number(editForm.total_reels) || 0,
      minimum_booking_minutes: Number(editForm.minimum_booking_minutes) || 60,
      booking_increment_minutes: Number(editForm.booking_increment_minutes) || 15,
      auto_start_timer: editForm.auto_start_timer ? 1 : 0,
      is_active: Number(editForm.is_active ?? 1), reason: editForm.reason,
    }) });

    if (!error) {
      await fetchData();
      window.bootstrap.Modal.getInstance(document.getElementById('editServiceModal'))?.hide();
    } else {
      alert('حدث خطأ أثناء تعديل الخدمة');
    }
    btn.innerHTML = originalText;
  };

  const openArchiveService = async (service, event) => {
    if (!isOwner) return;
    serviceDialogTriggerRef.current = event.currentTarget;
    setArchiveForm({ open: true, service, loading: true, references: 0, breakdown: {}, reason: '', confirmed: false, deleteConfirmation: '', error: '' });
    const tables = [['client_packages','باقات مباعة'],['bookings','حجوزات'],['offer_items','عروض'],['invoice_items','فواتير']];
    const results = await Promise.all(tables.map(async ([table,label]) => { const { data } = await supabase.from(table).select('id').eq('service_id', service.id); return [label,(data||[]).length]; }));
    const breakdown = Object.fromEntries(results); const references = results.reduce((sum,[,count]) => sum+count,0);
    setArchiveForm(current => current.open && Number(current.service?.id) === Number(service.id) ? { ...current, loading: false, references, breakdown } : current);
  };

  const submitArchiveService = async event => {
    event.preventDefault(); const service = archiveForm.service; if (!service) return;
    const hardDelete = Boolean(Number(service.is_draft)) && archiveForm.references === 0;
    setArchiveForm(current => ({ ...current, loading: true, error: '' }));
    const { error }=await supabase.request(`/services/${service.id}/archive`,{method:'POST',body:JSON.stringify({reason:archiveForm.reason,hard_delete:hardDelete,confirmation:hardDelete?archiveForm.deleteConfirmation:''})});
    if(error)return setArchiveForm(current=>({...current,loading:false,error:error.message||'تعذر تنفيذ الإجراء الآمن.'}));
    setArchiveForm(current=>({...current,open:false,loading:false})); await fetchData();
  };
  const closeArchiveService = useCallback(() => setArchiveForm(current => ({ ...current, open: false })), []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!isOwner) return;
    if (!addUserForm.email.trim() && !addUserForm.phone.trim()) {
      setUserState({ busy: false, type: 'error', message: 'أدخل البريد الإلكتروني أو رقم الهاتف على الأقل.' });
      return;
    }
    if (addUserForm.password.length < 10) {
      setUserState({ busy: false, type: 'error', message: 'كلمة المرور يجب ألا تقل عن 10 أحرف.' });
      return;
    }
    setUserState({ busy: true, type: '', message: '' });
    const { error } = await supabase.request('/users', { method: 'POST', body: JSON.stringify({
      full_name: addUserForm.full_name, email: addUserForm.email || null, phone: addUserForm.phone || null,
      password: addUserForm.password, role: addUserForm.role,
    }) });
    if (error) {
      setUserState({ busy: false, type: 'error', message: error.message || 'تعذر إنشاء الحساب.' });
      return;
    }
    setAddUserForm({ full_name: '', email: '', phone: '', password: '', role: 'staff' });
    setUserState({ busy: false, type: 'success', message: 'تم إنشاء الحساب بأمان.' });
    const { data } = await supabase.request('/users', { method: 'GET' });
    setUsers(data || []);
    window.setTimeout(() => window.bootstrap.Modal.getInstance(document.getElementById('addUserModal'))?.hide(), 700);
  };

  const updateSystemUser = async (id, values) => {
    if (!isOwner) return;
    setUserState({ busy: true, type: '', message: '' });
    const { error } = await supabase.request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(values) });
    if (error) {
      setUserState({ busy: false, type: 'error', message: error.message || 'تعذر تحديث الحساب.' });
      return;
    }
    setUsers(prev => prev.map(user => Number(user.id) === Number(id) ? { ...user, ...values } : user));
    setUserState({ busy: false, type: 'success', message: 'تم تحديث صلاحيات الحساب.' });
  };

  const openUserEditor = user => {
    setEditingUser({ ...user, password: '' });
    window.bootstrap.Modal.getOrCreateInstance(document.getElementById('editSystemUserModal')).show();
  };

  const saveSystemUser = async event => {
    event.preventDefault(); if (!editingUser) return;
    const values = { full_name: editingUser.full_name, email: editingUser.email || null, phone: editingUser.phone || null, role: editingUser.role, is_active: Number(editingUser.is_active) };
    if (editingUser.password) values.password = editingUser.password;
    await updateSystemUser(editingUser.id, values);
    window.bootstrap.Modal.getInstance(document.getElementById('editSystemUserModal'))?.hide();
    setEditingUser(null);
  };

  const saveResource = async event => {
    event.preventDefault(); if (!isOwner || !resourceForm.name.trim()) return;
    const query = resourceForm.id ? supabase.from('resources').update({ name: resourceForm.name.trim(), type: resourceForm.type }).eq('id', resourceForm.id) : supabase.from('resources').insert([{ name: resourceForm.name.trim(), type: resourceForm.type, is_active: 1 }]);
    const { error } = await query;
    if (error) return setUserState({ busy: false, type: 'error', message: error.message || 'تعذر حفظ الاستديو/المورد.' });
    setResourceForm({ id: null, name: '', type: 'studio' }); await fetchData();
  };

  // Cropper logic
  const logoInputRef = useRef(null);
  const imageToCropRef = useRef(null);
  const cropperInstanceRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const handleLogoChange = (e) => {
    let files = e.target.files;
    if (files && files.length > 0) {
      let reader = new FileReader();
      reader.onload = function(event) {
        setImageSrc(event.target.result);
        setIsCropModalOpen(true);
      };
      reader.readAsDataURL(files[0]);
    }
    e.target.value = '';
  };

  // Ensure cropper initializes when modal opens
  useEffect(() => {
    if (isCropModalOpen && imageToCropRef.current) {
      // Small timeout to allow modal to display before cropper calculates dimensions
      setTimeout(() => {
        if (cropperInstanceRef.current) {
          cropperInstanceRef.current.destroy();
        }
        cropperInstanceRef.current = new Cropper(imageToCropRef.current, {
          aspectRatio: NaN,
          viewMode: 1,
          autoCropArea: 0.9,
        });
      }, 100);
    }
    return () => {
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
    };
  }, [isCropModalOpen]);

  const handleCropAndUpload = () => {
    if (!cropperInstanceRef.current) return;
    const btn = document.getElementById('btnCropAndUpload');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> جاري الرفع...';
    btn.disabled = true;

    cropperInstanceRef.current.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toBlob(async function(blob) {
      // Create Base64 for storing in DB if we don't have a storage bucket
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async function() {
        const base64data = reader.result;
        
        const { data } = await supabase.from('app_config').select('id').eq('key', 'system_logo').single();
        if (data) await supabase.from('app_config').update({ value: base64data }).eq('key', 'system_logo');
        else await supabase.from('app_config').insert([{ key: 'system_logo', value: base64data }]);
        
        setCurrentLogo(base64data);
        btn.innerHTML = '<i class="fas fa-check me-2"></i> تم التحديث بنجاح';
        btn.classList.replace('btn-primary', 'btn-success');
        setTimeout(() => {
          setIsCropModalOpen(false);
          btn.innerHTML = originalText;
          btn.classList.replace('btn-success', 'btn-primary');
          btn.disabled = false;
        }, 1000);
      }
    }, 'image/png');
  };

  // Visibility logic based on categories
  const showField = (cat, field) => {
    if (['باقة شهرية', 'باقة يومية'].includes(cat)) {
      if (field === 'hours' || field === 'due_hours' || field === 'validity') return true;
      return false;
    } else if (cat === 'تصوير بالساعة') {
      if (field === 'hours') return true;
      return false;
    } else if (cat === 'باقة ريلز') {
      if (field === 'reels') return true;
      return false;
    }
    return false;
  };

  const openEditModal = (s, event) => {
    serviceDialogTriggerRef.current = event.currentTarget;
    setEditForm({ ...s, reason: '' });
    const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById('editServiceModal'));
    modal.show();
  };

  const renderServiceActions = (service) => isOwner ? (
    <div className="d-flex gap-2 justify-content-start flex-row-reverse">
      <button className="btn action-btn btn-delete-action" onClick={event => openArchiveService(service, event)} title="أرشفة آمنة" aria-label={`أرشفة أو حذف خدمة ${service.name}`}><i className="fas fa-archive" aria-hidden="true"></i><span>أرشفة</span></button>
      <button className="btn action-btn btn-edit-action" onClick={event => openEditModal(service, event)} title="تعديل" aria-label={`تعديل خدمة ${service.name}`}><i className="fas fa-edit" aria-hidden="true"></i><span>تعديل</span></button>
    </div>
  ) : null;

  return (
    <>
      <div className="container-fluid p-0 animate__animated animate__fadeIn pb-5" style={{ background: '#f8f9fc', minHeight: '100vh', padding: '20px' }}>
      <style>{`
        .setting-section { background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); padding: 30px; margin-bottom: 30px; border: 1px solid #f1f5f9; }
        
        .nav-tabs { 
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          overflow-x: auto;
          border-bottom: 1px solid #e2e8f0; 
          gap: 15px; 
          justify-content: flex-start; 
          padding-bottom: 15px; 
          margin-top: 20px; 
          margin-bottom: 20px; 
        }
        .nav-tabs::-webkit-scrollbar { height: 4px; }
        .nav-tabs::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
        
        .nav-tabs .nav-item { margin-bottom: 0; white-space: nowrap; }
        .nav-tabs .nav-link {
          color: #64748b !important; 
          font-weight: 700; 
          border: 1px solid transparent; 
          border-radius: 10px; 
          padding: 8px 24px; 
          transition: all 0.3s ease; 
          background: transparent;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          min-height: 44px;
          gap: 8px;
        }
        .nav-tabs .nav-link.active { 
          color: #4318ff !important; 
          border: 1px solid rgba(67,24,255,0.4) !important; 
          background: #ffffff !important; 
          box-shadow: 0 4px 15px rgba(67,24,255,0.1) !important; 
        }
        .nav-tabs .nav-link:hover:not(.active) { 
          color: #4318ff !important; 
          background: #f8fafc;
        }
        
        .table-custom { margin-bottom: 0; }
        .table-custom thead th { border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 700; font-size: 0.9rem; padding-bottom: 15px; padding-top: 15px; }
        .table-custom tbody td { padding: 20px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .table-custom tbody tr:last-child td { border-bottom: none; }
        
        .action-btn { min-width: 44px; min-height: 44px; padding: 8px 10px; display: inline-flex; gap: 6px; align-items: center; justify-content: center; border-radius: 8px; transition: 0.2s; font-size: 0.8rem; font-weight: 800; }
        .action-btn span { display: inline; }
        .action-btn:hover { transform: translateY(-2px); }
        .btn-edit-action { background: #f0f7ff; color: #0d6efd; border: 1px solid #cce3ff; }
        .btn-edit-action:hover { background: #0d6efd; color: white; border-color: #0d6efd; }
        .btn-delete-action { background: #fff0f0; color: #dc3545; border: 1px solid #ffcaca; }
        .btn-delete-action:hover { background: #dc3545; color: white; border-color: #dc3545; }
        
        .cropper-container { width: 100%; max-height: 60vh; background-color: #e9ecef; border-radius: 12px; overflow: hidden; }
        .service-impact-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:#cbd5e1; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; }
        .service-impact-strip article { display:grid; gap:4px; background:#0f2747; color:white; padding:12px; }
        .service-impact-strip span { color:#bfdbfe; font-size:12px; } .service-impact-strip b { font-size:13px; }
        .service-archive-overlay { padding:18px; overflow:auto; }
        .service-archive-dialog { position:relative; width:min(720px,100%); max-height:calc(100dvh - 36px); overflow:auto; background:#fff; border-top:5px solid #b91c1c; border-radius:18px; padding:24px; box-shadow:0 24px 70px rgba(15,39,71,.28); direction:rtl; }
        .service-archive-close { position:absolute; left:18px; top:18px; width:44px; height:44px; border:1px solid #cbd5e1; background:white; border-radius:10px; font-size:24px; }
        .service-archive-kicker { color:#b91c1c; font-weight:900; font-size:12px; } .service-archive-dialog h2 { color:#0f2747; font-size:24px; font-weight:950; margin:8px 0; } .service-archive-dialog>p { color:#59677a; }
        .service-impact-strip { margin:16px 0; } .service-reference-breakdown { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:14px; } .service-reference-breakdown span { background:#f1f5f9; padding:6px 9px; font-size:12px; } .service-reference-breakdown b { color:#0f2747; }
        .service-archive-dialog>label { display:grid; gap:6px; margin-top:12px; color:#334155; font-size:13px; font-weight:850; } .service-archive-dialog textarea,.service-archive-dialog>label>input:not([type="checkbox"]) { min-height:44px; border:1px solid #cbd5e1; border-radius:9px; padding:10px; }
        .service-archive-confirm { grid-template-columns:22px 1fr!important; align-items:start; } .service-archive-confirm input { width:20px; height:20px; }
        .service-archive-dialog>button:last-child { width:100%; min-height:48px; margin-top:16px; border:0; border-radius:10px; background:#b91c1c; color:#fff; font-weight:900; } .service-archive-dialog>button:disabled { opacity:.5; }
        .service-archive-dialog :is(button,input,textarea):focus-visible { outline:3px solid #3478db; outline-offset:2px; }
        @media(max-width:600px){ .service-archive-overlay{padding:0}.service-archive-dialog{width:100%;min-height:100dvh;max-height:100dvh;border-radius:0;padding:18px 14px 28px}.service-impact-strip{grid-template-columns:1fr}.action-btn{min-width:44px;padding:8px} }
      `}</style>

      <ERPPageHero
        icon={Settings}
        eyebrow="إدارة النظام"
        title="الإعدادات والخدمات"
        description="أدر الخدمات والباقات وحسابات الفريق ونظام النقاط والنسخ الاحتياطي."
        actions={isOwner ? <button data-variant="primary" data-bs-toggle="modal" data-bs-target="#addServiceModal" onClick={event => { serviceDialogTriggerRef.current = event.currentTarget; }}><i className="fas fa-plus"></i> إضافة خدمة / باقة جديدة</button> : null}
      />

      <div className="setting-section" id="servicesSection">
        <div className="d-flex align-items-center justify-content-between border-bottom pb-4">
          <h5 className="fw-bold m-0" style={{ color: '#1e293b' }}>
            <i className="fas fa-layer-group text-warning ms-2"></i> قائمة الخدمات والباقات
          </h5>
        </div>
        <div className="alert alert-warning border-0 mt-3 mb-0 small" role="note">
          تعديلات قالب الخدمة تطبق على المبيعات الجديدة فقط؛ الباقات المباعة تحتفظ بلقطة السعر والكمية وشروطها الأصلية.
        </div>

        <ul className="nav nav-tabs border-0 flex-row flex-nowrap gap-3 mb-4" id="servicesTabs" role="tablist">
          <li className="nav-item" role="presentation"><button className="nav-link active" id="hourly-tab" data-bs-toggle="tab" data-bs-target="#hourly" type="button" role="tab">التصوير بالساعة</button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="daily-tab" data-bs-toggle="tab" data-bs-target="#daily" type="button" role="tab">الباقات اليومية <i className="fas fa-cog opacity-50"></i></button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="monthly-tab" data-bs-toggle="tab" data-bs-target="#monthly" type="button" role="tab">الباقات الشهرية <i className="fas fa-calendar-alt opacity-50"></i></button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="reels-tab" data-bs-toggle="tab" data-bs-target="#reels" type="button" role="tab">باقات الريلز <i className="fas fa-video opacity-50"></i></button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="others-tab" data-bs-toggle="tab" data-bs-target="#others" type="button" role="tab">خدمات إضافية <i className="fas fa-star opacity-50"></i></button></li>
        </ul>

        <div className="tab-content" id="servicesTabsContent">
          {/* Hourly */}
          <div className="tab-pane fade show active" id="hourly" role="tabpanel">
            <div className="table-responsive">
              <table className="table table-custom table-borderless align-middle w-100 text-center">
                <thead>
                  <tr>
                    <th className="text-end pe-4" style={{width: '30%'}}>اسم الخدمة</th>
                    <th style={{width: '20%'}}>الساعات</th>
                    <th style={{width: '30%'}}>السعر (ج.م)</th>
                    <th className="text-start ps-4" style={{width: '20%'}}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {services.filter(s => s.category === 'تصوير بالساعة').map(s => (
                    <tr key={s.id}>
                      <td className="text-end pe-4 fw-bold text-dark">{s.name}</td>
                      <td className="fw-bold" style={{color: '#0d6efd'}}>{s.total_hours} س</td>
                      <td className="fw-bold" style={{color: '#198754'}}>{formatServicePrice(s.price)}</td>
                      <td className="text-start ps-4">
                        {renderServiceActions(s)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily */}
          <div className="tab-pane fade" id="daily" role="tabpanel">
            <div className="table-responsive">
              <table className="table table-custom table-borderless align-middle w-100 text-center">
                <thead>
                  <tr>
                    <th className="text-end pe-4" style={{width: '30%'}}>اسم الباقة</th>
                    <th style={{width: '20%'}}>تفاصيل الباقة</th>
                    <th style={{width: '15%'}}>الصلاحية</th>
                    <th style={{width: '20%'}}>السعر (ج.م)</th>
                    <th className="text-start ps-4" style={{width: '15%'}}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {services.filter(s => s.category === 'باقة يومية').map(s => (
                    <tr key={s.id}>
                      <td className="text-end pe-4 fw-bold text-dark">{s.name}</td>
                      <td className="fw-bold" style={{color: '#0d6efd'}}>
                        {s.total_hours} س <br/>
                        {s.payment_due_hours > 0 && <small className="text-danger" style={{fontSize: '0.7rem'}}>استحقاق السداد بعد: {s.payment_due_hours} س</small>}
                      </td>
                      <td className="fw-bold text-muted">{s.validity_days} يوم</td>
                      <td className="fw-bold" style={{color: '#198754'}}>{formatServicePrice(s.price)}</td>
                      <td className="text-start ps-4">
                        {renderServiceActions(s)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly */}
          <div className="tab-pane fade" id="monthly" role="tabpanel">
            <div className="table-responsive">
              <table className="table table-custom table-borderless align-middle w-100 text-center">
                <thead>
                  <tr>
                    <th className="text-end pe-4" style={{width: '30%'}}>اسم الباقة</th>
                    <th style={{width: '20%'}}>تفاصيل الباقة</th>
                    <th style={{width: '15%'}}>الصلاحية</th>
                    <th style={{width: '20%'}}>السعر (ج.م)</th>
                    <th className="text-start ps-4" style={{width: '15%'}}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {services.filter(s => s.category === 'باقة شهرية').map(s => (
                    <tr key={s.id}>
                      <td className="text-end pe-4 fw-bold text-dark">{s.name}</td>
                      <td className="fw-bold" style={{color: '#0d6efd'}}>
                        {s.total_hours} س <br/>
                        {s.payment_due_hours > 0 && <small className="text-danger" style={{fontSize: '0.7rem'}}>استحقاق السداد بعد: {s.payment_due_hours} س</small>}
                      </td>
                      <td className="fw-bold text-muted">{s.validity_days} يوم</td>
                      <td className="fw-bold" style={{color: '#198754'}}>{formatServicePrice(s.price)}</td>
                      <td className="text-start ps-4">
                        {renderServiceActions(s)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reels */}
          <div className="tab-pane fade" id="reels" role="tabpanel">
            <div className="table-responsive">
              <table className="table table-custom table-borderless align-middle w-100 text-center">
                <thead>
                  <tr>
                    <th className="text-end pe-4" style={{width: '30%'}}>اسم الباقة</th>
                    <th style={{width: '20%'}}>عدد الفيديوهات</th>
                    <th style={{width: '15%'}}>الصلاحية</th>
                    <th style={{width: '20%'}}>السعر (ج.م)</th>
                    <th className="text-start ps-4" style={{width: '15%'}}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {services.filter(s => s.category === 'باقة ريلز').map(s => (
                    <tr key={s.id}>
                      <td className="text-end pe-4 fw-bold text-dark">{s.name}</td>
                      <td className="fw-bold" style={{color: '#0d6efd'}}>
                        {s.total_reels} فيديو <br/>
                      </td>
                      <td className="fw-bold text-muted">{s.validity_days ? `${s.validity_days} يوم` : '-'}</td>
                      <td className="fw-bold" style={{color: '#198754'}}>{formatServicePrice(s.price)}</td>
                      <td className="text-start ps-4">
                        {renderServiceActions(s)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Others */}
          <div className="tab-pane fade" id="others" role="tabpanel">
            <div className="table-responsive">
              <table className="table table-custom table-borderless align-middle w-100 text-center">
                <thead>
                  <tr>
                    <th className="text-end pe-4" style={{width: '30%'}}>اسم الخدمة</th>
                    <th style={{width: '20%'}}>التصنيف</th>
                    <th style={{width: '15%'}}>التفاصيل</th>
                    <th style={{width: '20%'}}>السعر (ج.م)</th>
                    <th className="text-start ps-4" style={{width: '15%'}}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {services.filter(s => s.category === 'خدمة إضافية').map(s => (
                    <tr key={s.id}>
                      <td className="text-end pe-4 fw-bold text-dark">{s.name}</td>
                      <td><span className="badge bg-secondary-subtle text-secondary border rounded-pill">{s.category}</span></td>
                      <td className="fw-bold text-muted">-</td>
                      <td className="fw-bold" style={{color: '#198754'}}>{formatServicePrice(s.price)}</td>
                      <td className="text-start ps-4">
                        {renderServiceActions(s)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isOwner ? <div className="setting-section">
        <div className="section-title">
          <div><span><i className="fas fa-users-cog text-primary me-2"></i> إدارة حسابات النظام</span><small className="d-block text-muted mt-1" style={{fontSize: '.72rem'}}>الحسابات والصلاحيات محفوظة بأمان على الخادم ولا تُعرض كلمات المرور.</small></div>
          <button className="btn btn-dark rounded-pill px-4 fw-bold shadow-sm" data-bs-toggle="modal" data-bs-target="#addUserModal" onClick={() => setUserState({ busy: false, type: '', message: '' })}>
            <i className="fas fa-user-plus me-1"></i> مستخدم جديد
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-center">
            <thead className="bg-light"><tr><th className="py-3 text-muted small fw-bold">الاسم بالكامل</th><th className="py-3 text-muted small fw-bold">بيانات الدخول</th><th className="py-3 text-muted small fw-bold">الدور والصلاحيات</th><th className="py-3 text-muted small fw-bold">الحالة</th><th className="py-3 text-muted small fw-bold">تحكم المالك</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="py-3 fw-bold text-dark">{u.full_name}</td>
                  <td className="py-3"><div className="font-monospace text-muted" dir="ltr">{u.email || u.phone || '—'}</div>{u.email && u.phone && <small className="text-muted" dir="ltr">{u.phone}</small>}</td>
                  <td className="py-3"><select className="form-select form-select-sm mx-auto fw-bold" style={{maxWidth:'175px'}} value={u.role} disabled={userState.busy || Number(u.id) === Number(currentUser.id)} onChange={e => updateSystemUser(u.id, { role: e.target.value })}>{Object.entries(ROLE_DETAILS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select><small className="text-muted d-block mt-1" style={{fontSize:'.64rem'}}>{ROLE_DETAILS[u.role]?.note}</small></td>
                  <td className="py-3"><span className={`badge rounded-pill px-3 ${Number(u.is_active) ? 'bg-success' : 'bg-secondary'}`}>{Number(u.is_active) ? 'نشط' : 'موقوف'}</span>{Number(u.id) === Number(currentUser.id) && <small className="d-block text-muted mt-1">حسابك الحالي</small>}</td>
                  <td className="py-3"><OwnerRecordActions user={currentUser} entity="users" record={u} label={u.full_name} onEdit={() => openUserEditor(u)} onChanged={fetchData} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {userState.message && <div className={`alert mt-3 mb-0 ${userState.type === 'error' ? 'alert-danger' : 'alert-success'}`} role="status">{userState.message}</div>}
      </div> : <div className="setting-section border-start border-warning border-4"><h5 className="fw-bold mb-2">إدارة الحسابات للمالك فقط</h5><p className="text-muted mb-0 small">يمكنك استخدام إعدادات التشغيل، لكن إضافة الموظفين وتغيير صلاحياتهم متاحة لحساب المالك فقط.</p></div>}

      {isOwner && <div className="setting-section">
        <div className="section-title"><div><span><i className="fas fa-building text-primary me-2"></i> الاستديوهات وموارد الحجز</span><small className="d-block text-muted mt-1">تعطيل المورد يمنع الحجوزات الجديدة ويحافظ على مواعيده السابقة.</small></div></div>
        <form className="row g-2 align-items-end mb-4" onSubmit={saveResource}><div className="col-md-6"><label className="small fw-bold text-muted mb-1">اسم الاستديو / المورد</label><input className="form-control" required value={resourceForm.name} onChange={event=>setResourceForm({...resourceForm,name:event.target.value})}/></div><div className="col-md-3"><label className="small fw-bold text-muted mb-1">النوع</label><select className="form-select" value={resourceForm.type} onChange={event=>setResourceForm({...resourceForm,type:event.target.value})}><option value="studio">استديو</option><option value="location">موقع خارجي</option><option value="equipment">معدات</option></select></div><div className="col-md-3"><button className="btn btn-primary w-100 min-h-44">{resourceForm.id?'حفظ التعديل':'إضافة مورد'}</button></div></form>
        <div className="table-responsive"><table className="table align-middle"><thead><tr><th>الاسم</th><th>النوع</th><th>الحالة</th><th>تحكم المالك</th></tr></thead><tbody>{resources.map(resource=><tr key={resource.id}><td className="fw-bold">{resource.name}</td><td>{resource.type}</td><td><span className={`badge ${Number(resource.is_active)?'bg-success':'bg-secondary'}`}>{Number(resource.is_active)?'نشط':'معطل'}</span></td><td><OwnerRecordActions user={currentUser} entity="resources" record={resource} label={resource.name} onEdit={()=>setResourceForm({id:resource.id,name:resource.name,type:resource.type})} onChanged={fetchData}/></td></tr>)}</tbody></table></div>
      </div>}

      <div className="setting-section border-start border-warning border-4">
        <h5 className="fw-bold text-warning mb-4"><i className="fas fa-star me-2"></i> إعدادات نظام النقاط والولاء</h5>
        <form onSubmit={handleSavePointsSettings}>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="small fw-bold text-muted mb-1">كل (ج.م) يدفعها العميل</label>
              <input type="number" name="points_egp_spent" className="form-control bg-light border-0 py-2 fw-bold text-center shadow-sm" value={p_cfg.points_egp_spent} onChange={e => setP_cfg({...p_cfg, points_egp_spent: e.target.value})} required />
            </div>
            <div className="col-md-3">
              <label className="small fw-bold text-muted mb-1">تساوي (نقاط) مكتسبة</label>
              <input type="number" name="points_earned" className="form-control bg-success-subtle text-success border-0 py-2 fw-bold text-center shadow-sm" value={p_cfg.points_earned} onChange={e => setP_cfg({...p_cfg, points_earned: e.target.value})} required />
            </div>
            <div className="col-md-2">
              <label className="small fw-bold text-muted mb-1">الحد الأدنى للاستبدال</label>
              <div className="input-group shadow-sm rounded-3 overflow-hidden">
                <input type="number" name="points_redeem_threshold" className="form-control bg-light border-0 py-2 fw-bold text-center" value={p_cfg.points_redeem_threshold} onChange={e => setP_cfg({...p_cfg, points_redeem_threshold: e.target.value})} required />
                <span className="input-group-text border-0 bg-light small">نقطة</span>
              </div>
            </div>
            <div className="col-md-2">
              <label className="small fw-bold text-muted mb-1">عند الاستبدال، كل</label>
              <div className="input-group shadow-sm rounded-3 overflow-hidden">
                <input type="number" name="points_redeem_points" className="form-control bg-light border-0 py-2 fw-bold text-center" value={p_cfg.points_redeem_points} onChange={e => setP_cfg({...p_cfg, points_redeem_points: e.target.value})} required />
                <span className="input-group-text border-0 bg-light small">نقطة</span>
              </div>
            </div>
            <div className="col-md-2">
              <label className="small fw-bold text-muted mb-1">تعطي خصم</label>
              <div className="input-group shadow-sm rounded-3 overflow-hidden">
                <input type="number" name="points_discount_egp" className="form-control bg-danger-subtle text-danger border-0 py-2 fw-bold text-center" value={p_cfg.points_discount_egp} onChange={e => setP_cfg({...p_cfg, points_discount_egp: e.target.value})} required />
                <span className="input-group-text border-0 bg-danger-subtle text-danger small">ج.م</span>
              </div>
            </div>
            <div className="col-12 mt-3">
              <label className="small fw-bold text-muted mb-1">صلاحية النقاط (بالأشهر)</label>
              <input type="number" name="points_validity_months" className="form-control bg-light border-0 py-2 fw-bold text-center d-inline-block shadow-sm" style={{width: '100px'}} value={p_cfg.points_validity_months} onChange={e => setP_cfg({...p_cfg, points_validity_months: e.target.value})} required />
              <small className="text-primary d-inline-block ms-2 fw-bold"><i className="fas fa-info-circle"></i> اكتب (0) لجعل النقاط لا تنتهي صلاحيتها أبداً.</small>
            </div>
          </div>
          <div className="mt-4 text-end">
            <button type="submit" className="btn btn-warning fw-bold px-4 py-2 rounded-pill shadow-sm text-dark"><i className="fas fa-save me-1"></i> اعتماد وحفظ إعدادات النقاط</button>
          </div>
        </form>
      </div>

      <div className="row g-4 mt-1">
        <div className="col-md-6">
          <div className="setting-section h-100 mb-0 text-center">
            <h5 className="fw-bold text-dark mb-4 text-start"><i className="fas fa-image text-primary me-2"></i> شعار النظام (Logo)</h5>
            
            <div className="bg-light rounded-4 d-flex justify-content-center align-items-center mb-4 border border-dashed border-2" style={{height: '140px', overflow: 'hidden', position: 'relative'}}>
              <img src={currentLogo} onError={(e) => e.target.src='https://via.placeholder.com/150?text=No+Logo'} style={{maxHeight: '110px', maxWidth: '100%'}} alt="logo" />
            </div>
            
            <input type="file" ref={logoInputRef} className="d-none" accept="image/*" onChange={handleLogoChange} />
            <button type="button" className="btn btn-dark w-100 rounded-pill py-3 fw-bold shadow-sm" onClick={() => logoInputRef.current.click()}>
              <i className="fas fa-crop-alt me-2 text-warning"></i> اختيار وقص الشعار الجديد
            </button>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="setting-section h-100 mb-0">
            <h5 className="fw-bold text-dark mb-4"><i className="fas fa-database text-success me-2"></i> قاعدة البيانات والنسخ الاحتياطي</h5>
            
            <form onSubmit={handleSaveBackupFreq} className="mb-4">
              <label className="small fw-bold text-muted mb-2">وتيرة النسخ التلقائي:</label>
              <div className="input-group shadow-sm rounded-pill overflow-hidden">
                <select name="backup_freq" className="form-select bg-light border-0 py-2 fw-bold" value={backupFreq} onChange={e => setBackupFreq(e.target.value)}>
                  <option value="مغلق">مغلق</option>
                  <option value="يوميا">يومياً</option>
                  <option value="اسبوعيا">أسبوعياً</option>
                </select>
                <button type="submit" className="btn btn-success fw-bold px-4"><i className="fas fa-save"></i> حفظ</button>
              </div>
            </form>
            <hr className="opacity-10 my-4" />
            <div className="d-flex gap-2">
              <button className="btn btn-primary rounded-pill flex-grow-1 py-2 fw-bold" onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({services, p_cfg, users}));
                const a = document.createElement('a'); a.href = dataStr; a.download = "erp_backup.json"; a.click();
              }}><i className="fas fa-download me-1"></i> تحميل نسخة (JSON)</button>
            </div>
            <div className="mt-3 p-3 bg-primary-subtle rounded-4 border border-primary border-opacity-25">
              <label className="small fw-bold text-primary mb-2"><i className="fas fa-cloud"></i> النسخ الاحتياطي التلقائي (Cloud)</label>
              <p className="small mb-0 text-dark">
                قاعدة بيانات النظام الآن سحابية وموزعة عبر عدة خوادم (Supabase)، مما يعني أن بياناتك في أمان تام ولا يمكن فقدانها حتى لو تعطل جهازك. لم تعد بحاجة لرفع أو استعادة ملفات .db يدوياً.
              </p>
            </div>
          </div>
        </div>

        <div className="col-12 mt-4">
          <div className="setting-section mb-0">
            <h5 className="fw-bold text-dark mb-4"><i className="fas fa-file-csv text-info me-2"></i> استيراد جهات الاتصال (Google CSV)</h5>
            
            <form onSubmit={e => { e.preventDefault(); alert('يتم مراجعة ومعالجة الملف... سيتم إبلاغك عند الانتهاء.'); }}>
              <div className="alert bg-info-subtle border-0 rounded-4 mb-3">
                <small className="fw-bold text-info-emphasis"><i className="fas fa-info-circle me-1"></i> قم بتصدير جهات الاتصال من هاتف الأندرويد أو حساب جوجل بصيغة (Google CSV)، ثم ارفع الملف هنا لإضافة جميع العملاء بضغطة زر واحدة.</small>
              </div>
              <div className="input-group shadow-sm rounded-pill overflow-hidden mb-4">
                <input type="file" className="form-control bg-light border-0 py-2" accept=".csv" required />
                <button type="submit" className="btn btn-info fw-bold px-4 text-white"><i className="fas fa-file-import me-1"></i> استيراد العملاء</button>
              </div>
            </form>
            
            <hr className="opacity-10 my-4" />
            
            <button className="btn btn-outline-danger rounded-pill w-100 py-3 fw-bold mt-2" onClick={() => window.confirm('تحذير خطير جداً 🚨\nهل أنت متأكد من رغبتك في مسح (جميع العملاء - الحجوزات - الماليات) بالكامل للبدء من جديد؟\nهذا الإجراء لا يمكن التراجع عنه!')}>
              <i className="fas fa-bomb me-1"></i> تصفير النظام للتجربة (مسح العملاء والحجوزات والماليات)
            </button>
          </div>
        </div>
      </div>

      </div>

      {/* CROP MODAL (Controlled by React State for Cropper logic) */}
      {isCropModalOpen && (
        <div className="erp-modal-overlay" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} onClick={() => setIsCropModalOpen(false)}>
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg rounded-5 bg-white">
              <div className="modal-header bg-dark text-white border-0 p-4">
                <h5 className="fw-bold m-0"><i className="fas fa-crop-alt me-2 text-warning"></i> قص وتحديد الشعار</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsCropModalOpen(false)}></button>
              </div>
              <div className="modal-body p-4 bg-light">
                <div className="alert alert-info border-0 rounded-4 mb-3 small fw-bold text-center">
                  <i className="fas fa-arrows-alt"></i> اسحب الأطراف لتحديد الجزء المهم من اللوجو وإزالة المسافات البيضاء.
                </div>
                <div className="cropper-container">
                  <img id="imageToCrop" ref={imageToCropRef} src={imageSrc} style={{ display: 'block', maxWidth: '100%' }} alt="To crop" />
                </div>
              </div>
              <div className="modal-footer border-0 p-4 bg-white d-flex gap-2">
                <button type="button" className="btn btn-light border rounded-pill px-4 fw-bold flex-grow-1" onClick={() => setIsCropModalOpen(false)}>إلغاء</button>
                <button type="button" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm flex-grow-1" id="btnCropAndUpload" onClick={handleCropAndUpload}><i className="fas fa-check-circle me-1"></i> قص وحفظ الشعار</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD SERVICE MODAL (Bootstrap native) */}
      <div className="modal fade" id="addServiceModal" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="add-service-title">
        <div className="modal-dialog modal-dialog-centered">
          <form onSubmit={handleAddService} className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-primary text-white border-0 p-4">
              <h5 id="add-service-title" className="fw-bold m-0"><i className="fas fa-plus-circle me-2 text-warning"></i> تسجيل خدمة أو باقة جديدة</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="إغلاق نافذة إضافة الخدمة"></button>
            </div>
            <div className="modal-body p-4 bg-light">
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">اسم الباقة / الخدمة</label>
                <input data-service-initial type="text" className="form-control border-0 py-2 fw-bold shadow-sm" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} required />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="small fw-bold text-muted mb-1">التصنيف</label>
                  <select className="form-select border-0 py-2 fw-bold shadow-sm text-primary" value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value, billing_unit: e.target.value === 'باقة ريلز' ? 'reel' : addForm.billing_unit})} required>
                    <option value="تصوير بالساعة">تصوير بالساعة</option>
                    <option value="باقة يومية">باقات يومية</option>
                    <option value="باقة شهرية">باقات شهرية</option>
                    <option value="باقة ريلز">باقات ريلز</option>
                    <option value="خدمة إضافية">خدمات إضافية (جرافيك وغيرها)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="small fw-bold text-muted mb-1">السعر (ج.م)</label>
                  <input type="number" className="form-control border-0 py-2 fw-bold text-success shadow-sm" value={addForm.price} onChange={e => setAddForm({...addForm, price: e.target.value})} required />
                </div>
                <div className="col-md-4"><label className="small fw-bold text-muted mb-1">وحدة الاحتساب</label><select className="form-select border-0 py-2 fw-bold shadow-sm" value={addForm.billing_unit} onChange={e => setAddForm({...addForm,billing_unit:e.target.value})}><option value="hour">ساعة</option><option value="reel">ريل</option><option value="day">يوم</option><option value="month">شهر</option><option value="project">مشروع</option></select></div>
              </div>
              
              <div className="row g-3 mb-4">
                {showField(addForm.category, 'hours') && (
                  <div className="col-6 hours-div">
                    <label className="small fw-bold text-muted mb-1">إجمالي الساعات</label>
                    <input type="number" step="0.5" className="form-control border-0 py-2 fw-bold shadow-sm" value={addForm.total_hours} onChange={e => setAddForm({...addForm, total_hours: e.target.value})} />
                  </div>
                )}
                {showField(addForm.category, 'due_hours') && (
                  <div className="col-6 due-hours-div">
                    <label className="small fw-bold text-muted mb-1">استحقاق الدفع بعد</label>
                    <div className="input-group shadow-sm rounded-3 overflow-hidden">
                      <input type="number" step="0.5" className="form-control border-0 py-2 fw-bold text-danger text-center" value={addForm.payment_due_hours} onChange={e => setAddForm({...addForm, payment_due_hours: e.target.value})} />
                      <span className="input-group-text border-0 bg-white small text-muted">ساعة</span>
                    </div>
                  </div>
                )}
                {showField(addForm.category, 'validity') && (
                  <div className="col-6 validity-div">
                    <label className="small fw-bold text-muted mb-1">الصلاحية (بالأيام)</label>
                    <input type="number" className="form-control border-0 py-2 fw-bold shadow-sm" value={addForm.validity_days} onChange={e => setAddForm({...addForm, validity_days: e.target.value})} />
                  </div>
                )}
                {showField(addForm.category, 'reels') && (
                  <div className="col-6 reels-div">
                    <label className="small fw-bold text-muted mb-1">عدد الفيديوهات (الريلز)</label>
                    <input type="number" className="form-control border-0 py-2 fw-bold shadow-sm" value={addForm.total_reels} onChange={e => setAddForm({...addForm, total_reels: e.target.value})} />
                  </div>
                )}
                <div className="col-6"><label className="small fw-bold text-muted mb-1">الدفعة المقدمة %</label><input type="number" min="0" max="100" step="1" className="form-control border-0 py-2 fw-bold shadow-sm" value={addForm.deposit_percent} onChange={e => setAddForm({...addForm,deposit_percent:e.target.value})}/></div>
                <div className="col-6"><label className="small fw-bold text-muted mb-1">سعر الوحدة الزائدة</label><input type="number" min="0" step="0.01" className="form-control border-0 py-2 fw-bold shadow-sm" value={addForm.overage_price} onChange={e => setAddForm({...addForm,overage_price:e.target.value})}/></div>
                <div className="col-6"><label className="small fw-bold text-muted mb-1">أقل حجز بالدقائق</label><input type="number" min="15" step="15" className="form-control border-0 py-2 fw-bold shadow-sm" value={addForm.minimum_booking_minutes} onChange={e => setAddForm({...addForm,minimum_booking_minutes:e.target.value})}/></div>
                <div className="col-6"><label className="small fw-bold text-muted mb-1">زيادة الحجز كل</label><select className="form-select border-0 py-2 fw-bold shadow-sm" value={addForm.booking_increment_minutes} onChange={e => setAddForm({...addForm,booking_increment_minutes:e.target.value})}><option value="15">15 دقيقة</option><option value="30">30 دقيقة</option><option value="60">60 دقيقة</option></select></div>
                <div className="col-12 form-check form-switch px-5"><input className="form-check-input" type="checkbox" checked={Boolean(Number(addForm.auto_start_timer))} onChange={e => setAddForm({...addForm,auto_start_timer:e.target.checked?1:0})}/><label className="form-check-label fw-bold">تشغيل تايمر التصوير تلقائيًا في الموعد</label></div>
                <div className="col-12"><label className="small fw-bold text-muted mb-1">سبب الإنشاء</label><textarea minLength="5" required className="form-control border-0 shadow-sm" rows="2" value={addForm.reason} onChange={e => setAddForm({...addForm,reason:e.target.value})} placeholder="اكتب سببًا واضحًا يظهر في سجل التدقيق" /></div>
              </div>
              <button type="submit" className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow submit-btn" data-bs-dismiss="modal">حفظ وإضافة للنظام</button>
            </div>
          </form>
        </div>
      </div>

      {/* EDIT SERVICE MODAL (Bootstrap native) */}
      <div className="modal fade" id="editServiceModal" tabIndex="-1" data-bs-backdrop="static" role="dialog" aria-modal="true" aria-labelledby="edit-service-title" aria-describedby="edit-service-description">
        <div className="modal-dialog modal-dialog-centered">
          <form onSubmit={handleEditService} className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-dark text-white border-0 p-4">
              <h5 id="edit-service-title" className="fw-bold m-0"><i className="fas fa-edit me-2 text-warning"></i> تعديل تفاصيل الخدمة/الباقة</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="إغلاق نافذة تعديل الخدمة"></button>
            </div>
            <div className="modal-body p-4 bg-light">
              <p id="edit-service-description" className="alert alert-warning border-0 small">هذا تعديل على قالب البيع الجديد فقط؛ الباقات المباعة تحتفظ بالسعر والكمية والشروط الأصلية.</p>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">اسم الباقة / الخدمة</label>
                <input data-service-initial type="text" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="small fw-bold text-muted mb-1">التصنيف</label>
                  <select className="form-select border-0 py-2 fw-bold shadow-sm text-primary" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} required>
                    <option value="تصوير بالساعة">تصوير بالساعة</option>
                    <option value="باقة يومية">باقات يومية</option>
                    <option value="باقة شهرية">باقات شهرية</option>
                    <option value="باقة ريلز">باقات ريلز</option>
                    <option value="خدمة إضافية">خدمات إضافية (جرافيك وغيرها)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="small fw-bold text-muted mb-1">السعر (ج.م)</label>
                  <input type="number" className="form-control border-0 py-2 fw-bold text-success shadow-sm" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} required />
                </div>
                <div className="col-md-4"><label className="small fw-bold text-muted mb-1">وحدة الاحتساب</label><select className="form-select border-0 py-2 fw-bold shadow-sm" value={editForm.billing_unit || 'hour'} onChange={e => setEditForm({...editForm,billing_unit:e.target.value})}><option value="hour">ساعة</option><option value="reel">ريل</option><option value="day">يوم</option><option value="month">شهر</option><option value="project">مشروع</option></select></div>
              </div>
              
              <div className="row g-3 mb-4">
                {showField(editForm.category, 'hours') && (
                  <div className="col-6 hours-div">
                    <label className="small fw-bold text-muted mb-1">إجمالي الساعات</label>
                    <input type="number" step="0.5" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.total_hours} onChange={e => setEditForm({...editForm, total_hours: e.target.value})} />
                  </div>
                )}
                {showField(editForm.category, 'due_hours') && (
                  <div className="col-6 due-hours-div">
                    <label className="small fw-bold text-muted mb-1">استحقاق الدفع بعد</label>
                    <div className="input-group shadow-sm rounded-3 overflow-hidden">
                      <input type="number" step="0.5" className="form-control border-0 py-2 fw-bold text-danger text-center" value={editForm.payment_due_hours} onChange={e => setEditForm({...editForm, payment_due_hours: e.target.value})} />
                      <span className="input-group-text border-0 bg-white small text-muted">ساعة</span>
                    </div>
                  </div>
                )}
                {showField(editForm.category, 'validity') && (
                  <div className="col-6 validity-div">
                    <label className="small fw-bold text-muted mb-1">الصلاحية (بالأيام)</label>
                    <input type="number" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.validity_days} onChange={e => setEditForm({...editForm, validity_days: e.target.value})} />
                  </div>
                )}
                {showField(editForm.category, 'reels') && (
                  <div className="col-6 reels-div">
                    <label className="small fw-bold text-muted mb-1">عدد الفيديوهات (الريلز)</label>
                    <input type="number" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.total_reels} onChange={e => setEditForm({...editForm, total_reels: e.target.value})} />
                  </div>
                )}
                {!showField(editForm.category, 'validity') && <div className="col-6"><label className="small fw-bold text-muted mb-1">صلاحية القالب بالأيام</label><input type="number" min="1" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.validity_days || 90} onChange={e => setEditForm({...editForm,validity_days:e.target.value})}/></div>}
                <div className="col-6"><label className="small fw-bold text-muted mb-1">الدفعة المقدمة %</label><input type="number" min="0" max="100" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.deposit_percent || 0} onChange={e => setEditForm({...editForm,deposit_percent:e.target.value})}/></div>
                <div className="col-6"><label className="small fw-bold text-muted mb-1">سعر الوحدة الزائدة</label><input type="number" min="0" step="0.01" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.overage_price || 0} onChange={e => setEditForm({...editForm,overage_price:e.target.value})}/></div>
                <div className="col-6"><label className="small fw-bold text-muted mb-1">أقل حجز بالدقائق</label><input type="number" min="15" step="15" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.minimum_booking_minutes || 60} onChange={e => setEditForm({...editForm,minimum_booking_minutes:e.target.value})}/></div>
                <div className="col-6"><label className="small fw-bold text-muted mb-1">زيادة الحجز كل</label><select className="form-select border-0 py-2 fw-bold shadow-sm" value={editForm.booking_increment_minutes || 15} onChange={e => setEditForm({...editForm,booking_increment_minutes:e.target.value})}><option value="15">15 دقيقة</option><option value="30">30 دقيقة</option><option value="60">60 دقيقة</option></select></div>
                <div className="col-12 form-check form-switch px-5"><input className="form-check-input" type="checkbox" checked={Boolean(Number(editForm.auto_start_timer ?? 1))} onChange={e => setEditForm({...editForm,auto_start_timer:e.target.checked?1:0})}/><label className="form-check-label fw-bold">تشغيل تايمر التصوير تلقائيًا في الموعد</label></div>
                <div className="col-12"><label className="small fw-bold text-muted mb-1">حالة القالب</label><select className="form-select border-0 py-2 fw-bold shadow-sm" value={Number(editForm.is_active ?? 1)} onChange={e => setEditForm({...editForm,is_active:Number(e.target.value)})}><option value="1">نشط للمبيعات الجديدة</option><option value="0">موقوف عن المبيعات الجديدة</option></select></div>
                <div className="col-12 service-impact-strip" aria-label="معاينة أثر تعديل قالب الخدمة"><article><span>سعر القالب</span><b>{Number(services.find(item=>Number(item.id)===Number(editForm.id))?.price||0).toLocaleString('ar-EG')} ← {Number(editForm.price||0).toLocaleString('ar-EG')} ج.م</b></article><article><span>الصلاحية</span><b>{services.find(item=>Number(item.id)===Number(editForm.id))?.validity_days||90} ← {editForm.validity_days||90} يوم</b></article><article><span>الباقات المباعة</span><b>لا تتغير</b></article></div>
                <div className="col-12"><label className="small fw-bold text-muted mb-1">سبب التعديل</label><textarea minLength="5" required className="form-control border-0 shadow-sm" rows="2" value={editForm.reason || ''} onChange={e => setEditForm({...editForm,reason:e.target.value})} placeholder="مثال: تحديث سعر القالب للمبيعات الجديدة" /></div>
              </div>
              <button type="submit" className="btn btn-dark w-100 py-3 rounded-pill fw-bold shadow submit-btn" data-bs-dismiss="modal">حفظ التعديلات في الخلفية</button>
            </div>
          </form>
        </div>
      </div>

      {archiveForm.open && <ServiceArchiveDialog state={archiveForm} setState={setArchiveForm} triggerRef={serviceDialogTriggerRef} onClose={closeArchiveService} onSubmit={submitArchiveService}/>}

      {/* ADD USER MODAL (Bootstrap native) */}
      {isOwner && <div className="modal fade" id="addUserModal" tabIndex="-1" data-bs-backdrop="static">
        <div className="modal-dialog modal-dialog-centered">
          <form onSubmit={handleAddUser} className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-dark text-white border-0 p-4">
              <h5 className="fw-bold m-0"><i className="fas fa-user-plus me-2 text-warning"></i> إضافة مستخدم جديد</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-4 bg-light">
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">الاسم بالكامل</label>
                <input type="text" className="form-control border-0 py-2 fw-bold shadow-sm" value={addUserForm.full_name} onChange={e => setAddUserForm({...addUserForm, full_name: e.target.value})} required />
              </div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">البريد الإلكتروني</label>
                <input type="email" className="form-control border-0 py-2 font-monospace shadow-sm" style={{direction: 'ltr'}} value={addUserForm.email} onChange={e => setAddUserForm({...addUserForm, email: e.target.value})} placeholder="name@company.com" />
              </div>
              <div className="mb-3"><label className="small fw-bold text-muted mb-1">رقم الهاتف</label><input type="tel" className="form-control border-0 py-2 font-monospace shadow-sm" style={{direction:'ltr'}} value={addUserForm.phone} onChange={e => setAddUserForm({...addUserForm, phone:e.target.value})} placeholder="01xxxxxxxxx"/><small className="text-muted">أدخل البريد أو الهاتف على الأقل؛ أيهما يمكن استخدامه للدخول.</small></div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">كلمة المرور</label>
                <input type="password" minLength="10" autoComplete="new-password" className="form-control border-0 py-2 shadow-sm" value={addUserForm.password} onChange={e => setAddUserForm({...addUserForm, password: e.target.value})} required placeholder="10 أحرف على الأقل" />
              </div>
              <div className="mb-4">
                <label className="small fw-bold text-muted mb-1">الصلاحية</label>
                <select className="form-select border-0 py-2 fw-bold shadow-sm" value={addUserForm.role} onChange={e => setAddUserForm({...addUserForm, role: e.target.value})}>
                  {Object.entries(ROLE_DETAILS).map(([value, meta]) => <option key={value} value={value}>{meta.label} — {meta.note}</option>)}
                </select>
              </div>
              {userState.message && <div className={`alert py-2 ${userState.type === 'error' ? 'alert-danger' : 'alert-success'}`} role="status">{userState.message}</div>}
              <button type="submit" disabled={userState.busy} className="btn btn-dark w-100 py-3 rounded-pill fw-bold shadow submit-btn">{userState.busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}</button>
            </div>
          </form>
        </div>
      </div>}

      {isOwner && <div className="modal fade" id="editSystemUserModal" tabIndex="-1" data-bs-backdrop="static"><div className="modal-dialog modal-dialog-centered"><form onSubmit={saveSystemUser} className="modal-content border-0 shadow-lg rounded-5"><div className="modal-header bg-dark text-white border-0 p-4"><h5 className="fw-bold m-0">تعديل حساب المستخدم</h5><button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div className="modal-body p-4 bg-light">{editingUser&&<><label className="small fw-bold mb-1">الاسم بالكامل</label><input className="form-control mb-3" required value={editingUser.full_name||''} onChange={e=>setEditingUser({...editingUser,full_name:e.target.value})}/><label className="small fw-bold mb-1">البريد الإلكتروني</label><input type="email" dir="ltr" className="form-control mb-3" value={editingUser.email||''} onChange={e=>setEditingUser({...editingUser,email:e.target.value})}/><label className="small fw-bold mb-1">رقم الهاتف</label><input dir="ltr" className="form-control mb-3" value={editingUser.phone||''} onChange={e=>setEditingUser({...editingUser,phone:e.target.value})}/><label className="small fw-bold mb-1">الدور</label><select className="form-select mb-3" value={editingUser.role} onChange={e=>setEditingUser({...editingUser,role:e.target.value})}>{Object.entries(ROLE_DETAILS).map(([value,meta])=><option key={value} value={value}>{meta.label}</option>)}</select><label className="small fw-bold mb-1">الحالة</label><select className="form-select mb-3" value={Number(editingUser.is_active)} onChange={e=>setEditingUser({...editingUser,is_active:Number(e.target.value)})}><option value="1">نشط</option><option value="0">موقوف</option></select><label className="small fw-bold mb-1">كلمة مرور جديدة (اختياري)</label><input type="password" minLength="10" autoComplete="new-password" className="form-control mb-4" value={editingUser.password||''} onChange={e=>setEditingUser({...editingUser,password:e.target.value})}/><button className="btn btn-primary w-100 py-3" disabled={userState.busy}>{userState.busy?'جارٍ الحفظ...':'حفظ كل التعديلات'}</button></>}</div></form></div></div>}
    </>
  );
};

function ServiceArchiveDialog({ state, setState, triggerRef, onClose, onSubmit }) {
  const dialogRef = useRef(null);
  const hardDelete = Boolean(Number(state.service?.is_draft)) && state.references === 0;
  useEffect(() => {
    const dialog = dialogRef.current; const trigger = triggerRef.current; const selector = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled])';
    const focusables = () => [...(dialog?.querySelectorAll(selector) || [])]; const previousOverflow = document.body.style.overflow;
    const background = [...document.querySelectorAll('.erp-sidebar,.erp-mobile-header,.erp-bottom-nav,#servicesSection,.erp-page-hero')];
    const previous = background.map(element => ({ element, inert: element.inert, hidden: element.getAttribute('aria-hidden') }));
    background.forEach(element => { element.inert = true; element.setAttribute('aria-hidden','true'); }); document.body.style.overflow='hidden';
    window.requestAnimationFrame(() => dialog?.querySelector('[data-service-archive-initial]')?.focus());
    const keydown = event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); return; } if (event.key !== 'Tab') return; const items=focusables(); if(!items.length)return; const first=items[0],last=items[items.length-1]; if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();} };
    document.addEventListener('keydown',keydown); return () => { document.removeEventListener('keydown',keydown); document.body.style.overflow=previousOverflow; previous.forEach(({element,inert,hidden})=>{element.inert=inert;if(hidden===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',hidden);}); window.requestAnimationFrame(()=>trigger?.focus()); };
  }, [onClose, triggerRef]);
  return <div className="erp-modal-overlay service-archive-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><form ref={dialogRef} className="service-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="service-archive-title" aria-describedby="service-archive-description" onSubmit={onSubmit}><button data-service-archive-initial type="button" className="service-archive-close" aria-label="إغلاق مراجعة أرشفة الخدمة" onClick={onClose}>×</button><span className="service-archive-kicker">إجراء مالك موثق</span><h2 id="service-archive-title">{state.loading?'فحص ارتباطات الخدمة…':hardDelete?'حذف مسودة الخدمة نهائيًا':'أرشفة الخدمة'}</h2><p id="service-archive-description">{state.service?.name} · {hardDelete?'لم يعثر الفحص على مبيعات أو حجوزات أو عروض أو فواتير مرتبطة.':'الخدمة مستخدمة أو ليست مسودة؛ سيبقى تاريخها كاملًا.'}</p><section className="service-impact-strip"><article><span>قالب الخدمة</span><b>{hardDelete?'حذف نهائي':'إيقاف وأرشفة'}</b></article><article><span>المراجع المرتبطة</span><b>{state.loading?'جارٍ الفحص':state.references}</b></article><article><span>الباقات المباعة</span><b>لقطاتها لا تتغير</b></article></section>{!state.loading&&Object.keys(state.breakdown).length>0&&<div className="service-reference-breakdown">{Object.entries(state.breakdown).map(([label,count])=><span key={label}>{label} <b>{count}</b></span>)}</div>}{state.error&&<div className="alert alert-danger" role="alert">{state.error}</div>}<label>سبب {hardDelete?'الحذف':'الأرشفة'}<textarea required minLength="5" rows="3" value={state.reason} onChange={event=>setState({...state,reason:event.target.value})}/></label><label className="service-archive-confirm"><input type="checkbox" checked={state.confirmed} onChange={event=>setState({...state,confirmed:event.target.checked})}/> {hardDelete?'أفهم أن الحذف نهائي ولا يمكن التراجع عنه':'أفهم أن الخدمة ستتوقف للمبيعات الجديدة فقط'}</label>{hardDelete&&<label>اكتب DELETE للتأكيد<input value={state.deleteConfirmation} onChange={event=>setState({...state,deleteConfirmation:event.target.value})} autoComplete="off"/></label>}<button disabled={state.loading||state.reason.trim().length<5||!state.confirmed||(hardDelete&&state.deleteConfirmation!=='DELETE')}>{state.loading?'جارٍ فحص الأثر…':hardDelete?'حذف المسودة نهائيًا':'أرشفة الخدمة مع حفظ التاريخ'}</button></form></div>;
}

export default ERPSettings;
