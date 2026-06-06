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

  const [activeTab, setActiveTab] = useState('home');

  if (!client) {
    return (
      <div className="dashboard-login-container wp-login-style">
        <div className="login-box">
          <div className="wp-login-logo">MT Agency</div>
          <h2>بوابة العملاء</h2>
          <form onSubmit={handleLogin}>
            <input 
              type="tel" 
              placeholder="رقم الهاتف..." 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
            />
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'جاري التحقق...' : 'دخول'}
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

  // Group bookings by service
  const packages = {};
  bookings.forEach(booking => {
    if (!packages[booking.service]) {
      packages[booking.service] = {
        name: booking.service,
        bookings: [],
        usedHours: 0,
        paid: 0,
        discount: 0,
        cost: -1,
        latestExpiry: null,
        notes: []
      };
    }
    const pkg = packages[booking.service];
    pkg.bookings.push(booking);
    pkg.usedHours += (booking.actual_hours || 0);
    pkg.paid += (booking.payment || 0);
    
    if (booking.discount > pkg.discount) {
      pkg.discount = booking.discount;
      if (booking.notes && booking.discount > 0) {
        pkg.notes.push(booking.notes);
      }
    }
    
    if (booking.custom_price !== null && booking.custom_price !== -1) {
      pkg.cost = booking.custom_price;
    }

    if (booking.delivery_date) {
      if (!pkg.latestExpiry || new Date(booking.delivery_date) > new Date(pkg.latestExpiry)) {
        pkg.latestExpiry = booking.delivery_date;
      }
    }
  });

  const renderHome = () => (
    <div className="wp-dashboard-widgets">
      <div className="wp-widget">
        <h3>نظرة عامة</h3>
        <div className="widget-stats">
          <div className="stat-item">
            <span>إجمالي الباقات</span>
            <strong>{Object.keys(packages).length}</strong>
          </div>
          <div className="stat-item">
            <span>إجمالي المواعيد</span>
            <strong>{bookings.length}</strong>
          </div>
          <div className="stat-item">
            <span>المديونية المتبقية</span>
            <strong className={client.debt > 0 ? 'text-red' : 'text-green'}>
              {client.debt} ج.م
            </strong>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPackages = () => (
    <div className="wp-packages-list">
      {Object.keys(packages).length === 0 ? (
        <div className="wp-notice info"><p>لا توجد باقات حالياً.</p></div>
      ) : (
        Object.values(packages).map(pkg => {
          const serviceDetails = services.find(s => s.name === pkg.name) || {};
          const totalHours = serviceDetails.total_hours || 0;
          const remainingHours = Math.max(0, totalHours - pkg.usedHours);

          const cost = pkg.cost !== -1 ? pkg.cost : (serviceDetails.price || 0);
          const remainingCost = Math.max(0, cost - pkg.discount - pkg.paid);

          return (
            <div key={pkg.name} className="wp-post-box">
              <div className="post-box-header">
                <h2>{pkg.name}</h2>
                {pkg.latestExpiry && <span className="wp-badge">انتهاء الصلاحية: {pkg.latestExpiry}</span>}
              </div>
              <div className="post-box-content">
                <table className="wp-list-table">
                  <thead>
                    <tr>
                      <th>إجمالي الباقة</th>
                      <th>الساعات المستخدمة</th>
                      <th>الساعات المتبقية</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formatTime(totalHours)}</td>
                      <td className="text-blue">{formatTime(pkg.usedHours)}</td>
                      <td className="text-green"><strong>{formatTime(remainingHours)}</strong></td>
                    </tr>
                  </tbody>
                </table>

                <h3 className="sub-heading mt-4">تفاصيل المدفوعات</h3>
                <table className="wp-list-table mt-2">
                  <thead>
                    <tr>
                      <th>التكلفة الكلية</th>
                      <th>المدفوع</th>
                      <th>المتبقي للدفعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{cost} ج.م</td>
                      <td className="text-green">{pkg.paid} ج.م</td>
                      <td className="text-red"><strong>{remainingCost} ج.م</strong></td>
                    </tr>
                  </tbody>
                </table>

                {remainingCost > 0 && (
                  <div className="wp-actions mt-3">
                    <button className="button button-primary">💳 سداد المتبقي ورفع الإيصال</button>
                  </div>
                )}

                <h3 className="sub-heading mt-4">مواعيد جلسات التصوير</h3>
                <table className="wp-list-table mt-2">
                  <thead>
                    <tr>
                      <th>اليوم والتاريخ</th>
                      <th>الوقت</th>
                      <th>الحالة</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.bookings.map(b => (
                      <tr key={b.id}>
                        <td>{getDayName(b.date)}</td>
                        <td dir="ltr">{b.start_time} - {b.end_time}</td>
                        <td>
                          <span className={`wp-status ${b.status === 'ملغي' ? 'status-cancelled' : 'status-active'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td>
                          <button className="button button-small">تعديل الموعد</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="wp-admin-layout">
      {/* Sidebar */}
      <div className="wp-admin-menu">
        <div className="wp-menu-header">
          <h3>MT Dashboard</h3>
        </div>
        <ul className="wp-menu-list">
          <li className={activeTab === 'home' ? 'current' : ''} onClick={() => setActiveTab('home')}>
            <span className="dashicons">🏠</span> الرئيسية
          </li>
          <li className={activeTab === 'packages' ? 'current' : ''} onClick={() => setActiveTab('packages')}>
            <span className="dashicons">📸</span> باقاتي ومواعيدي
          </li>
          <li className={activeTab === 'payments' ? 'current' : ''} onClick={() => setActiveTab('payments')}>
            <span className="dashicons">💰</span> الفواتير والدفع
          </li>
        </ul>
      </div>

      {/* Main Content Area */}
      <div className="wp-admin-wrapper">
        {/* Top Bar */}
        <div className="wp-admin-bar">
          <div className="admin-bar-left">
            <span>مرحباً، <strong>{client.name}</strong></span>
          </div>
          <div className="admin-bar-right">
            <button className="button" onClick={handleLogout}>تسجيل الخروج</button>
          </div>
        </div>

        {/* Content */}
        <div className="wp-admin-content">
          <div className="wp-content-header">
            <h1>{activeTab === 'home' ? 'الرئيسية' : activeTab === 'packages' ? 'باقاتي ومواعيدي' : 'الفواتير والدفع'}</h1>
          </div>
          
          {activeTab === 'home' && renderHome()}
          {activeTab === 'packages' && renderPackages()}
          {activeTab === 'payments' && (
             <div className="wp-post-box">
               <div className="post-box-content">
                 <p>سيتم عرض سجل الفواتير والمرفقات هنا قريباً.</p>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
