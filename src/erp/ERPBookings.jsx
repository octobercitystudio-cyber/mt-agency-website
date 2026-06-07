import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CalendarPlus, Trash2, Search, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
// CSS is handled in ERPLayout.css

const ERPBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBooking, setNewBooking] = useState({
    client_name: '',
    service: '',
    date: '',
    start_time: '',
    end_time: '',
    actual_hours: 0,
    status: 'مؤكد',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Bookings
    const { data: bData } = await supabase
      .from('bookings')
      .select('*')
      .order('date', { ascending: false });
    
    // Fetch Clients
    const { data: cData } = await supabase
      .from('clients')
      .select('name');
      
    // Fetch Services
    const { data: sData } = await supabase
      .from('services')
      .select('name');

    if (bData) setBookings(bData);
    if (cData) setClients(cData);
    if (sData) setServices(sData);
    
    setLoading(false);
  };

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    
    // Calculate actual hours
    let hours = 0;
    if (newBooking.start_time && newBooking.end_time) {
      const [startH, startM] = newBooking.start_time.split(':').map(Number);
      const [endH, endM] = newBooking.end_time.split(':').map(Number);
      const diffInMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      hours = diffInMinutes > 0 ? +(diffInMinutes / 60).toFixed(2) : 0;
    }

    const bookingToInsert = {
      ...newBooking,
      actual_hours: hours
    };

    const { error } = await supabase
      .from('bookings')
      .insert([bookingToInsert]);

    if (!error) {
      fetchData();
      setIsModalOpen(false);
      setNewBooking({ client_name: '', service: '', date: '', start_time: '', end_time: '', actual_hours: 0, status: 'مؤكد', notes: '' });
    } else {
      console.error(error);
      alert('حدث خطأ أثناء حفظ الموعد');
    }
  };

  const deleteBooking = async (id) => {
    if (window.confirm('هل أنت متأكد من إلغاء وحذف هذا الموعد؟')) {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (!error) fetchData();
    }
  };

  const filteredBookings = bookings.filter(b => 
    b.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.service?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    if (status === 'مؤكد') return '#3498db';
    if (status === 'ملغي') return '#e74c3c';
    if (status === 'منتهي') return '#2ecc71';
    return '#8c8c8c';
  };

  return (
    <div>
      <div className="erp-header">
        <div>
          <h2>إدارة المواعيد والحجوزات</h2>
          <p>متابعة جداول التصوير وإضافة المواعيد للعملاء.</p>
        </div>
        <button className="erp-btn-primary" onClick={() => setIsModalOpen(true)}>
          <CalendarPlus size={18} /> حجز موعد جديد
        </button>
      </div>

      <div className="erp-card">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--erp-text-muted)' }} />
            <input 
              type="text" 
              placeholder="ابحث عن موعد باسم العميل أو الخدمة..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="erp-input"
              style={{ paddingRight: '45px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--erp-text-muted)' }}>جاري تحميل الحجوزات...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'right' }}>التاريخ</th>
                  <th style={{ textAlign: 'right' }}>العميل</th>
                  <th style={{ textAlign: 'right' }}>الخدمة/الباقة</th>
                  <th style={{ textAlign: 'center' }}>التوقيت</th>
                  <th style={{ textAlign: 'center' }}>الساعات</th>
                  <th style={{ textAlign: 'center' }}>الحالة</th>
                  <th style={{ textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map(booking => (
                  <tr key={booking.id}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{booking.date ? format(new Date(booking.date), 'dd MMMM yyyy', { locale: ar }) : '-'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)' }}>{booking.date ? format(new Date(booking.date), 'EEEE', { locale: ar }) : ''}</div>
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--erp-primary)' }}>{booking.client_name}</td>
                    <td style={{ color: 'var(--erp-text-muted)' }}>{booking.service}</td>
                    <td style={{ textAlign: 'center' }} dir="ltr">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <Clock size={14} color="var(--erp-text-muted)" />
                        {booking.start_time} - {booking.end_time}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {booking.actual_hours > 0 ? <span style={{ background: 'rgba(52, 152, 219, 0.1)', color: '#3498db', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>{booking.actual_hours} س</span> : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ 
                        background: `${getStatusColor(booking.status)}11`, 
                        color: getStatusColor(booking.status), 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        border: `1px solid ${getStatusColor(booking.status)}33`
                      }}>
                        {booking.status || 'مؤكد'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => deleteBooking(booking.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="إلغاء الموعد">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--erp-text-muted)' }}>لا يوجد مواعيد متاحة.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add Booking */}
      {isModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()}>
            <h3>حجز موعد جديد</h3>
            <form onSubmit={handleSaveBooking} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="erp-label">العميل</label>
                <select className="erp-input" value={newBooking.client_name} onChange={e => setNewBooking({...newBooking, client_name: e.target.value})} required>
                  <option value="">-- اختر العميل --</option>
                  {clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="erp-label">الخدمة / الباقة</label>
                <select className="erp-input" value={newBooking.service} onChange={e => setNewBooking({...newBooking, service: e.target.value})} required>
                  <option value="">-- اختر الخدمة أو الباقة --</option>
                  <option value="باقة 50 ساعة">باقة 50 ساعة</option>
                  <option value="تصوير حر (بالساعة)">تصوير حر (بالساعة)</option>
                  {services.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="erp-label">التاريخ</label>
                <input type="date" className="erp-input" value={newBooking.date} onChange={e => setNewBooking({...newBooking, date: e.target.value})} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label className="erp-label">وقت البدء</label>
                  <input type="time" className="erp-input" value={newBooking.start_time} onChange={e => setNewBooking({...newBooking, start_time: e.target.value})} required />
                </div>
                <div>
                  <label className="erp-label">وقت الانتهاء</label>
                  <input type="time" className="erp-input" value={newBooking.end_time} onChange={e => setNewBooking({...newBooking, end_time: e.target.value})} required />
                </div>
              </div>

              <div>
                <label className="erp-label">ملاحظات</label>
                <input type="text" className="erp-input" value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} placeholder="أي متطلبات خاصة للتصوير..." />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="erp-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>حفظ الموعد</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="erp-btn-danger" style={{ flex: 1, justifyContent: 'center' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ERPBookings;
