import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CalendarPlus, Trash2, DollarSign, X, CheckCircle, Truck, Pointer } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

const ERPAddBookingModal = ({ isOpen, onClose, onSuccess, prefilledClientName = '' }) => {
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]); // for validation and calendar events
  const [loading, setLoading] = useState(true);

  const [newBooking, setNewBooking] = useState({
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
    schedule_extra: false
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
      if (prefilledClientName) {
        // Find client color if clients are already loaded
        const client = clients.find(c => c.name === prefilledClientName);
        setNewBooking(prev => ({
          ...prev,
          client_name: prefilledClientName,
          color: client?.color || '#4318ff',
          category: '', service: '', dates: [], paid: 0, discount: 0, discount_reason: '', base_price: 0, schedule_extra: false
        }));
      } else {
        setNewBooking({
          client_name: '', color: '#4318ff', category: '', service: '', dates: [], delivery_date: '', base_price: 0, discount: 0, discount_reason: '', paid: 0, payment_method: 'فودافون كاش', notes: '', schedule_extra: false
        });
      }
    }
  }, [isOpen, prefilledClientName]);

  const fetchData = async () => {
    setLoading(true);
    const { data: bData } = await supabase.from('bookings').select('*');
    const { data: cData } = await supabase.from('clients').select('name, color');
    const { data: sData } = await supabase.from('services').select('*');

    if (bData) setBookings(bData);
    if (cData) {
      setClients(cData);
      if (prefilledClientName) {
        const client = cData.find(c => c.name === prefilledClientName);
        if (client) setNewBooking(prev => ({ ...prev, color: client.color }));
      }
    }
    if (sData) setServices(sData);
    
    setLoading(false);
  };

  const getClientColor = (clientName) => {
    const client = clients.find(c => c.name === clientName);
    return client?.color || '#4318ff';
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
    setNewBooking({ ...newBooking, service: sName, base_price: srv?.price || 0 });
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

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    
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

    const needsDates = newBooking.category !== 'باقة ريلز' && newBooking.category !== 'خدمة إضافية' || newBooking.schedule_extra;
    if (needsDates && newBooking.dates.length === 0) {
      alert('يجب تحديد موعد واحد على الأقل في التقويم أو عن طريق الضغط مرتين على اليوم المختار');
      return;
    }

    if (newBooking.paid > 0) {
      await supabase.from('finance').insert([{
        type: 'إيراد',
        amount: newBooking.paid,
        method: newBooking.payment_method,
        detail: `دفعة من ${newBooking.client_name} لخدمة ${newBooking.service}`,
        date: format(new Date(), 'yyyy-MM-dd'),
        entity: 'الشركة'
      }]);
    }

    let bookingsToInsert = [];
    
    if (needsDates) {
      bookingsToInsert = newBooking.dates.map(d => {
        let hours = 0;
        if (d.start_time && d.end_time) {
          const [startH, startM] = d.start_time.split(':').map(Number);
          const [endH, endM] = d.end_time.split(':').map(Number);
          const diffInMinutes = (endH * 60 + endM) - (startH * 60 + startM);
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
          payment: newBooking.paid
        };
      });
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

    const { error } = await supabase.from('bookings').insert(bookingsToInsert);

    if (!error) {
      alert('تم إضافة الحجز بنجاح');
      onSuccess && onSuccess();
      onClose();
    } else {
      alert('حدث خطأ أثناء إضافة الحجز');
    }
  };

  if (!isOpen) return null;

  const showCalendar = newBooking.category !== 'باقة ريلز' && newBooking.category !== 'خدمة إضافية' || newBooking.schedule_extra;
  const showDelivery = newBooking.category === 'باقة ريلز' || newBooking.category === 'خدمة إضافية';
  const remainingPrice = Math.max(0, newBooking.base_price - newBooking.discount - newBooking.paid);

  const calendarEvents = bookings.map(b => ({
    id: b.id,
    title: b.client_name,
    start: b.date,
    color: getClientColor(b.client_name),
  }));

  return (
    <div className="erp-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div style={{ background: 'var(--erp-surface)', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '25px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: 'none' }} onClick={e => e.stopPropagation()}>
        
        <div style={{ background: '#1e293b', color: 'white', padding: '25px', borderTopLeftRadius: '25px', borderTopRightRadius: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h5 style={{ margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <CalendarPlus color="var(--erp-warning)" size={24} style={{ marginLeft: '10px' }} /> تسجيل موعد أو شراء خدمة
          </h5>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}>جاري التحميل...</div>
        ) : (
          <form onSubmit={handleSaveBooking} style={{ padding: '25px' }}>
            
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
                  <option value="تصوير بالساعة">تصوير بالساعة</option>
                  <option value="باقة يومية">باقات يومية</option>
                  <option value="باقة شهرية">باقات شهرية</option>
                  <option value="باقة ريلز">باقات ريلز</option>
                  <option value="خدمة إضافية">خدمات إضافية</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '8px', display: 'block' }}>اسم الخدمة</label>
                <select value={newBooking.service} onChange={handleServiceChange} required disabled={!newBooking.category} style={{ width: '100%', background: 'var(--erp-bg)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <option value="" disabled>-- اختر الخدمة --</option>
                  {services.filter(s => s.category === newBooking.category).map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <hr style={{ opacity: 0.1, margin: '20px 0' }} />

            {showDelivery && (
              <div style={{ background: 'rgba(67, 24, 255, 0.05)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(67, 24, 255, 0.2)', marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                <input type="checkbox" id="schedExtraCb" checked={newBooking.schedule_extra} onChange={e => setNewBooking({...newBooking, schedule_extra: e.target.checked})} style={{ transform: 'scale(1.5)', marginLeft: '15px', cursor: 'pointer' }} />
                <label htmlFor="schedExtraCb" style={{ fontWeight: 'bold', color: 'var(--erp-primary)', cursor: 'pointer', margin: 0 }}>تحديد موعد للخدمة الإضافية/الريلز في التقويم الآن</label>
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
                        <input type="time" value={dRow.start_time} onChange={(e) => updateDateRow(idx, 'start_time', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', fontWeight: 'bold' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>إلى الساعة</label>
                        <input type="time" value={dRow.end_time} onChange={(e) => updateDateRow(idx, 'end_time', e.target.value)} required style={{ width: '100%', border: 'none', background: 'var(--erp-bg)', padding: '10px', borderRadius: '8px', fontWeight: 'bold' }} />
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
            <div style={{ background: 'var(--erp-bg)', border: '1px solid var(--erp-border)', padding: '25px', borderRadius: '20px', marginBottom: '25px' }}>
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
        )}
      </div>
    </div>
  );
};

export default ERPAddBookingModal;
