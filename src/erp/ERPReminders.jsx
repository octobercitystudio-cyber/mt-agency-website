import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Clock, CheckCircle, Trash2, Edit2, Plus, RefreshCw, DollarSign, Bell } from 'lucide-react';
import { format, addMonths } from 'date-fns';

const ERPReminders = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    type: 'مهمة',
    due_date: '',
    notify_before: 60,
    is_recurring: false,
    amount: ''
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
    
    if (data) {
      // Sort manually: pending first, then completed
      const sorted = data.sort((a, b) => {
        if (a.status === 'pending' && b.status === 'completed') return -1;
        if (a.status === 'completed' && b.status === 'pending') return 1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
      setReminders(sorted);
    }
    setLoading(false);
  };

  const handleOpenModal = (reminder = null) => {
    if (reminder) {
      setEditingId(reminder.id);
      // Format datetime for datetime-local input
      const localDate = new Date(reminder.due_date);
      const tzoffset = localDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(localDate - tzoffset).toISOString().slice(0, 16);
      
      setFormData({
        title: reminder.title,
        type: reminder.type,
        due_date: localISOTime,
        notify_before: reminder.notify_before,
        is_recurring: reminder.is_recurring,
        amount: reminder.amount || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        type: 'مهمة',
        due_date: '',
        notify_before: 60,
        is_recurring: false,
        amount: ''
      });
    }
    const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById('reminderModal'));
    modal.show();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      title: formData.title,
      type: formData.type,
      due_date: new Date(formData.due_date).toISOString(),
      notify_before: parseInt(formData.notify_before),
      is_recurring: formData.is_recurring,
      amount: parseFloat(formData.amount) || 0,
      status: 'pending'
    };

    if (editingId) {
      await supabase.from('reminders').update(payload).eq('id', editingId);
    } else {
      await supabase.from('reminders').insert([payload]);
    }

    const modal = window.bootstrap.Modal.getInstance(document.getElementById('reminderModal'));
    modal.hide();
    fetchReminders();
  };

  const handleComplete = async (reminder) => {
    if (reminder.is_recurring) {
      const nextDate = addMonths(new Date(reminder.due_date), 1);
      await supabase.from('reminders').update({ 
        due_date: nextDate.toISOString() 
      }).eq('id', reminder.id);
      alert('تم إنجاز المهمة وتجديدها للشهر القادم بنجاح!');
    } else {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', reminder.id);
    }
    fetchReminders();
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا التذكير؟')) {
      await supabase.from('reminders').delete().eq('id', id);
      fetchReminders();
    }
  };

  return (
    <div className="container-fluid p-0 animate__animated animate__fadeIn pb-5" style={{ background: '#f8f9fc', minHeight: '100vh', padding: '20px', direction: 'rtl' }}>
      
      <div className="d-flex justify-content-between align-items-center mb-4 mt-3 px-3">
        <div>
          <h2 className="fw-bold" style={{ color: '#1e293b', margin: 0 }}>
            <ClipboardList className="me-2 text-primary" size={28} />
            المهام والتذكيرات
          </h2>
          <p className="text-muted mt-1 mb-0">إدارة الالتزامات المالية والمواعيد الإدارية الهامة</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn btn-primary shadow-sm rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2">
          <Plus size={20} /> إضافة تذكير جديد
        </button>
      </div>

      <div className="row px-3">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-3 text-muted">جاري تحميل المهام...</p>
          </div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-5 col-12 bg-white rounded-4 shadow-sm border-0">
            <CheckCircle size={50} style={{color: '#10b981', opacity: 0.5, marginBottom: '15px'}} />
            <h4 className="fw-bold text-muted">لا توجد مهام حالياً</h4>
            <p className="text-muted mb-0">أنت على اطلاع بكل شيء! لا توجد تذكيرات معلقة.</p>
          </div>
        ) : (
          reminders.map(rem => {
            const isCompleted = rem.status === 'completed';
            const isOverdue = !isCompleted && new Date(rem.due_date) < new Date();
            const dateObj = new Date(rem.due_date);
            
            let cardStyle = { background: 'white', borderRight: '5px solid #4318ff' };
            if (isCompleted) cardStyle.borderRight = '5px solid #10b981';
            else if (isOverdue) cardStyle.borderRight = '5px solid #ef4444';
            else if (rem.type === 'دفعة') cardStyle.borderRight = '5px solid #f59e0b';

            return (
              <div key={rem.id} className="col-12 col-md-6 col-lg-4 mb-4">
                <div className="card h-100 border-0 shadow-sm rounded-4" style={{...cardStyle, opacity: isCompleted ? 0.7 : 1, transition: '0.3s'}}>
                  <div className="card-body p-4 position-relative">
                    
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <h5 className="fw-bold m-0 text-dark" style={{textDecoration: isCompleted ? 'line-through' : 'none'}}>
                        {rem.title}
                      </h5>
                      <span className={`badge rounded-pill ${rem.type === 'مهمة' ? 'bg-primary' : rem.type === 'دفعة' ? 'bg-warning text-dark' : 'bg-info'}`}>
                        {rem.type}
                      </span>
                    </div>

                    <div className="d-flex align-items-center mb-2 text-muted" style={{fontSize: '0.9rem'}}>
                      <Calendar size={16} className="ms-2" /> 
                      <span dir="ltr">{format(dateObj, 'dd/MM/yyyy')}</span>
                    </div>

                    <div className="d-flex align-items-center mb-2 text-muted" style={{fontSize: '0.9rem'}}>
                      <Clock size={16} className="ms-2" /> 
                      <span dir="ltr">{format(dateObj, 'hh:mm a')}</span>
                      {isOverdue && !isCompleted && <span className="me-2 badge bg-danger-subtle text-danger rounded-pill">تأخير!</span>}
                    </div>

                    {rem.amount > 0 && (
                      <div className="d-flex align-items-center mb-3 fw-bold text-danger">
                        <DollarSign size={16} className="ms-2" /> المبلغ المستحق: {rem.amount} ج.م
                      </div>
                    )}

                    <div className="d-flex gap-2 flex-wrap text-muted mb-4" style={{fontSize: '0.8rem'}}>
                      {rem.is_recurring && <span className="badge bg-light text-dark border"><RefreshCw size={12} className="ms-1"/> يتكرر شهرياً</span>}
                      <span className="badge bg-light text-dark border"><Bell size={12} className="ms-1"/> تنبيه قبل {rem.notify_before} د</span>
                    </div>

                    <div className="d-flex gap-2 mt-auto pt-3 border-top">
                      {!isCompleted && (
                        <button className="btn btn-success flex-grow-1 rounded-3 py-2 d-flex justify-content-center align-items-center fw-bold" onClick={() => handleComplete(rem)}>
                          <CheckCircle size={18} className="ms-2"/> إنجاز
                        </button>
                      )}
                      <button className="btn btn-light border text-primary rounded-3 px-3" onClick={() => handleOpenModal(rem)} title="تعديل">
                        <Edit2 size={18} />
                      </button>
                      <button className="btn btn-light border text-danger rounded-3 px-3" onClick={() => handleDelete(rem.id)} title="حذف">
                        <Trash2 size={18} />
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reminder Modal */}
      <div className="modal fade" id="reminderModal" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg rounded-5">
            <div className="modal-header bg-dark text-white border-0 p-4">
              <h5 className="fw-bold m-0">{editingId ? 'تعديل التذكير' : 'إضافة تذكير جديد'}</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-4 bg-light" style={{ direction: 'rtl' }}>
              <form onSubmit={handleSave}>
                
                <div className="mb-3">
                  <label className="fw-bold text-muted mb-2">عنوان التذكير</label>
                  <input type="text" className="form-control p-3 border-0 rounded-4 shadow-sm" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="مثال: سداد قسط كاميرا، دفع الإيجار..." required />
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="fw-bold text-muted mb-2">النوع</label>
                    <select className="form-select p-3 border-0 rounded-4 shadow-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                      <option value="مهمة">مهمة</option>
                      <option value="دفعة">دفعة أو قسط</option>
                      <option value="تذكير">تذكير عام</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="fw-bold text-muted mb-2">المبلغ (اختياري)</label>
                    <input type="number" className="form-control p-3 border-0 rounded-4 shadow-sm" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.0" />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="fw-bold text-muted mb-2">تاريخ ووقت الاستحقاق</label>
                  <input type="datetime-local" className="form-control p-3 border-0 rounded-4 shadow-sm" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} required />
                </div>

                <div className="mb-3">
                  <label className="fw-bold text-muted mb-2">التنبيه المسبق</label>
                  <select className="form-select p-3 border-0 rounded-4 shadow-sm" value={formData.notify_before} onChange={e => setFormData({...formData, notify_before: e.target.value})}>
                    <option value="15">قبل ربع ساعة</option>
                    <option value="60">قبل ساعة</option>
                    <option value="1440">قبل يوم كامل</option>
                    <option value="2880">قبل يومين</option>
                  </select>
                </div>

                <div className="mb-4 form-check form-switch d-flex align-items-center gap-2">
                  <input className="form-check-input mt-0" type="checkbox" role="switch" id="recurringSwitch" style={{width: '40px', height: '20px'}} checked={formData.is_recurring} onChange={e => setFormData({...formData, is_recurring: e.target.checked})} />
                  <label className="form-check-label fw-bold text-primary" htmlFor="recurringSwitch">تذكير متكرر (يتجدد شهرياً تلقائياً)</label>
                </div>

                <button type="submit" className="btn btn-primary w-100 py-3 rounded-4 fw-bold">
                  حفظ التذكير
                </button>

              </form>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ERPReminders;
