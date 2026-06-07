import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CalendarPlus, Trash2, Search, CheckCircle, Clock, Calendar as CalendarIcon, DollarSign, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

// FullCalendar Imports
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

const ERPBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal Form State
  const [newBooking, setNewBooking] = useState({
    client_name: '',
    color: '#9d4edd',
    category: '',
    service: '',
    dates: [{ date: format(new Date(), 'yyyy-MM-dd'), start_time: '12:00', end_time: '13:00' }],
    delivery_date: '',
    base_price: 0,
    discount: 0,
    discount_reason: '',
    paid: 0,
    payment_method: 'كاش',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: bData } = await supabase.from('bookings').select('*').order('date', { ascending: false });
    const { data: cData } = await supabase.from('clients').select('name, color');
    const { data: sData } = await supabase.from('services').select('*');

    if (bData) setBookings(bData);
    if (cData) setClients(cData);
    if (sData) setServices(sData);
    
    setLoading(false);
  };

  const getClientColor = (clientName) => {
    const client = clients.find(c => c.name === clientName);
    return client?.color || 'var(--erp-primary)';
  };

  // Convert DB bookings to FullCalendar events
  const calendarEvents = bookings.map(b => ({
    id: b.id,
    title: b.client_name,
    start: b.date,
    color: getClientColor(b.client_name),
    extendedProps: {
      booking_id: b.id,
      time: `${b.start_time} - ${b.end_time}`,
      status: b.status || 'مؤكد',
      service: b.service
    }
  }));

  const dailyBookings = bookings.filter(b => b.date === selectedDate);

  const handleDateClick = (arg) => {
    setSelectedDate(arg.dateStr);
  };

  const handleEventClick = (info) => {
    const bId = info.event.extendedProps.booking_id;
    const client = info.event.title;
    if (window.confirm(`هل أنت متأكد من إلغاء موعد العميل: ${client}؟`)) {
      deleteBooking(bId);
    }
  };

  const deleteBooking = async (id) => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (!error) fetchData();
  };

  const addDateRow = () => {
    setNewBooking({
      ...newBooking,
      dates: [...newBooking.dates, { date: format(new Date(), 'yyyy-MM-dd'), start_time: '12:00', end_time: '13:00' }]
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

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    
    // Validate
    if (newBooking.dates.length === 0) {
      alert('يجب تحديد موعد واحد على الأقل');
      return;
    }

    // Insert Finance Record if payment > 0
    if (newBooking.paid > 0) {
      await supabase.from('finance').insert([{
        type: 'وارد',
        amount: newBooking.paid,
        method: newBooking.payment_method,
        detail: `دفعة من ${newBooking.client_name} لخدمة ${newBooking.service}`,
        date: format(new Date(), 'yyyy-MM-dd'),
        entity: 'الشركة'
      }]);
    }

    // Insert Bookings (one for each date row)
    const bookingsToInsert = newBooking.dates.map(d => {
      // Calculate actual hours
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
        notes: newBooking.notes
      };
    });

    const { error } = await supabase.from('bookings').insert(bookingsToInsert);

    if (!error) {
      fetchData();
      setIsModalOpen(false);
      // Reset
      setNewBooking({
        client_name: '', color: '#9d4edd', category: '', service: '',
        dates: [{ date: format(new Date(), 'yyyy-MM-dd'), start_time: '12:00', end_time: '13:00' }],
        delivery_date: '', base_price: 0, discount: 0, discount_reason: '', paid: 0, payment_method: 'كاش', notes: ''
      });
    } else {
      console.error(error);
      alert('حدث خطأ أثناء حفظ المواعيد');
    }
  };

  // Finance calculations
  const remainingPrice = Math.max(0, newBooking.base_price - newBooking.discount - newBooking.paid);

  return (
    <div>
      <div className="erp-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarIcon color="var(--erp-primary)" /> إدارة المواعيد والتقويم
          </h2>
          <p>اضغط على أي يوم في التقويم لاستعراض جلساته، أو اضغط مرتين لإضافة حجز.</p>
        </div>
        <button className="erp-btn-primary" onClick={() => setIsModalOpen(true)}>
          <CalendarPlus size={18} /> حجز موعد / إضافة خدمة
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '20px', minHeight: '600px' }}>
        
        {/* FullCalendar Container */}
        <div className="erp-card" style={{ padding: '20px' }}>
          <style>{`
            .fc-theme-standard td, .fc-theme-standard th { border-color: var(--erp-border); }
            .fc-col-header-cell { background-color: rgba(255,255,255,0.05); padding: 10px 0; border-bottom: 2px solid var(--erp-border) !important; }
            .fc-col-header-cell-cushion { color: var(--erp-text-muted); font-weight: 700; text-decoration: none; }
            .fc-daygrid-day-number { color: var(--erp-text-main); font-weight: bold; text-decoration: none; }
            .fc .fc-daygrid-day.fc-day-today { background-color: rgba(157, 78, 221, 0.1); }
            .fc-daygrid-day:hover { background-color: rgba(255,255,255,0.02); cursor: pointer; }
            .fc-event { border: none !important; border-radius: 6px !important; padding: 4px; margin-bottom: 4px; font-weight: bold; cursor: pointer; }
            .fc-toolbar-title { color: var(--erp-text-main); font-weight: bold; }
            .fc-button-primary { background-color: rgba(255,255,255,0.1) !important; border-color: var(--erp-border) !important; color: white !important; }
            .fc-button-active { background-color: var(--erp-primary) !important; border-color: var(--erp-primary) !important; }
          `}</style>
          
          <FullCalendar
            plugins={[ dayGridPlugin, interactionPlugin ]}
            initialView="dayGridMonth"
            locale={ar}
            events={calendarEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="auto"
            headerToolbar={{
              right: 'dayGridMonth',
              center: 'title',
              left: 'prev,next today'
            }}
          />
        </div>

        {/* Daily Bookings Sidebar */}
        <div className="erp-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--erp-border)' }}>
            <div style={{ background: 'rgba(157, 78, 221, 0.1)', color: 'var(--erp-primary)', padding: '8px 20px', borderRadius: '50px', display: 'inline-block', fontWeight: 'bold', marginBottom: '15px' }}>
              جدول يوم: {format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: ar })}
            </div>
            <h4 style={{ margin: 0, fontWeight: 'bold' }}>قائمة جلسات التصوير</h4>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {dailyBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                <Clock size={48} style={{ marginBottom: '15px', color: 'var(--erp-text-muted)' }} />
                <h5>يوم هادئ!</h5>
                <p>لا توجد جلسات تصوير مجدولة.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {dailyBookings.map(b => (
                  <div key={b.id} style={{ borderRight: `4px solid ${getClientColor(b.client_name)}`, background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ color: getClientColor(b.client_name), fontWeight: 'bold', fontFamily: 'monospace' }}>
                        <Clock size={14} style={{ display: 'inline', marginRight: '5px' }} />
                        {b.start_time} - {b.end_time}
                      </span>
                      <span style={{ background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', padding: '2px 8px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {b.status || 'مؤكد'}
                      </span>
                    </div>
                    <h5 style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>{b.client_name}</h5>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                      {b.service}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Complex Booking Modal */}
      {isModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="erp-modal-content" style={{ width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid var(--erp-border)' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarPlus color="var(--erp-primary)" /> تسجيل حجز جديد
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
            </div>

            <form onSubmit={handleSaveBooking} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="erp-label">اسم العميل</label>
                  <select className="erp-input" value={newBooking.client_name} onChange={handleClientChange} required>
                    <option value="">-- اختر العميل --</option>
                    {clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="erp-label">التصنيف الرئيسي</label>
                  <select className="erp-input" value={newBooking.category} onChange={handleCategoryChange} required>
                    <option value="">-- التصنيف --</option>
                    <option value="تصوير بالساعة">تصوير بالساعة</option>
                    <option value="باقة يومية">باقات يومية</option>
                    <option value="باقة شهرية">باقات شهرية</option>
                    <option value="باقة ريلز">باقات ريلز</option>
                    <option value="خدمة إضافية">خدمات إضافية</option>
                  </select>
                </div>

                <div>
                  <label className="erp-label">اسم الخدمة</label>
                  <select className="erp-input" value={newBooking.service} onChange={handleServiceChange} required disabled={!newBooking.category}>
                    <option value="">-- اختر الخدمة --</option>
                    {services.filter(s => s.category === newBooking.category).map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(newBooking.category === 'باقة ريلز' || newBooking.category === 'خدمة إضافية') && (
                <div style={{ background: 'rgba(241, 196, 15, 0.1)', border: '1px solid rgba(241, 196, 15, 0.3)', padding: '15px', borderRadius: '12px' }}>
                  <label className="erp-label" style={{ color: '#f1c40f' }}>موعد التسليم المتفق عليه</label>
                  <input type="date" className="erp-input" style={{ borderColor: '#f1c40f' }} value={newBooking.delivery_date} onChange={e => setNewBooking({...newBooking, delivery_date: e.target.value})} required />
                </div>
              )}

              {/* Dynamic Dates Container */}
              <div style={{ border: '1px solid var(--erp-border)', padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <label className="erp-label" style={{ margin: 0 }}>مواعيد الجلسات (يمكن إضافة أكثر من يوم)</label>
                  <button type="button" onClick={addDateRow} style={{ background: 'rgba(157, 78, 221, 0.2)', color: 'var(--erp-primary)', border: 'none', padding: '5px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
                    + إضافة يوم جديد
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {newBooking.dates.map((dRow, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="erp-label" style={{ fontSize: '0.8rem' }}>التاريخ</label>
                        <input type="date" className="erp-input" value={dRow.date} onChange={(e) => updateDateRow(idx, 'date', e.target.value)} required />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="erp-label" style={{ fontSize: '0.8rem' }}>من الساعة</label>
                        <input type="time" className="erp-input" value={dRow.start_time} onChange={(e) => updateDateRow(idx, 'start_time', e.target.value)} required />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="erp-label" style={{ fontSize: '0.8rem' }}>إلى الساعة</label>
                        <input type="time" className="erp-input" value={dRow.end_time} onChange={(e) => updateDateRow(idx, 'end_time', e.target.value)} required />
                      </div>
                      {newBooking.dates.length > 1 && (
                        <button type="button" onClick={() => removeDateRow(idx)} style={{ background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', border: 'none', width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer' }}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Finance Box */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--erp-border)', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <DollarSign color="#2ecc71" /> تفاصيل الحساب والدفع
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label className="erp-label" style={{ fontSize: '0.8rem' }}>السعر الأساسي</label>
                    <input type="number" className="erp-input" value={newBooking.base_price} readOnly style={{ opacity: 0.7 }} />
                  </div>
                  <div>
                    <label className="erp-label" style={{ fontSize: '0.8rem', color: '#e74c3c' }}>الخصم</label>
                    <input type="number" className="erp-input" value={newBooking.discount} onChange={e => setNewBooking({...newBooking, discount: Number(e.target.value)})} min="0" style={{ borderColor: 'rgba(231, 76, 60, 0.5)' }} />
                  </div>
                  <div>
                    <label className="erp-label" style={{ fontSize: '0.8rem', color: '#2ecc71' }}>المدفوع الآن</label>
                    <input type="number" className="erp-input" value={newBooking.paid} onChange={e => setNewBooking({...newBooking, paid: Number(e.target.value)})} min="0" style={{ borderColor: 'rgba(46, 204, 113, 0.5)' }} />
                  </div>
                  <div>
                    <label className="erp-label" style={{ fontSize: '0.8rem', color: 'var(--erp-primary)' }}>المتبقي</label>
                    <input type="number" className="erp-input" value={remainingPrice} readOnly style={{ fontWeight: 'bold' }} />
                  </div>
                </div>

                <input type="text" className="erp-input" value={newBooking.discount_reason} onChange={e => setNewBooking({...newBooking, discount_reason: e.target.value})} placeholder="سبب الخصم (إن وجد)..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="erp-label">طريقة الدفع (للخزينة)</label>
                  <select className="erp-input" value={newBooking.payment_method} onChange={e => setNewBooking({...newBooking, payment_method: e.target.value})}>
                    <option value="كاش">كاش</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="انستاباي">إنستاباي</option>
                  </select>
                </div>
                <div>
                  <label className="erp-label">ملاحظات إضافية</label>
                  <input type="text" className="erp-input" value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} placeholder="اكتب أي تفاصيل هنا..." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                <button type="submit" className="erp-btn-primary" style={{ flex: 1, padding: '15px', fontSize: '1.1rem' }}>
                  تسجيل الحجز في النظام
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ERPBookings;
