import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { format, addMonths } from 'date-fns';

const ERPReminders = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    type: 'مهمة',
    due_date: '',
    notify_before: 60,
    is_recurring: false,
    amount: ''
  });

  const [payData, setPayData] = useState({
    reminder_id: null,
    title: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    method: 'كاش',
    entity: 'الشركة'
  });

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('status', { ascending: false }) 
      .order('due_date', { ascending: true });
    
    if (data) setReminders(data);
    setLoading(false);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      title: '', type: 'مهمة', due_date: '', notify_before: 60, is_recurring: false, amount: ''
    });
    window.bootstrap.Modal.getOrCreateInstance(document.getElementById('addTaskModal')).show();
  };

  const handleOpenEditModal = (rem) => {
    setEditingId(rem.id);
    const localDate = new Date(rem.due_date);
    const tzoffset = localDate.getTimezoneOffset() * 60000;
    const localISOTime = new Date(localDate - tzoffset).toISOString().slice(0, 16);
    
    setFormData({
      title: rem.title,
      type: rem.type,
      due_date: localISOTime,
      notify_before: rem.notify_before,
      is_recurring: rem.is_recurring,
      amount: rem.amount || ''
    });
    window.bootstrap.Modal.getOrCreateInstance(document.getElementById('editReminderModal')).show();
  };

  const handleOpenPayModal = (rem) => {
    setPayData({
      reminder_id: rem.id,
      title: rem.title,
      amount: rem.amount,
      date: format(new Date(), 'yyyy-MM-dd'),
      method: 'كاش',
      entity: 'الشركة'
    });
    window.bootstrap.Modal.getOrCreateInstance(document.getElementById('payReminderModal')).show();
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    const payload = {
      title: formData.title, type: formData.type, due_date: new Date(formData.due_date).toISOString(),
      notify_before: parseInt(formData.notify_before), is_recurring: formData.is_recurring,
      amount: parseFloat(formData.amount) || 0, status: 'pending'
    };
    await supabase.from('reminders').insert([payload]);
    window.bootstrap.Modal.getInstance(document.getElementById('addTaskModal')).hide();
    fetchReminders();
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const payload = {
      title: formData.title, type: formData.type, due_date: new Date(formData.due_date).toISOString(),
      notify_before: parseInt(formData.notify_before), is_recurring: formData.is_recurring,
      amount: parseFloat(formData.amount) || 0
    };
    await supabase.from('reminders').update(payload).eq('id', editingId);
    window.bootstrap.Modal.getInstance(document.getElementById('editReminderModal')).hide();
    fetchReminders();
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    // Insert into finance
    await supabase.from('finance').insert([{
      type: 'مصروف',
      amount: payData.amount,
      method: payData.method,
      detail: `سداد تذكير: ${payData.title}`,
      date: payData.date,
      entity: payData.entity
    }]);

    // Complete the reminder
    const rem = reminders.find(r => r.id === payData.reminder_id);
    if (rem) {
      if (rem.is_recurring) {
        const nextDate = addMonths(new Date(rem.due_date), 1);
        await supabase.from('reminders').update({ due_date: nextDate.toISOString() }).eq('id', rem.id);
        alert('تم صرف المبلغ وتجديد التذكير للشهر القادم تلقائياً!');
      } else {
        await supabase.from('reminders').update({ status: 'completed' }).eq('id', rem.id);
        alert('تم صرف المبلغ وإنجاز التذكير بنجاح!');
      }
    }

    window.bootstrap.Modal.getInstance(document.getElementById('payReminderModal')).hide();
    fetchReminders();
  };

  const handleComplete = async (rem) => {
    if (!window.confirm('هل متأكد من إنجاز هذه المهمة؟')) return;
    if (rem.is_recurring) {
      const nextDate = addMonths(new Date(rem.due_date), 1);
      await supabase.from('reminders').update({ due_date: nextDate.toISOString() }).eq('id', rem.id);
      alert('تم إنجاز المهمة وتجديدها للشهر القادم تلقائياً!');
    } else {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', rem.id);
    }
    fetchReminders();
  };

  const handleDelete = async (id, isCompleted) => {
    const msg = isCompleted ? 'مسح نهائي؟' : 'تأكيد مسح التذكير؟';
    if (window.confirm(msg)) {
      await supabase.from('reminders').delete().eq('id', id);
      fetchReminders();
    }
  };

  const pendingTasks = reminders.filter(t => t.status === 'pending');
  const completedTasks = reminders.filter(t => t.status === 'completed');

  return (
    <>
    <div className="container-fluid p-0 animate__animated animate__fadeIn" style={{ direction: 'rtl', minHeight: '100vh', background: '#f8f9fc', padding: '20px' }}>
      
      <style>{`
        .hover-elevate:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.08) !important; }
        .nav-tabs .nav-link.active { background-color: #4318ff !important; color: white !important; }
      `}</style>

      <div className="d-flex justify-content-between align-items-center mb-4 mt-3 px-3">
        <h3 className="fw-bold text-dark m-0"><i className="fas fa-tasks text-primary me-2"></i> إدارة المهام والتذكيرات</h3>
        <button className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" onClick={handleOpenAddModal}>
          <i className="fas fa-plus-circle me-1"></i> إضافة مهمة / تذكير جديد
        </button>
      </div>

      <ul className="nav nav-tabs mb-4 border-0 px-3" role="tablist">
        <li className="nav-item me-2" role="presentation">
          <button className={`nav-link fw-bold px-4 py-2 border-0 rounded-pill shadow-sm ${activeTab === 'pending' ? 'active' : 'bg-light text-muted'}`} onClick={() => setActiveTab('pending')}>
            <i className="fas fa-clock text-warning me-1"></i> قيد الانتظار ({pendingTasks.length})
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button className={`nav-link fw-bold px-4 py-2 border-0 rounded-pill shadow-sm ${activeTab === 'completed' ? 'active' : 'bg-light text-muted'}`} onClick={() => setActiveTab('completed')}>
            <i className="fas fa-check-circle text-success me-1"></i> المنجزة
          </button>
        </li>
      </ul>

      <div className="tab-content px-3">
        {activeTab === 'pending' && (
          <div className="tab-pane fade show active">
            <div className="row g-4">
              {loading ? (
                 <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
              ) : pendingTasks.length > 0 ? pendingTasks.map(t => (
                <div key={t.id} className="col-md-6 col-lg-4">
                  <div className={`card border-0 shadow-sm rounded-4 h-100 bg-white border-start border-4 ${t.type === 'مهمة' ? 'border-primary' : 'border-danger'} hover-elevate`} style={{transition: '0.3s'}}>
                    <div className="card-body p-4 d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <span className={`badge ${t.type === 'مهمة' ? 'bg-primary-subtle text-primary' : 'bg-danger-subtle text-danger'} rounded-pill px-3`}>{t.type}</span>
                        {t.is_recurring && <span className="text-muted small fw-bold"><i className="fas fa-sync-alt text-warning me-1"></i> تتكرر شهرياً</span>}
                      </div>
                      <h5 className="fw-bold text-dark mb-3">{t.title}</h5>
                      <div className="bg-light p-3 rounded-3 mb-auto border border-light-subtle">
                        <div className="small fw-bold text-dark mb-1"><i className="far fa-calendar-alt text-primary me-2"></i> الموعد المستحق:</div>
                        <div className="font-monospace text-muted ps-4 mb-2" dir="ltr" style={{textAlign: 'right'}}>{format(new Date(t.due_date), 'yyyy-MM-dd | hh:mm a')}</div>
                        
                        {t.amount > 0 && (
                          <>
                            <hr className="opacity-10 my-2" />
                            <div className="small fw-bold text-success mb-1"><i className="fas fa-money-bill-wave me-2"></i> المبلغ المطلوب:</div>
                            <div className="font-monospace fw-bold text-success ps-4 fs-5">{t.amount} <span className="fs-6 text-muted fw-normal">ج.م</span></div>
                          </>
                        )}
                      </div>
                      
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        <button className="btn btn-sm btn-success rounded-pill flex-grow-1 fw-bold shadow-sm" onClick={() => handleComplete(t)}><i className="fas fa-check me-1"></i> إنجاز</button>
                        <button className="btn btn-sm btn-outline-primary rounded-pill flex-grow-1 fw-bold shadow-sm" onClick={() => handleOpenEditModal(t)}><i className="fas fa-edit"></i> تعديل</button>
                        
                        {t.amount > 0 && (
                          <button className="btn btn-sm btn-danger rounded-pill flex-grow-1 fw-bold shadow-sm" onClick={() => handleOpenPayModal(t)}><i className="fas fa-money-bill-wave"></i> دفع</button>
                        )}
                        
                        <button className="btn btn-sm btn-light border text-danger rounded-circle shadow-sm flex-shrink-0" style={{width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => handleDelete(t.id, false)}><i className="fas fa-trash-alt"></i></button>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-12 text-center py-5">
                  <i className="fas fa-check-double fs-1 text-muted opacity-25 mb-3"></i>
                  <h5 className="fw-bold text-dark">عظيم! لا توجد مهام معلقة.</h5>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="tab-pane fade show active">
            <div className="row g-4">
              {completedTasks.map(t => (
                <div key={t.id} className="col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100 bg-light opacity-75">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <span className="badge bg-success rounded-pill px-3"><i className="fas fa-check me-1"></i> منجزة</span>
                        <span className="text-muted small fw-bold">{t.type}</span>
                      </div>
                      <h5 className="fw-bold text-muted text-decoration-line-through mb-2">{t.title}</h5>
                      {t.amount > 0 && <div className="text-success fw-bold small opacity-75 mb-3"><i className="fas fa-money-bill-wave me-1"></i> {t.amount} ج.م</div>}
                      <div className="text-end mt-3">
                        <button className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold" onClick={() => handleDelete(t.id, true)}><i className="fas fa-trash me-1"></i> مسح</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>

      {/* Add Task Modal */}
      <div className="modal fade" id="addTaskModal" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <form onSubmit={handleSaveAdd} className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-primary text-white border-0 p-4">
              <h5 className="fw-bold m-0"><i className="fas fa-plus-circle text-warning me-2"></i> إنشاء تذكير جديد</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-4 text-end">
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">عنوان المهمة (مثال: موعد دفع الإيجار)</label>
                <input type="text" className="form-control bg-light border-0 py-2 fw-bold" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
              </div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">المبلغ (ج.م) - <span className="text-primary">اختياري</span></label>
                <input type="number" step="0.1" className="form-control bg-success-subtle text-success border-0 py-2 fw-bold" placeholder="أدخل المبلغ إن وجد..." value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">نوع التذكير</label>
                  <select className="form-select bg-light border-0 py-2 fw-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} required>
                    <option value="مهمة">مهمة إدارية / تسليم</option>
                    <option value="دفع شهري">مدفوعات منتظمة (إيجار/نت)</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">موعد التنبيه</label>
                  <select className="form-select bg-light border-0 py-2 fw-bold" value={formData.notify_before} onChange={e => setFormData({...formData, notify_before: e.target.value})} required>
                    <option value="0">في نفس الموعد</option>
                    <option value="60">قبلها بساعة</option>
                    <option value="1440">قبلها بـ 24 ساعة (يوم)</option>
                    <option value="4320">قبلها بـ 3 أيام</option>
                    <option value="10080">قبلها بأسبوع</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">تاريخ ووقت استحقاق المهمة الفعلي</label>
                <input type="datetime-local" className="form-control bg-white border border-primary-subtle py-2 fw-bold text-primary" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} required />
              </div>
              <div className="form-check form-switch bg-warning-subtle p-3 rounded-4 border border-warning border-opacity-25 mt-3 d-flex align-items-center justify-content-end gap-3 flex-row-reverse">
                <input className="form-check-input mt-0" type="checkbox" style={{transform: 'scale(1.5)', cursor: 'pointer', margin: 0}} checked={formData.is_recurring} onChange={e => setFormData({...formData, is_recurring: e.target.checked})} />
                <label className="form-check-label fw-bold text-dark mb-0" style={{cursor: 'pointer'}}>تكرار شهري (عند إنجازها، ستتجدد للمستقبل)</label>
              </div>
            </div>
            <div className="modal-footer border-0 p-4 pt-0 text-start d-block">
              <button type="submit" className="btn btn-primary w-100 py-3 rounded-4 fw-bold shadow">حفظ التذكير وتشغيل المنبه</button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Task Modal */}
      <div className="modal fade" id="editReminderModal" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <form onSubmit={handleSaveEdit} className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-dark text-white border-0 p-4">
              <h5 className="fw-bold m-0"><i className="fas fa-edit text-warning me-2"></i> تعديل التذكير</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-4 bg-light text-end">
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">عنوان المهمة</label>
                <input type="text" className="form-control bg-white border-0 py-2 fw-bold" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
              </div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">المبلغ (ج.م) - <span className="text-primary">اختياري</span></label>
                <input type="number" step="0.1" className="form-control bg-success-subtle text-success border-0 py-2 fw-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">نوع التذكير</label>
                  <select className="form-select bg-white border-0 py-2 fw-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} required>
                    <option value="مهمة">مهمة إدارية / تسليم</option>
                    <option value="دفع شهري">مدفوعات منتظمة (إيجار/نت)</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">موعد التنبيه</label>
                  <select className="form-select bg-white border-0 py-2 fw-bold" value={formData.notify_before} onChange={e => setFormData({...formData, notify_before: e.target.value})} required>
                    <option value="0">في نفس الموعد</option>
                    <option value="60">قبلها بساعة</option>
                    <option value="1440">قبلها بـ 24 ساعة (يوم)</option>
                    <option value="4320">قبلها بـ 3 أيام</option>
                    <option value="10080">قبلها بأسبوع</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">تاريخ ووقت الاستحقاق</label>
                <input type="datetime-local" className="form-control bg-white border-0 py-2 fw-bold text-primary" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} required />
              </div>
              <div className="form-check form-switch bg-warning-subtle p-3 rounded-4 border border-warning border-opacity-25 mt-3 d-flex align-items-center justify-content-end flex-row-reverse gap-3">
                <input className="form-check-input mt-0" type="checkbox" style={{transform: 'scale(1.5)', cursor: 'pointer', margin: 0}} checked={formData.is_recurring} onChange={e => setFormData({...formData, is_recurring: e.target.checked})} />
                <label className="form-check-label fw-bold text-dark mb-0" style={{cursor: 'pointer'}}>تكرار شهري</label>
              </div>
            </div>
            <div className="modal-footer border-0 p-4 pt-0 bg-white text-start d-block">
              <button type="submit" className="btn btn-dark w-100 py-3 rounded-4 fw-bold shadow">تحديث البيانات</button>
            </div>
          </form>
        </div>
      </div>

      {/* Pay Reminder Modal */}
      <div className="modal fade" id="payReminderModal" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <form onSubmit={handlePaySubmit} className="modal-content border-0 shadow-lg rounded-5 overflow-hidden">
            <div className="modal-header bg-danger text-white border-0 p-4">
              <h5 className="fw-bold m-0"><i className="fas fa-file-invoice-dollar me-2"></i> صرف سريع وتسكين في الحسابات</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-4 bg-white text-end">
              <div className="mb-3">
                <label className="small fw-bold text-muted mb-1">بيان المصروف</label>
                <input type="text" className="form-control bg-light border-0 py-2 fw-bold" value={`سداد تذكير: ${payData.title}`} readOnly required />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">المبلغ المراد صرفه</label>
                  <input type="number" step="0.1" className="form-control bg-danger-subtle text-danger border-0 py-2 fw-bold text-center fs-5" value={payData.amount} onChange={e => setPayData({...payData, amount: e.target.value})} required />
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">تاريخ المعاملة</label>
                  <input type="date" className="form-control bg-light border-0 fw-bold" value={payData.date} onChange={e => setPayData({...payData, date: e.target.value})} required />
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">سحب من الخزينة</label>
                  <select className="form-select bg-light border-0 fw-bold" value={payData.method} onChange={e => setPayData({...payData, method: e.target.value})}>
                    <option value="كاش">كاش</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="انستاباي">إنستاباي</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold text-muted mb-1">دُفع بواسطة (للشركاء)</label>
                  <select className="form-select bg-danger-subtle text-danger border-0 fw-bold" value={payData.entity} onChange={e => setPayData({...payData, entity: e.target.value})}>
                    <option value="الشركة">الشركة</option>
                    <option value="اشرف">أشرف</option>
                    <option value="مروة">مروة</option>
                  </select>
                </div>
              </div>
              <div className="alert alert-warning border-0 rounded-4 small fw-bold mb-0 mt-2 text-center">
                <i className="fas fa-info-circle me-1"></i> سيتم تسجيل هذا المبلغ كمصروف رسمي في الدفاتر المالية فوراً!
              </div>
            </div>
            <div className="modal-footer border-0 p-4 pt-0 bg-white text-start d-block">
              <button type="submit" className="btn btn-danger w-100 py-3 rounded-4 fw-bold shadow">تأكيد الصرف المالي</button>
            </div>
          </form>
        </div>
      </div>

    </>
  );
};

export default ERPReminders;
