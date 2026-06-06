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

  const formatTime = (decimalHours) => {
    if (!decimalHours) return '0 س';
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    if (hours === 0) return `${minutes} د`;
    if (minutes === 0) return `${hours} س`;
    return `${hours} س و ${minutes} د`;
  };

  const getDayName = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return `${days[date.getDay()]} ${dateStr}`;
  };

  return (
    <div className="client-dashboard container">
      <div className="dashboard-header glass-panel">
        <div className="welcome-text">
          <h2>أهلاً بك، أ. {client.name} ✨</h2>
          <p>هنا يمكنك متابعة تفاصيل باقتك ومواعيد التصوير الخاصة بك.</p>
        </div>
        <button className="btn-secondary" onClick={handleLogout}>تسجيل الخروج</button>
      </div>

      <h3 className="section-subtitle">📸 باقة التصوير النشطة:</h3>
      <div className="bookings-grid">
        {bookings.length === 0 ? (
          <p className="no-data">لا توجد حجوزات مسجلة حالياً.</p>
        ) : (
          bookings.map(booking => {
            const serviceDetails = services.find(s => s.name === booking.service) || {};
            const totalHours = serviceDetails.total_hours || 0;
            const usedHours = booking.actual_hours || 0;
            const remainingHours = Math.max(0, totalHours - usedHours);

            const cost = (booking.custom_price !== null && booking.custom_price !== -1) ? booking.custom_price : (serviceDetails.price || 0);
            const paid = booking.payment || 0;
            const discount = booking.discount || 0;
            // Calculate remaining cost considering discount
            const remainingCost = Math.max(0, cost - discount - paid);

            return (
              <div key={booking.id} className="package-card">
                <div className="package-header">
                  <h4 className="package-title">{booking.service}</h4>
                </div>

                <div className="package-stats-row">
                  <div className="package-stat-box">
                    <span className="stat-label">المتبقي</span>
                    <span className="stat-value-time text-green">{formatTime(remainingHours)}</span>
                  </div>
                  <div className="package-stat-box">
                    <span className="stat-label">المستخدم</span>
                    <span className="stat-value-time text-blue">{formatTime(usedHours)}</span>
                  </div>
                  <div className="package-stat-box">
                    <span className="stat-label">الباقة</span>
                    <span className="stat-value-time">{formatTime(totalHours)}</span>
                  </div>
                </div>

                {booking.delivery_date && (
                  <div className="expiry-badge">
                    📅 انتهاء الصلاحية: {getDayName(booking.delivery_date)}
                  </div>
                )}

                <div className="package-stats-row mt-3">
                  <div className="package-stat-box box-red">
                    <span className="stat-label text-red">المتبقي</span>
                    <span className="stat-value-money text-red">{remainingCost} ج</span>
                  </div>
                  <div className="package-stat-box box-green">
                    <span className="stat-label text-green">المدفوع</span>
                    <span className="stat-value-money text-green">{paid} ج</span>
                  </div>
                  <div className="package-stat-box">
                    <span className="stat-label">التكلفة</span>
                    <span className="stat-value-money">{cost} ج</span>
                  </div>
                </div>

                {discount > 0 && (
                  <div className="discount-banner">
                    🏷️ الخصم المضاف: {discount} ج.م
                    {booking.notes && <span className="discount-reason">({booking.notes})</span>}
                  </div>
                )}

                {remainingCost > 0 && (
                  <button className="btn-pay-remaining">
                    سداد المتبقي للباقة 🔔
                  </button>
                )}

                <div className="booking-times-section">
                  <h5 className="times-title">مواعيد التصوير</h5>
                  <div className="time-row">
                    <span>التاريخ:</span>
                    <strong>{getDayName(booking.date)}</strong>
                  </div>
                  <div className="time-row">
                    <span>وقت البدء:</span>
                    <strong dir="ltr">{booking.start_time}</strong>
                  </div>
                  <div className="time-row">
                    <span>وقت الانتهاء:</span>
                    <strong dir="ltr">{booking.end_time}</strong>
                  </div>
                  <div className="time-row">
                    <span>الحالة:</span>
                    <strong className={`status-text ${booking.status === 'ملغي' ? 'text-red' : 'text-green'}`}>{booking.status}</strong>
                  </div>
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
