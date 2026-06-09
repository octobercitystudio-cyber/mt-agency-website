import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CalendarPlus, Trash2, Clock, Calendar as CalendarIcon, DollarSign, X, CheckCircle, ShieldAlert, Truck, Pointer } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';

// FullCalendar Imports
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';

let globalBookingsCache = null;
let globalClientsCache = null;
let globalServicesCache = null;
let globalBookingsLastFetch = 0;

const ERPBookings = () => {
  const location = useLocation();
  const [bookings, setBookings] = useState(globalBookingsCache || []);
  const [clients, setClients] = useState(globalClientsCache || []);
  const [services, setServices] = useState(globalServicesCache || []);
  const [loading, setLoading] = useState(!globalBookingsCache);
  
  // UI State
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (location.state?.openAddModalFor && clients.length > 0 && services.length > 0) {
      setNewBooking(prev => ({ ...prev, client_name: location.state.openAddModalFor }));
      setIsModalOpen(true);
      // Clean up state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, clients, services]);

  const isAdmin = localStorage.getItem('erp_role') === 'مدير';
  const [newBooking, setNewBooking] = useState({
    client_name: '',
    color: 'var(--erp-primary)',
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
    fetchData();
  }, []);

  const fetchData = async (force = false) => {
    if (globalBookingsCache && globalClientsCache && globalServicesCache) {
      setBookings(globalBookingsCache);
      setClients(globalClientsCache);
      setServices(globalServicesCache);
      setLoading(false);
      if (!force && (Date.now() - globalBookingsLastFetch < 30000)) return;
    } else {
      setLoading(true);
    }
    
    const { data: bData } = await supabase.from('bookings').select('*').order('date', { ascending: false });
    const { data: cData } = await supabase.from('clients').select('name, color');
    const { data: sData } = await supabase.from('services').select('*');

    if (bData) {
      setBookings(bData);
      globalBookingsCache = bData;
    }
    if (cData) {
      setClients(cData);
      globalClientsCache = cData;
    }
    if (sData) {
      setServices(sData);
      globalServicesCache = sData;
    }
    
    globalBookingsLastFetch = Date.now();
    setLoading(false);
  };

  const getClientColor = (clientName) => {
    const client = clients.find(c => c.name === clientName);
    return client?.color || 'var(--erp-primary)';
  };

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
    const fullBooking = bookings.find(b => b.id === bId);
    if (fullBooking) {
      setSelectedBookingDetails(fullBooking);
      const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById('bookingDetailsModal'));
      modal.show();
    } else {
      alert('لم يتم العثور على تفاصيل الحجز، برجاء تحديث الصفحة.');
    }
  };

  const handleCompleteBooking = async () => {
    if (!selectedBookingDetails) return;
    if (window.confirm('تأكيد إتمام الموعد؟ سيتم تغيير الحالة إلى "منتهي".')) {
      const { error } = await supabase.from('bookings').update({ status: 'منتهي' }).eq('id', selectedBookingDetails.id);
      if (!error) {
        fetchData();
        window.bootstrap.Modal.getInstance(document.getElementById('bookingDetailsModal'))?.hide();
      }
    }
  };

  const deleteBooking = async (id) => {
    if (window.confirm('بصفتك المالك (مدير النظام)، هل تريد حذف هذا الموعد نهائياً من التقويم والسجلات؟')) {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (!error) {
        fetchData();
        window.bootstrap.Modal.getInstance(document.getElementById('bookingDetailsModal'))?.hide();
      }
    }
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
    
    // Validation: Cannot book a new photography service if they already have an active one
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
          payment: newBooking.paid // Apply full payment to first record for simplicity, or divide it
        };
      });
      // only apply payment to first record so it isn't duplicated
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
      fetchData();
      setIsModalOpen(false);
      setNewBooking({
        client_name: '', color: 'var(--erp-primary)', category: '', service: '', dates: [],
        delivery_date: '', base_price: 0, discount: 0, discount_reason: '', paid: 0, payment_method: 'فودافون كاش', notes: '', schedule_extra: false
      });
    } else {
      console.error(error);
      alert('حدث خطأ أثناء حفظ المواعيد');
    }
  };

  const remainingPrice = Math.max(0, newBooking.base_price - newBooking.discount - newBooking.paid);
  const showDelivery = newBooking.category === 'باقة ريلز' || newBooking.category === 'خدمة إضافية';
  const showCalendar = !showDelivery || newBooking.schedule_extra;

  return (
    <div>
      <style>{`
        .fc-theme-standard td, .fc-theme-standard th { border-color: var(--erp-border); }
        .fc-theme-standard .fc-scrollgrid { border: none; }
        .fc-col-header-cell { background-color: var(--erp-bg); padding: 10px 0; border-bottom: 2px solid var(--erp-border) !important; }
        .fc-col-header-cell-cushion { color: var(--erp-text-muted); font-weight: 700; font-size: 0.9rem; text-decoration: none; }
        .fc-daygrid-day-number { color: var(--erp-text-main); font-weight: 700; padding: 8px !important; text-decoration: none; transition: 0.2s; }
        .fc-daygrid-day-number:hover { background-color: var(--erp-border); border-radius: 50%; }
        .fc .fc-daygrid-day.fc-day-today { background-color: rgba(67, 24, 255, 0.05); }
        
        .selected-day-highlight { background-color: rgba(67, 24, 255, 0.1) !important; border: 2px solid var(--erp-primary) !important; border-radius: 8px; transition: all 0.2s ease-in-out; box-shadow: inset 0 0 10px rgba(67, 24, 255, 0.05); }
        .selected-day-highlight .fc-daygrid-day-number { color: var(--erp-primary) !important; }

        td.fc-day-fri { background-color: rgba(0,0,0,0.03) !important; border-color: var(--erp-border) !important; }
        th.fc-day-fri { background-color: rgba(0,0,0,0.05) !important; border-color: var(--erp-border) !important; }
        th.fc-day-fri .fc-col-header-cell-cushion { color: var(--erp-warning) !important; } 
        td.fc-day-fri .fc-daygrid-day-number { color: var(--erp-text-muted) !important; }
        td.fc-day-fri:hover { background-color: rgba(0,0,0,0.06) !important; }
        td.fc-day-fri .fc-daygrid-day-frame::before { content: "إجازة رسمية"; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 1.4rem; font-weight: 900; color: rgba(0,0,0, 0.05); pointer-events: none; z-index: 0; white-space: nowrap; }
        
        .fc-daygrid-day-events { position: relative; z-index: 1; }
        .fc-event { border: none !important; border-radius: 6px !important; padding: 4px 6px; margin-bottom: 4px; font-size: 0.8rem; font-weight: 800; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .fc-event:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); filter: brightness(1.1); }
        .fc-h-event .fc-event-main { color: white; }
        
        .fc-toolbar-title { font-weight: 800 !important; color: var(--erp-text-main) !important; font-size: 1.5rem !important; }
        .fc .fc-button-primary { background-color: var(--erp-surface); border: 1px solid var(--erp-border); color: var(--erp-text-muted); font-weight: 700; border-radius: 8px; text-transform: capitalize; transition: 0.2s; }
        .fc .fc-button-primary:hover { background-color: var(--erp-bg); border-color: var(--erp-text-muted); color: var(--erp-text-main); }
        .fc .fc-button-primary:not(:disabled).fc-button-active, .fc .fc-button-primary:not(:disabled):active { background-color: var(--erp-primary); border-color: var(--erp-primary); color: white; }
        
        .timeline-card { transition: all 0.3s ease; border-right: 4px solid var(--erp-primary); background: var(--erp-surface); }
        .timeline-card:hover { transform: translateX(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.05) !important; border-right-color: var(--erp-warning); }
        .timeline-time { font-size: 1.1rem; font-weight: 800; color: var(--erp-primary); letter-spacing: -0.5px; }
        .timeline-client { font-size: 1.1rem; font-weight: 800; color: var(--erp-text-main); }
        .timeline-service { font-size: 0.8rem; font-weight: 700; color: var(--erp-text-muted); background: var(--erp-bg); padding: 4px 10px; border-radius: 20px; display: inline-block; }

        .admin-delete-btn { cursor: pointer; opacity: 0.5; transition: 0.3s; color: var(--erp-danger); }
        .admin-delete-btn:hover { opacity: 1; transform: scale(1.2); color: var(--erp-danger) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', margin: 0, display: 'flex', alignItems: 'center' }}>
            <CalendarIcon style={{ marginRight: '10px', color: 'var(--erp-primary)' }} /> إدارة المواعيد والتقويم
          </h3>
          <p style={{ color: 'var(--erp-text-muted)', fontSize: '0.9rem', margin: '5px 0 0 0' }}>
            اضغط مرتين للحجز.
            {isAdmin && <span style={{ color: 'var(--erp-danger)', fontWeight: 'bold', marginRight: '5px' }}>
              <ShieldAlert size={14} style={{ display: 'inline', marginLeft: '3px' }} /> بصفتك مدير: يمكنك حجز تواريخ سابقة، أو حذف أي موعد.
            </span>}
          </p>
        </div>
        <button 
          style={{ background: 'var(--erp-primary)', color: 'white', border: 'none', borderRadius: '50px', padding: '10px 25px', fontWeight: 'bold', display: 'flex', alignItems: 'center', boxShadow: '0 4px 10px rgba(67, 24, 255, 0.2)', cursor: 'pointer' }}
          onClick={() => setIsModalOpen(true)}
        >
          <CalendarPlus size={18} style={{ marginLeft: '8px' }} /> حجز موعد / إضافة خدمة
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        
        {/* FullCalendar Box */}
        <div style={{ flex: '1 1 65%', minWidth: '400px' }}>
          <div style={{ background: 'var(--erp-surface)', borderRadius: '20px', padding: '25px', boxShadow: 'var(--erp-shadow)', borderTop: '4px solid var(--erp-primary)', minHeight: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              <span style={{ color: 'var(--erp-primary)' }}>● مجدول</span>
              <span style={{ color: 'var(--erp-success)' }}>● منتهي</span>
              <span style={{ color: 'var(--erp-text-muted)' }}>● يوم الجمعة (إجازة)</span>
            </div>
            
            <FullCalendar
              plugins={[ dayGridPlugin, interactionPlugin, timeGridPlugin ]}
              initialView="dayGridMonth"
              locale={ar}
              direction="rtl"
              firstDay={6}
              events={calendarEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              height="auto"
              headerToolbar={{
                right: 'dayGridMonth,timeGridWeek',
                center: 'title',
                left: 'prev,next today'
              }}
              dayCellClassNames={(arg) => {
                let classes = [];
                if (arg.date.getDay() === 5) classes.push('fc-day-fri');
                if (format(arg.date, 'yyyy-MM-dd') === selectedDate) classes.push('selected-day-highlight');
                return classes;
              }}
            />
          </div>
        </div>

        {/* Daily Bookings Sidebar */}
        <div style={{ flex: '1 1 30%', minWidth: '300px' }}>
          <div style={{ background: 'var(--erp-surface)', borderRadius: '20px', display: 'flex', flexDirection: 'column', boxShadow: 'var(--erp-shadow)', borderTop: '4px solid var(--erp-surface)', height: '100%' }}>
            
            <div style={{ padding: '25px 25px 0 25px', textAlign: 'center' }}>
              <div style={{ background: 'rgba(67, 24, 255, 0.1)', color: 'var(--erp-primary)', display: 'inline-block', borderRadius: '50px', padding: '8px 25px', marginBottom: '15px', boxShadow: '0 2px 5px rgba(67,24,255,0.05)' }}>
                <i className="fas fa-calendar-day me-1"></i> جدول يوم: <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: ar })}</span>
              </div>
              <h5 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', margin: 0 }}>قائمة جلسات التصوير</h5>
              <hr style={{ opacity: 0.1, marginTop: '20px', marginBottom: 0 }} />
            </div>

            <div style={{ padding: '25px', overflowY: 'auto', flexGrow: 1, maxHeight: '600px' }}>
              {dailyBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ background: 'var(--erp-bg)', borderRadius: '50%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '80px', height: '80px', marginBottom: '15px' }}>
                    <Clock size={32} color="var(--erp-text-muted)" style={{ opacity: 0.5 }} />
                  </div>
                  <h6 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)' }}>يوم هادئ!</h6>
                  <p style={{ color: 'var(--erp-text-muted)', fontSize: '0.85rem' }}>لا توجد جلسات تصوير مجدولة.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {dailyBookings.map(b => (
                    <div key={b.id} className="timeline-card" style={{ padding: '15px', borderRadius: '12px', borderRightColor: getClientColor(b.client_name), opacity: b.status === 'منتهي' ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div className="timeline-time" style={{ color: getClientColor(b.client_name), fontFamily: 'monospace' }}>
                          <Clock size={14} style={{ display: 'inline', marginLeft: '5px' }} />
                          {b.start_time}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {b.status === 'منتهي' ? (
                            <span style={{ background: 'var(--erp-success)', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>منتهي</span>
                          ) : (
                            <span style={{ background: 'var(--erp-primary)', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>مجدول</span>
                          )}
                          {isAdmin && (
                            <Trash2 size={16} className="admin-delete-btn" onClick={() => handleEventClick({ event: { extendedProps: { booking_id: b.id, time: `${b.start_time}`, status: b.status }, title: b.client_name } })} />
                          )}
                        </div>
                      </div>
                      <h5 className="timeline-client" style={{ marginBottom: '10px', marginTop: 0 }}>{b.client_name}</h5>
                      <span className="timeline-service">{b.service}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Complex Booking Modal */}
      {isModalOpen && (
        <div className="erp-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'var(--erp-surface)', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '25px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: 'none' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ background: 'var(--erp-surface)', color: 'white', padding: '25px', borderTopLeftRadius: '25px', borderTopRightRadius: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h5 style={{ margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                <CalendarPlus color="var(--erp-warning)" size={24} style={{ marginLeft: '10px' }} /> تسجيل موعد أو شراء خدمة
              </h5>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>

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
                      direction="rtl"
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

              <button type="submit" style={{ width: '100%', background: 'var(--erp-surface)', color: 'white', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.2s' }}>
                اعتماد وتسجيل في النظام <CheckCircle size={20} style={{ marginRight: '10px' }} />
              </button>

            </form>
          </div>
        </div>
      )}

      {/* BOOKING DETAILS MODAL */}
      <div className="modal fade" id="bookingDetailsModal" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg rounded-5">
            {selectedBookingDetails && (
              <>
                <div className="modal-header bg-dark text-white border-0 p-4">
                  <h5 className="fw-bold m-0"><i className="fas fa-calendar-check me-2 text-warning"></i> تفاصيل الحجز</h5>
                  <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div className="modal-body p-4  text-end" style={{ direction: 'rtl' }}>
                  
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-primary m-0">{selectedBookingDetails.client_name}</h4>
                    <span className={`badge ${selectedBookingDetails.status === 'منتهي' ? 'bg-success' : 'bg-warning text-dark'} rounded-pill px-3 py-2 fs-6`}>
                      {selectedBookingDetails.status}
                    </span>
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-6">
                      <div className="p-3  rounded-4 border shadow-sm h-100">
                        <small className="text-muted d-block mb-1 fw-bold">الخدمة / الباقة</small>
                        <div className="fw-bold text-dark">{selectedBookingDetails.service}</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-3  rounded-4 border shadow-sm h-100">
                        <small className="text-muted d-block mb-1 fw-bold">التاريخ</small>
                        <div className="fw-bold text-dark" style={{direction: 'ltr'}}>{selectedBookingDetails.date}</div>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="p-3  rounded-4 border shadow-sm">
                        <small className="text-muted d-block mb-1 fw-bold">التوقيت</small>
                        <div className="fw-bold text-dark d-flex align-items-center gap-2">
                          <span className="text-primary">{selectedBookingDetails.start_time}</span> 
                          <i className="fas fa-arrow-left text-muted"></i> 
                          <span className="text-danger">{selectedBookingDetails.end_time}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3  rounded-4 border shadow-sm mb-4">
                    <div className="row text-center">
                      <div className="col-4 border-end">
                        <small className="text-muted d-block mb-1 fw-bold">الساعات</small>
                        <div className="fw-bold fs-5">{selectedBookingDetails.actual_hours || 0}</div>
                      </div>
                      <div className="col-4 border-end">
                        <small className="text-muted d-block mb-1 fw-bold">الريلز</small>
                        <div className="fw-bold fs-5">{selectedBookingDetails.actual_reels || 0}</div>
                      </div>
                      <div className="col-4">
                        <small className="text-muted d-block mb-1 fw-bold">الدفعة</small>
                        <div className="fw-bold fs-5 text-success">{selectedBookingDetails.payment || 0}ج</div>
                      </div>
                    </div>
                  </div>

                  {selectedBookingDetails.notes && (
                    <div className="p-3 bg-warning-subtle rounded-4 border border-warning mb-4">
                      <small className="text-warning-emphasis d-block mb-1 fw-bold"><i className="fas fa-sticky-note me-1"></i> ملاحظات</small>
                      <div className="fw-bold text-dark">{selectedBookingDetails.notes}</div>
                    </div>
                  )}

                  <div className="d-flex gap-2 mt-4">
                    {selectedBookingDetails.status !== 'منتهي' && (
                      <button className="btn btn-success flex-grow-1 py-3 rounded-4 fw-bold" onClick={handleCompleteBooking}>
                        <i className="fas fa-check-circle me-1"></i> إتمام الموعد (تصوير)
                      </button>
                    )}
                    {isAdmin && (
                      <button className="btn btn-outline-danger py-3 rounded-4 fw-bold px-4" onClick={() => deleteBooking(selectedBookingDetails.id)}>
                        <i className="fas fa-trash-alt me-1"></i> حذف الموعد
                      </button>
                    )}
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default ERPBookings;
