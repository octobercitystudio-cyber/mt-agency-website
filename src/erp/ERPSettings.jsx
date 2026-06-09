import React, { useState, useEffect, useRef } from 'react';
import Cropper from 'cropperjs';
import { supabase } from '../supabaseClient';

const ERPSettings = () => {
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [p_cfg, setP_cfg] = useState({
    points_egp_spent: 100,
    points_earned: 1,
    points_redeem_threshold: 50,
    points_redeem_points: 10,
    points_discount_egp: 20,
    points_validity_months: 6
  });
  const [backupFreq, setBackupFreq] = useState('يوميا');

  // Form states
  const [addForm, setAddForm] = useState({ name: '', category: 'باقة ساعات', price: '', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0 });
  const [editForm, setEditForm] = useState({ id: '', name: '', category: 'باقة ساعات', price: '', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0 });
  const [addUserForm, setAddUserForm] = useState({ full_name: '', username: '', password: '', role: 'موظف' });

  useEffect(() => {
    fetchData();
  }, []);

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
    
    // We fetch users from app_config since we don't have an admin_users table for now
    const { data: uData } = await supabase.from('app_config').select('value').eq('key', 'admin_users').single();
    if (uData && uData.value) {
      try { setUsers(JSON.parse(uData.value)); } catch(e) {}
    } else {
      setUsers([{ id: '1', full_name: 'مدير النظام', username: 'octobercitystudio@gmail.com', role: 'مدير' }]);
    }
  };

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
    const btn = e.nativeEvent.submitter;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> جاري الحفظ...';
    
    const { error } = await supabase.from('services').insert([{
      name: addForm.name,
      category: addForm.category,
      price: Number(addForm.price) || 0,
      total_hours: Number(addForm.total_hours) || 0,
      payment_due_hours: Number(addForm.payment_due_hours) || 0,
      validity_days: Number(addForm.validity_days) || 0,
      total_reels: Number(addForm.total_reels) || 0
    }]);

    if (!error) {
      await fetchData();
      setAddForm({ name: '', category: 'باقة ساعات', price: '', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0 });
      window.bootstrap.Modal.getInstance(document.getElementById('addServiceModal'))?.hide();
    } else {
      alert('حدث خطأ أثناء حفظ الخدمة');
    }
    btn.innerHTML = originalText;
  };

  const handleEditService = async (e) => {
    e.preventDefault();
    const btn = e.nativeEvent.submitter;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> جاري الحفظ...';
    
    const { error } = await supabase.from('services').update({
      name: editForm.name,
      category: editForm.category,
      price: Number(editForm.price) || 0,
      total_hours: Number(editForm.total_hours) || 0,
      payment_due_hours: Number(editForm.payment_due_hours) || 0,
      validity_days: Number(editForm.validity_days) || 0,
      total_reels: Number(editForm.total_reels) || 0
    }).eq('id', editForm.id);

    if (!error) {
      await fetchData();
      window.bootstrap.Modal.getInstance(document.getElementById('editServiceModal'))?.hide();
    } else {
      alert('حدث خطأ أثناء تعديل الخدمة');
    }
    btn.innerHTML = originalText;
  };

  const handleDeleteService = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف ${name} نهائياً؟`)) {
      await supabase.from('services').delete().eq('id', id);
      fetchData();
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const newUser = { id: Date.now().toString(), ...addUserForm };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    
    const { data } = await supabase.from('app_config').select('id').eq('key', 'admin_users').single();
    if (data) await supabase.from('app_config').update({ value: JSON.stringify(updatedUsers) }).eq('key', 'admin_users');
    else await supabase.from('app_config').insert([{ key: 'admin_users', value: JSON.stringify(updatedUsers) }]);
    
    setAddUserForm({ full_name: '', username: '', password: '', role: 'موظف' });
    window.bootstrap.Modal.getInstance(document.getElementById('addUserModal'))?.hide();
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('حذف المستخدم نهائياً ومنعه من الدخول؟')) {
      const updatedUsers = users.filter(u => u.id !== id);
      setUsers(updatedUsers);
      const { data } = await supabase.from('app_config').select('id').eq('key', 'admin_users').single();
      if (data) await supabase.from('app_config').update({ value: JSON.stringify(updatedUsers) }).eq('key', 'admin_users');
    }
  };

  // Cropper logic
  const logoInputRef = useRef(null);
  const imageToCropRef = useRef(null);
  const cropperInstanceRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [currentLogo, setCurrentLogo] = useState('https://via.placeholder.com/150?text=No+Logo');

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

  const openEditModal = (s) => {
    setEditForm({ ...s });
    const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById('editServiceModal'));
    modal.show();
  };

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
        
        .action-btn { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; transition: 0.2s; font-size: 0.9rem; }
        .action-btn:hover { transform: translateY(-2px); }
        .btn-edit-action { background: #f0f7ff; color: #0d6efd; border: 1px solid #cce3ff; }
        .btn-edit-action:hover { background: #0d6efd; color: white; border-color: #0d6efd; }
        .btn-delete-action { background: #fff0f0; color: #dc3545; border: 1px solid #ffcaca; }
        .btn-delete-action:hover { background: #dc3545; color: white; border-color: #dc3545; }
        
        .cropper-container { width: 100%; max-height: 60vh; background-color: #e9ecef; border-radius: 12px; overflow: hidden; }
      `}</style>

      <div className="mb-4 d-none">
        <h3 className="fw-bold text-dark m-0"><i className="fas fa-cogs text-primary me-2"></i> لوحة التحكم وإعدادات النظام</h3>
        <p className="text-muted small mt-1">قم بإدارة باقاتك، المستخدمين، نظام النقاط والنسخ الاحتياطي من هنا.</p>
      </div>

      <div className="setting-section" id="servicesSection">
        <div className="d-flex align-items-center justify-content-between border-bottom pb-4">
          <h5 className="fw-bold m-0" style={{ color: '#1e293b' }}>
            <i className="fas fa-layer-group text-warning ms-2"></i> قائمة الخدمات والباقات
          </h5>
          <button className="btn btn-primary rounded-pill px-4 py-2 fw-bold" style={{background: '#0d6efd', border: 'none'}} data-bs-toggle="modal" data-bs-target="#addServiceModal">
            <i className="fas fa-plus ms-1"></i> إضافة خدمة / باقة جديدة
          </button>
        </div>

        <ul className="nav nav-tabs border-0 flex-row flex-nowrap gap-3 mb-4" id="servicesTabs" role="tablist">
          <li className="nav-item" role="presentation"><button className="nav-link active" id="hourly-tab" data-bs-toggle="tab" data-bs-target="#hourly" type="button" role="tab">باقات الساعات</button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="daily-tab" data-bs-toggle="tab" data-bs-target="#daily" type="button" role="tab">باقات الريلز <i className="fas fa-video opacity-50"></i></button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="monthly-tab" data-bs-toggle="tab" data-bs-target="#monthly" type="button" role="tab">تصوير ومونتاج <i className="fas fa-camera opacity-50"></i></button></li>
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
                  {services.filter(s => s.category === 'باقة ساعات').map(s => (
                    <tr key={s.id}>
                      <td className="text-end pe-4 fw-bold text-dark">{s.name}</td>
                      <td className="fw-bold" style={{color: '#0d6efd'}}>{s.total_hours} س</td>
                      <td className="fw-bold" style={{color: '#198754'}}>{s.price.toFixed(1)}</td>
                      <td className="text-start ps-4">
                        <div className="d-flex gap-2 justify-content-start flex-row-reverse">
                          <button className="btn action-btn btn-delete-action" onClick={() => handleDeleteService(s.id, s.name)} title="حذف"><i className="fas fa-trash-alt"></i></button>
                          <button className="btn action-btn btn-edit-action" onClick={() => openEditModal(s)} title="تعديل"><i className="fas fa-edit"></i></button>
                        </div>
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
                  {services.filter(s => s.category === 'باقة ريلز').map(s => (
                    <tr key={s.id}>
                      <td className="text-end pe-4 fw-bold text-dark">{s.name}</td>
                      <td className="fw-bold" style={{color: '#0d6efd'}}>
                        {s.total_hours} س <br/>
                        {s.payment_due_hours > 0 && <small className="text-danger" style={{fontSize: '0.7rem'}}>استحقاق السداد بعد: {s.payment_due_hours} س</small>}
                      </td>
                      <td className="fw-bold text-muted">{s.validity_days} يوم</td>
                      <td className="fw-bold" style={{color: '#198754'}}>{s.price.toFixed(1)}</td>
                      <td className="text-start ps-4">
                        <div className="d-flex gap-2 justify-content-start flex-row-reverse">
                          <button className="btn action-btn btn-delete-action" onClick={() => handleDeleteService(s.id, s.name)} title="حذف"><i className="fas fa-trash-alt"></i></button>
                          <button className="btn action-btn btn-edit-action" onClick={() => openEditModal(s)} title="تعديل"><i className="fas fa-edit"></i></button>
                        </div>
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
                  {services.filter(s => ['تصوير خارجي', 'مونتاج ديجيتال', 'خدمات منفصلة'].includes(s.category)).map(s => (
                    <tr key={s.id}>
                      <td className="text-end pe-4 fw-bold text-dark">{s.name}</td>
                      <td className="fw-bold" style={{color: '#0d6efd'}}>
                        {s.total_hours} س <br/>
                        {s.payment_due_hours > 0 && <small className="text-danger" style={{fontSize: '0.7rem'}}>استحقاق السداد بعد: {s.payment_due_hours} س</small>}
                      </td>
                      <td className="fw-bold text-muted">{s.validity_days} يوم</td>
                      <td className="fw-bold" style={{color: '#198754'}}>{s.price.toFixed(1)}</td>
                      <td className="text-start ps-4">
                        <div className="d-flex gap-2 justify-content-start flex-row-reverse">
                          <button className="btn action-btn btn-delete-action" onClick={() => handleDeleteService(s.id, s.name)} title="حذف"><i className="fas fa-trash-alt"></i></button>
                          <button className="btn action-btn btn-edit-action" onClick={() => openEditModal(s)} title="تعديل"><i className="fas fa-edit"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          
            </div>
          </div>
        </div>
      </div>

      <div className="setting-section">
        <div className="section-title">
          <span><i className="fas fa-users-cog text-primary me-2"></i> إدارة حسابات النظام</span>
          <button className="btn btn-dark rounded-pill px-4 fw-bold shadow-sm" data-bs-toggle="modal" data-bs-target="#addUserModal">
            <i className="fas fa-user-plus me-1"></i> مستخدم جديد
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-center">
            <thead className="bg-light"><tr><th className="py-3 text-muted small fw-bold">الاسم بالكامل</th><th className="py-3 text-muted small fw-bold">اسم الدخول (Username)</th><th className="py-3 text-muted small fw-bold">الصلاحية</th><th className="py-3 text-muted small fw-bold">إجراءات</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="py-3 fw-bold text-dark">{u.full_name}</td>
                  <td className="py-3 font-monospace text-muted">{u.username}</td>
                  <td className="py-3"><span className={`badge ${u.role === 'مدير' ? 'bg-danger' : 'bg-primary'} rounded-pill px-3 py-2`}>{u.role}</span></td>
                  <td className="py-3">
                    {u.username !== 'octobercitystudio@gmail.com' ? (
                      <button className="btn btn-light text-danger border action-btn" onClick={() => handleDeleteUser(u.id)}><i className="fas fa-trash-alt"></i></button>
                    ) : (
                      <span className="badge bg-light text-muted border px-3 py-2">مالك النظام</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
      <div className="modal fade" id="addServiceModal" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <form onSubmit={handleAddService} className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-primary text-white border-0 p-4">
              <h5 className="fw-bold m-0"><i className="fas fa-plus-circle me-2 text-warning"></i> تسجيل خدمة أو باقة جديدة</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-4 bg-light">
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">اسم الباقة / الخدمة</label>
                <input type="text" className="form-control border-0 py-2 fw-bold shadow-sm" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} required />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">التصنيف</label>
                  <select className="form-select border-0 py-2 fw-bold shadow-sm text-primary" value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value})} required>
                    <option value="باقة ساعات">باقات ساعات</option>
                    <option value="باقة ريلز">باقات ريلز</option>
                    <option value="تصوير خارجي">تصوير خارجي</option>
                    <option value="مونتاج ديجيتال">مونتاج ديجيتال</option>
                    <option value="خدمات منفصلة">خدمات منفصلة</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">السعر (ج.م)</label>
                  <input type="number" className="form-control border-0 py-2 fw-bold text-success shadow-sm" value={addForm.price} onChange={e => setAddForm({...addForm, price: e.target.value})} required />
                </div>
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
              </div>
              <button type="submit" className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow submit-btn" data-bs-dismiss="modal">حفظ وإضافة للنظام</button>
            </div>
          </form>
        </div>
      </div>

      {/* EDIT SERVICE MODAL (Bootstrap native) */}
      <div className="modal fade" id="editServiceModal" tabIndex="-1" data-bs-backdrop="static">
        <div className="modal-dialog modal-dialog-centered">
          <form onSubmit={handleEditService} className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-dark text-white border-0 p-4">
              <h5 className="fw-bold m-0"><i className="fas fa-edit me-2 text-warning"></i> تعديل تفاصيل الخدمة/الباقة</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-4 bg-light">
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">اسم الباقة / الخدمة</label>
                <input type="text" className="form-control border-0 py-2 fw-bold shadow-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">التصنيف</label>
                  <select className="form-select border-0 py-2 fw-bold shadow-sm text-primary" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} required>
                    <option value="باقة ساعات">باقات ساعات</option>
                    <option value="باقة ريلز">باقات ريلز</option>
                    <option value="تصوير خارجي">تصوير خارجي</option>
                    <option value="مونتاج ديجيتال">مونتاج ديجيتال</option>
                    <option value="خدمات منفصلة">خدمات منفصلة</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">السعر (ج.م)</label>
                  <input type="number" className="form-control border-0 py-2 fw-bold text-success shadow-sm" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} required />
                </div>
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
              </div>
              <button type="submit" className="btn btn-dark w-100 py-3 rounded-pill fw-bold shadow submit-btn" data-bs-dismiss="modal">حفظ التعديلات في الخلفية</button>
            </div>
          </form>
        </div>
      </div>

      {/* ADD USER MODAL (Bootstrap native) */}
      <div className="modal fade" id="addUserModal" tabIndex="-1">
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
                <label className="small fw-bold text-muted mb-1">اسم الدخول (Username)</label>
                <input type="text" className="form-control border-0 py-2 font-monospace shadow-sm" style={{direction: 'ltr'}} value={addUserForm.username} onChange={e => setAddUserForm({...addUserForm, username: e.target.value})} required />
              </div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">كلمة المرور</label>
                <input type="password" className="form-control border-0 py-2 shadow-sm" value={addUserForm.password} onChange={e => setAddUserForm({...addUserForm, password: e.target.value})} required />
              </div>
              <div className="mb-4">
                <label className="small fw-bold text-muted mb-1">الصلاحية</label>
                <select className="form-select border-0 py-2 fw-bold shadow-sm" value={addUserForm.role} onChange={e => setAddUserForm({...addUserForm, role: e.target.value})}>
                  <option value="موظف">موظف (حجز ومتابعة)</option>
                  <option value="مدير">مدير (ماليات وحذف)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-dark w-100 py-3 rounded-pill fw-bold shadow submit-btn" data-bs-dismiss="modal">إنشاء الحساب</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default ERPSettings;
