import React, { useState, useEffect, useRef } from 'react';
import Cropper from 'cropperjs';

const ERPSettings = () => {
  // Dummy Data State (Simulation of backend data)
  const [services, setServices] = useState([
    { id: '1', name: 'جلسة خارجية ساعة', category: 'تصوير بالساعة', total_hours: 1, price: 500, validity_days: 0, payment_due_hours: 0, total_reels: 0 },
    { id: '2', name: 'باقة 5 ساعات خارجية', category: 'باقة يومية', total_hours: 5, validity_days: 1, price: 2000, payment_due_hours: 2, total_reels: 0 },
    { id: '3', name: 'تغطية شهرية سوشيال (10س)', category: 'باقة شهرية', total_hours: 10, validity_days: 30, price: 4000, payment_due_hours: 5, total_reels: 0 },
    { id: '4', name: 'ريلز انستجرام (5 فيديو)', category: 'باقة ريلز', total_reels: 5, price: 1500, total_hours: 0, validity_days: 0, payment_due_hours: 0 },
    { id: '5', name: 'خدمة مونتاج إضافية', category: 'خدمة إضافية', price: 1000, total_hours: 0, validity_days: 0, payment_due_hours: 0, total_reels: 0 },
  ]);

  const [users, setUsers] = useState([
    { id: '1', full_name: 'مدير النظام', username: 'octobercitystudio@gmail.com', role: 'مدير' },
    { id: '2', full_name: 'أشرف السعيد', username: 'ashraf', role: 'مدير' },
    { id: '3', full_name: 'مروة', username: 'marwa', role: 'موظف' },
  ]);

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
  const [addForm, setAddForm] = useState({ name: '', category: 'باقة شهرية', price: '', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0 });
  const [editForm, setEditForm] = useState({ id: '', name: '', category: 'باقة شهرية', price: '', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0 });

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

    cropperInstanceRef.current.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toBlob(function(blob) {
      // Simulate upload and display
      const url = URL.createObjectURL(blob);
      setCurrentLogo(url);
      btn.innerHTML = '<i class="fas fa-check me-2"></i> تم التحديث بنجاح';
      btn.classList.replace('btn-primary', 'btn-success');
      setTimeout(() => {
        setIsCropModalOpen(false);
        btn.innerHTML = originalText;
        btn.classList.replace('btn-success', 'btn-primary');
        btn.disabled = false;
      }, 1000);
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
    <div className="container-fluid p-0 animate__animated animate__fadeIn pb-5">
      <style>{`
        .nav-tabs { border-bottom: 1px solid #e2e8f0; gap: 10px; justify-content: flex-start; padding-bottom: 10px; margin-bottom: 20px; }
        .nav-tabs .nav-item { margin-bottom: 0; }
        .nav-tabs .nav-link { 
          color: #64748b !important; 
          font-weight: 700; 
          border: 1px solid transparent; 
          border-radius: 12px; 
          padding: 10px 24px; 
          transition: all 0.3s ease; 
          background: transparent;
        }
        .nav-tabs .nav-link.active { 
          color: #4318ff !important; 
          border: 1px solid rgba(67,24,255,0.3) !important; 
          background: #ffffff !important; 
          box-shadow: 0 4px 15px rgba(67,24,255,0.08) !important; 
        }
        .nav-tabs .nav-link:hover:not(.active) { 
          color: #4318ff !important; 
          background: #f8fafc;
        }
        
        .setting-section { background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); padding: 25px; margin-bottom: 30px; border: 1px solid rgba(0,0,0,0.02); }
        .section-title { font-weight: 800; color: #1e293b; margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between; }
        
        .table-hover tbody tr { transition: all 0.2s ease; border-bottom: 1px solid #f1f5f9; }
        .table-hover tbody tr:last-child { border-bottom: none; }
        .table-hover tbody tr:hover { background-color: #f8fafc; }
        
        .action-btn { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; transition: 0.2s; font-size: 0.9rem; }
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
        <div className="section-title border-bottom pb-4 mb-4">
          <span className="fs-5"><i className="fas fa-layer-group text-warning me-2"></i> قائمة الخدمات والباقات</span>
          <button className="btn btn-primary rounded-pill px-4 py-2 fw-bold shadow-sm" style={{background: '#0d6efd'}} data-bs-toggle="modal" data-bs-target="#addServiceModal">
            <i className="fas fa-plus me-1"></i> إضافة خدمة / باقة جديدة
          </button>
        </div>

        <ul className="nav nav-tabs border-0 gap-2 mb-4" id="servicesTabs" role="tablist">
          <li className="nav-item" role="presentation"><button className="nav-link active" id="hourly-tab" data-bs-toggle="tab" data-bs-target="#hourly" type="button" role="tab">التصوير بالساعة</button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="daily-tab" data-bs-toggle="tab" data-bs-target="#daily" type="button" role="tab"><i className="fas fa-cog me-1 opacity-50"></i> الباقات اليومية</button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="monthly-tab" data-bs-toggle="tab" data-bs-target="#monthly" type="button" role="tab"><i className="fas fa-calendar-alt me-1 opacity-50"></i> الباقات الشهرية</button></li>
          <li className="nav-item" role="presentation"><button className="nav-link" id="others-tab" data-bs-toggle="tab" data-bs-target="#others" type="button" role="tab"><i className="fas fa-star me-1 opacity-50"></i> الخدمات والريلز</button></li>
        </ul>

        <div className="tab-content" id="servicesTabsContent">
          {/* Hourly */}
          <div className="tab-pane fade show active" id="hourly" role="tabpanel">
            <div className="table-responsive">
              <table className="table table-hover table-borderless align-middle text-center mb-0">
                <thead><tr style={{borderBottom: '1px solid #e2e8f0'}}><th className="py-3 text-muted small fw-bold">اسم الخدمة</th><th className="py-3 text-muted small fw-bold">الساعات</th><th className="py-3 text-muted small fw-bold">السعر (ج.م)</th><th className="py-3 text-muted small fw-bold">إجراءات</th></tr></thead>
                <tbody>
                  {services.filter(s => s.category === 'تصوير بالساعة').map(s => (
                    <tr key={s.id}>
                      <td className="py-4 fw-bold text-dark">{s.name}</td>
                      <td className="py-4 fw-bold text-primary">{s.total_hours} س</td>
                      <td className="py-4 fw-bold text-success">{s.price.toFixed(1)}</td>
                      <td className="py-4">
                        <div className="d-flex gap-2 justify-content-center">
                          <button className="btn action-btn btn-delete-action" onClick={() => window.confirm('حذف الخدمة نهائياً؟')} title="حذف"><i className="fas fa-trash-alt"></i></button>
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
              <table className="table table-hover table-borderless align-middle text-center mb-0">
                <thead><tr style={{borderBottom: '1px solid #e2e8f0'}}><th className="py-3 text-muted small fw-bold">اسم الباقة</th><th className="py-3 text-muted small fw-bold">تفاصيل الباقة</th><th className="py-3 text-muted small fw-bold">الصلاحية</th><th className="py-3 text-muted small fw-bold">السعر (ج.م)</th><th className="py-3 text-muted small fw-bold">إجراءات</th></tr></thead>
                <tbody>
                  {services.filter(s => s.category === 'باقة يومية').map(s => (
                    <tr key={s.id}>
                      <td className="py-4 fw-bold text-dark">{s.name}</td>
                      <td className="py-4 fw-bold text-primary">
                        {s.total_hours} س <br/>
                        {s.payment_due_hours > 0 && <small className="text-danger" style={{fontSize: '0.7rem'}}>استحقاق السداد بعد: {s.payment_due_hours} س</small>}
                      </td>
                      <td className="py-4 fw-bold text-muted">{s.validity_days} يوم</td><td className="py-4 fw-bold text-success">{s.price.toFixed(1)}</td>
                      <td className="py-4">
                        <div className="d-flex gap-2 justify-content-center">
                          <button className="btn action-btn btn-delete-action" onClick={() => window.confirm('حذف الباقة نهائياً؟')} title="حذف"><i className="fas fa-trash-alt"></i></button>
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
              <table className="table table-hover table-borderless align-middle text-center mb-0">
                <thead><tr style={{borderBottom: '1px solid #e2e8f0'}}><th className="py-3 text-muted small fw-bold">اسم الباقة</th><th className="py-3 text-muted small fw-bold">تفاصيل الباقة</th><th className="py-3 text-muted small fw-bold">الصلاحية</th><th className="py-3 text-muted small fw-bold">السعر (ج.م)</th><th className="py-3 text-muted small fw-bold">إجراءات</th></tr></thead>
                <tbody>
                  {services.filter(s => s.category === 'باقة شهرية').map(s => (
                    <tr key={s.id}>
                      <td className="py-4 fw-bold text-dark">{s.name}</td>
                      <td className="py-4 fw-bold text-primary">
                        {s.total_hours} س <br/>
                        {s.payment_due_hours > 0 && <small className="text-danger" style={{fontSize: '0.7rem'}}>استحقاق السداد بعد: {s.payment_due_hours} س</small>}
                      </td>
                      <td className="py-4 fw-bold text-muted">{s.validity_days} يوم</td><td className="py-4 fw-bold text-success">{s.price.toFixed(1)}</td>
                      <td className="py-4">
                        <div className="d-flex gap-2 justify-content-center">
                          <button className="btn action-btn btn-delete-action" onClick={() => window.confirm('حذف الباقة نهائياً؟')} title="حذف"><i className="fas fa-trash-alt"></i></button>
                          <button className="btn action-btn btn-edit-action" onClick={() => openEditModal(s)} title="تعديل"><i className="fas fa-edit"></i></button>
                        </div>
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
              <table className="table table-hover table-borderless align-middle text-center mb-0">
                <thead><tr style={{borderBottom: '1px solid #e2e8f0'}}><th className="py-3 text-muted small fw-bold">اسم الخدمة</th><th className="py-3 text-muted small fw-bold">التصنيف</th><th className="py-3 text-muted small fw-bold">التفاصيل</th><th className="py-3 text-muted small fw-bold">السعر (ج.م)</th><th className="py-3 text-muted small fw-bold">إجراءات</th></tr></thead>
                <tbody>
                  {services.filter(s => s.category === 'خدمة إضافية' || s.category === 'باقة ريلز').map(s => (
                    <tr key={s.id}>
                      <td className="py-4 fw-bold text-dark">{s.name}</td>
                      <td className="py-4"><span className="badge bg-secondary-subtle text-secondary border rounded-pill">{s.category}</span></td>
                      <td className="py-4 fw-bold text-muted">{s.category === 'باقة ريلز' ? `${s.total_reels} فيديو` : '-'}</td>
                      <td className="py-4 fw-bold text-success">{s.price.toFixed(1)}</td>
                      <td className="py-4">
                        <div className="d-flex gap-2 justify-content-center">
                          <button className="btn action-btn btn-delete-action" onClick={() => window.confirm('حذف الخدمة نهائياً؟')} title="حذف"><i className="fas fa-trash-alt"></i></button>
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
                      <button className="btn btn-light text-danger border action-btn" onClick={() => window.confirm('حذف المستخدم نهائياً ومنعه من الدخول؟')}><i className="fas fa-trash-alt"></i></button>
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
        <form onSubmit={e => { e.preventDefault(); alert('تم الحفظ'); }}>
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
            
            <form onSubmit={e => { e.preventDefault(); alert('تم الحفظ'); }} className="mb-4">
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
              <button className="btn btn-primary rounded-pill flex-grow-1 py-2 fw-bold" onClick={() => alert('تحميل...')}><i className="fas fa-download me-1"></i> تحميل نسخة</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); alert('تم الاستعادة'); }} className="mt-3 p-3 bg-danger-subtle rounded-4 border border-danger border-opacity-25">
              <label className="small fw-bold text-danger mb-2"><i className="fas fa-exclamation-triangle"></i> استعادة نسخة (سيمسح الحالي):</label>
              <input type="file" className="form-control mb-2 bg-white border-0" accept=".db" required />
              <button type="submit" className="btn btn-danger w-100 rounded-pill py-2 fw-bold" onClick={(e) => { if(!window.confirm('تحذير خطير: هل أنت متأكد من استبدال قاعدة البيانات؟')) e.preventDefault(); }}><i className="fas fa-sync-alt me-1"></i> استعادة</button>
            </form>
          </div>
        </div>

        <div className="col-12 mt-4">
          <div className="setting-section mb-0">
            <h5 className="fw-bold text-dark mb-4"><i className="fas fa-file-csv text-info me-2"></i> استيراد جهات الاتصال (Google CSV)</h5>
            
            <form onSubmit={e => { e.preventDefault(); alert('تم الاستيراد'); }}>
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
          <form onSubmit={e => { e.preventDefault(); alert('تم الحفظ'); }} className="modal-content border-0 shadow-lg rounded-5">
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
                    <option value="تصوير بالساعة">تصوير بالساعة</option>
                    <option value="باقة يومية">باقات يومية</option>
                    <option value="باقة شهرية">باقات شهرية</option>
                    <option value="باقة ريلز">باقات ريلز</option>
                    <option value="خدمة إضافية">خدمات إضافية (جرافيك وغيرها)</option>
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
          <form onSubmit={e => { e.preventDefault(); alert('تم الحفظ'); }} className="modal-content border-0 shadow-lg rounded-5">
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
                    <option value="تصوير بالساعة">تصوير بالساعة</option>
                    <option value="باقة يومية">باقات يومية</option>
                    <option value="باقة شهرية">باقات شهرية</option>
                    <option value="باقة ريلز">باقات ريلز</option>
                    <option value="خدمة إضافية">خدمات إضافية (جرافيك وغيرها)</option>
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
          <form onSubmit={e => { e.preventDefault(); alert('تم الحفظ'); }} className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-dark text-white border-0 p-4">
              <h5 className="fw-bold m-0"><i className="fas fa-user-plus me-2 text-warning"></i> إضافة مستخدم جديد</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-4 bg-light">
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">الاسم بالكامل</label>
                <input type="text" className="form-control border-0 py-2 fw-bold shadow-sm" required />
              </div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">اسم الدخول (Username)</label>
                <input type="text" className="form-control border-0 py-2 font-monospace shadow-sm" style={{direction: 'ltr'}} required />
              </div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">كلمة المرور</label>
                <input type="password" className="form-control border-0 py-2 shadow-sm" required />
              </div>
              <div className="mb-4">
                <label className="small fw-bold text-muted mb-1">الصلاحية</label>
                <select className="form-select border-0 py-2 fw-bold shadow-sm">
                  <option value="موظف">موظف (حجز ومتابعة)</option>
                  <option value="مدير">مدير (ماليات وحذف)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-dark w-100 py-3 rounded-pill fw-bold shadow submit-btn" data-bs-dismiss="modal">إنشاء الحساب</button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
};

export default ERPSettings;
