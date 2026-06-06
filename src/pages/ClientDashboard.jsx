import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './ClientDashboard.css';

const ClientDashboard = () => {
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Find client by phone1 or phone2
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .or(`phone1.eq.${phone},phone2.eq.${phone}`)
        .single();

      if (clientError || !clientData) {
        setError('رقم الهاتف غير مسجل لدينا. يرجى التأكد من الرقم.');
        setLoading(false);
        return;
      }

      setClient(clientData);

      // Fetch bookings for this client
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('client_name', clientData.name)
        .order('id', { ascending: false });

      setBookings(bookingsData || []);

      // Fetch services info
      const { data: servicesData } = await supabase
        .from('services')
        .select('*');
        
      setServices(servicesData || []);

    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم.');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setClient(null);
    setBookings([]);
    setPhone('');
  };

  if (!client) {
    return (
      <div className="dashboard-login-container">
        <div className="login-box glass-panel">
          <h2>بوابة العملاء 📸</h2>
          <p>تابع حجوزاتك، مواعيد التصوير، وتفاصيل باقتك بكل سهولة.</p>
          <form onSubmit={handleLogin}>
            <input 
              type="tel" 
              placeholder="أدخل رقم الهاتف المسجل لدينا..." 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
            />
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="client-dashboard container">
      <div className="dashboard-header glass-panel">
        <div className="welcome-text">
          <h2>أهلاً بك، أ. {client.name} ✨</h2>
          <p>هنا يمكنك متابعة تفاصيل باقتك ومواعيد التصوير الخاصة بك.</p>
        </div>
        <button className="btn-secondary" onClick={handleLogout}>تسجيل الخروج</button>
      </div>

      <div className="dashboard-stats">
        <div className="stat-box glass-panel">
          <h3>إجمالي الحجوزات</h3>
          <p className="stat-value">{bookings.length}</p>
        </div>
        <div className="stat-box glass-panel">
          <h3>الرصيد المتبقي عليك</h3>
          <p className="stat-value debt-value">{client.debt > 0 ? `${client.debt} ج.م` : '0 ج.م (خالص)'}</p>
        </div>
        <div className="stat-box glass-panel">
          <h3>النقاط المكتسبة</h3>
          <p className="stat-value">{client.points} نقطة</p>
        </div>
      </div>

      <h3 className="section-subtitle">📅 مواعيد التصوير الخاصة بك</h3>
      <div className="bookings-grid">
        {bookings.length === 0 ? (
          <p className="no-data">لا توجد حجوزات مسجلة حالياً.</p>
        ) : (
          bookings.map(booking => {
            const serviceDetails = services.find(s => s.name === booking.service);
            return (
              <div key={booking.id} className="booking-card glass-panel">
                <div className="booking-status">
                  <span className={`status-badge ${booking.status === 'ملغي' ? 'cancelled' : 'active'}`}>
                    {booking.status}
                  </span>
                </div>
                <h4>{booking.service}</h4>
                <div className="booking-details">
                  <p><strong>التاريخ:</strong> <span dir="ltr">{booking.date}</span></p>
                  <p><strong>وقت البدء:</strong> <span dir="ltr">{booking.start_time}</span></p>
                  <p><strong>وقت الانتهاء:</strong> <span dir="ltr">{booking.end_time}</span></p>
                  <p><strong>تاريخ التسليم:</strong> {booking.delivery_date || 'غير محدد'}</p>
                  
                  {serviceDetails && (
                    <div className="service-info">
                      <p><strong>تفاصيل الباقة:</strong> تتضمن {serviceDetails.total_hours} ساعات تصوير.</p>
                    </div>
                  )}
                  
                  {booking.notes && (
                    <div className="booking-notes">
                      <strong>ملاحظات:</strong>
                      <p>{booking.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
