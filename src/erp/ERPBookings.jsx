import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CalendarPlus, Trash2, Search, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import '../admin/AdminLayout.css';

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
    <div className="admin-section">
      <div className="admin-header">
        <div>
          <h2>إدارة المواعيد والحجوزات</h2>
          <p>متابعة جداول التصوير وإضافة المواعيد للعملاء.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <CalendarPlus size={18} /> حجز موعد جديد
        </button>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c' }} />
            <input 
              type="text" 
              placeholder="ابحث عن موعد باسم العميل أو الخدمة..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-input"
              style={{ paddingRight: '45px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8c8c8c' }}>جاري تحميل الحجوزات...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '15px', textAlign: 'right' }}>التاريخ</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>العميل</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>الخدمة/الباقة</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>التوقيت</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>الساعات</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>الحالة</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map(booking => (
                  <tr key={booking.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 'bold' }}>{booking.date ? format(new Date(booking.date), 'dd MMMM yyyy', { locale: ar }) : '-'}</div>
                      <div style={{ fontSize: '0.85rem', color: '#8c8c8c' }}>{booking.date ? format(new Date(booking.date), 'EEEE', { locale: ar }) : ''}</div>
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: 'var(--color-vibrant-purple)' }}>{booking.client_name}</td>
                    <td style={{ padding: '15px', color: '#c0c0c0' }}>{booking.service}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }} dir="ltr">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <Clock size={14} color="#8c8c8c" />
                        {booking.start_time} - {booking.end_time}
                      </div>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {booking.actual_hours > 0 ? <span style={{ background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>{booking.actual_hours} س</span> : '-'}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <span style={{ 
                        background: `${getStatusColor(booking.status)}22`, 
                        color: getStatusColor(booking.status), 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem',
                        border: `1px solid ${getStatusColor(booking.status)}55`
                      }}>
                        {booking.status || 'مؤكد'}
                      </span>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button onClick={() => deleteBooking(booking.id)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }} title="إلغاء الموعد">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#8c8c8c' }}>لا يوجد مواعيد متاحة.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add Booking */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="admin-card" style={{ width: '90%', maxWidth: '500px', background: 'var(--bg-dark)' }}>
            <h3 style={{ marginBottom: '20px' }}>حجز موعد جديد</h3>
            <form onSubmit={handleSaveBooking} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>العميل</label>
                <select className="admin-input" value={newBooking.client_name} onChange={e => setNewBooking({...newBooking, client_name: e.target.value})} required>
                  <option value="">-- اختر العميل --</option>
                  {clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>الخدمة / الباقة</label>
                <select className="admin-input" value={newBooking.service} onChange={e => setNewBooking({...newBooking, service: e.target.value})} required>
                  <option value="">-- اختر الخدمة أو الباقة --</option>
                  <option value="باقة 50 ساعة">باقة 50 ساعة</option>
                  <option value="تصوير حر (بالساعة)">تصوير حر (بالساعة)</option>
                  {services.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>التاريخ</label>
                <input type="date" className="admin-input" value={newBooking.date} onChange={e => setNewBooking({...newBooking, date: e.target.value})} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>وقت البدء</label>
                  <input type="time" className="admin-input" value={newBooking.start_time} onChange={e => setNewBooking({...newBooking, start_time: e.target.value})} required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>وقت الانتهاء</label>
                  <input type="time" className="admin-input" value={newBooking.end_time} onChange={e => setNewBooking({...newBooking, end_time: e.target.value})} required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>ملاحظات</label>
                <input type="text" className="admin-input" value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} placeholder="أي متطلبات خاصة للتصوير..." />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>حفظ الموعد</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary" style={{ flex: 1 }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ERPBookings;
