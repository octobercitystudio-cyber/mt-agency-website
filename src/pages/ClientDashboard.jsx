import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calendar, Clock, CreditCard, ChevronRight, ChevronLeft, CheckCircle, Clock3, X, Tag } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isAfter, startOfWeek, endOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useData } from '../store/DataContext';
import './ClientDashboard.css';

const ClientDashboard = () => {
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { siteData } = useData();
  
  const [activeTab, setActiveTab] = useState('home');
  const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, booking: null, date: '', time: '' });
  const [pendingRequests, setPendingRequests] = useState([]); // Simulate database for pending requests
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dayModal, setDayModal] = useState({ isOpen: false, date: null, bookingsForDay: [] });
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, amount: '', file: null });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
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

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('client_name', clientData.name)
        .order('id', { ascending: false });

      setBookings(bookingsData || []);

      const { data: servicesData } = await supabase
        .from('services')
        .select('*');
        
      setServices(servicesData || []);

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('client_name', clientData.name)
        .order('id', { ascending: false });
      
      setPayments(paymentsData || []);
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

  const submitReschedule = (e) => {
    e.preventDefault();
    setPendingRequests([...pendingRequests, { id: rescheduleModal.booking.id, date: rescheduleModal.date, time: rescheduleModal.time }]);
    setRescheduleModal({ isOpen: false, booking: null, date: '', time: '' });
  };

  if (!client) {
    return (
      <div className="modern-login-container">
        <div className="modern-login-box">
          <div className="brand-logo">MT Agency</div>
          <h2>بوابة المعلمين 🎓</h2>
          <p>أدخل رقم الهاتف للوصول للوحة التحكم الخاصة بك</p>
          <form onSubmit={handleLogin}>
            <input 
              type="tel" 
              placeholder="رقم الهاتف المسجل..." 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
            />
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-modern-primary" disabled={loading}>
              {loading ? 'جاري التحقق...' : 'دخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Format Helpers
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

  // Group packages
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
        latestExpiry: null
      };
    }
    const pkg = packages[booking.service];
    pkg.bookings.push(booking);
    pkg.usedHours += (booking.actual_hours || 0);
    pkg.paid += (booking.payment || 0);
    if (booking.discount > pkg.discount) pkg.discount = booking.discount;
    if (booking.custom_price !== null && booking.custom_price !== -1) pkg.cost = booking.custom_price;
    if (booking.delivery_date) {
      if (!pkg.latestExpiry || new Date(booking.delivery_date) > new Date(pkg.latestExpiry)) {
        pkg.latestExpiry = booking.delivery_date;
      }
    }
  });

  const primaryPackage = Object.values(packages)[0] || null;
  let serviceDetails = {}, totalHours = 0, remainingHours = 0, cost = 0, remainingCost = 0, progressPercent = 0;
  
  if (primaryPackage) {
    serviceDetails = services.find(s => s.name === primaryPackage.name) || {};
    totalHours = serviceDetails.total_hours || 0;
    remainingHours = Math.max(0, totalHours - primaryPackage.usedHours);
    cost = primaryPackage.cost !== -1 ? primaryPackage.cost : (serviceDetails.price || 0);
    remainingCost = Math.max(0, cost - primaryPackage.discount - primaryPackage.paid);
    progressPercent = totalHours > 0 ? (primaryPackage.usedHours / totalHours) * 100 : 0;
  }

  const now = new Date();
  const filteredBookings = bookings.filter(b => {
    if (timeFilter === 'all') return true;
    const bDate = new Date(b.date);
    
    if (timeFilter === 'last_shoot') {
      const pastShoots = bookings.filter(bk => bk.actual_hours && bk.actual_hours > 0).sort((a,b) => new Date(b.date) - new Date(a.date));
      if(pastShoots.length === 0) return false;
      return isSameDay(bDate, new Date(pastShoots[0].date));
    }
    
    if (timeFilter === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 6 });
      const weekEndMs = weekStart.getTime() + (5 * 24 * 60 * 60 * 1000);
      return bDate.getTime() >= weekStart.getTime() && bDate.getTime() <= weekEndMs;
    }
    
    if (timeFilter === 'month') {
      return isSameMonth(bDate, now);
    }

    return true;
  });

  // Re-calculate used hours based on filtered bookings
  let filteredUsedHours = 0;
  filteredBookings.forEach(b => {
    if (primaryPackage && b.service === primaryPackage.name) {
      filteredUsedHours += (b.actual_hours || 0);
    }
  });

  const pieData = [
    { name: 'مستخدم بالفترة', value: filteredUsedHours },
    { name: 'متبقي', value: Math.max(0, totalHours - filteredUsedHours) }
  ];
  const PIE_COLORS = ['#c678ff', 'rgba(255,255,255,0.05)'];

  const barData = filteredBookings.slice(0, 10).map(b => ({
    name: b.date,
    hours: b.actual_hours || 0
  })).reverse();

  // Calculate Next Appointment
  const nextAppointment = [...bookings]
    .filter(b => isAfter(new Date(b.date), new Date()) || isSameDay(new Date(b.date), new Date()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  return (
    <div className="mt-dashboard">
      {/* Sidebar */}
      <aside className="mt-sidebar">
        <div className="sidebar-brand">
          <h1>MT Dashboard</h1>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <span className="icon">🏠</span> الرئيسية
          </button>
          <button className={`nav-btn ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
            <span className="icon">📅</span> المواعيد
          </button>
          <button className={`nav-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
            <span className="icon">💳</span> الحالة المادية
          </button>
          <button className={`nav-btn ${activeTab === 'offers' ? 'active' : ''}`} onClick={() => setActiveTab('offers')}>
            <span className="icon"><Tag size={18}/></span> العروض
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="mt-main">
        <header className="main-header">
          <div className="header-greeting">
            <h2>مرحباً بك، أ. {client.name} ✨</h2>
            <p>جاهز لجلسة التصوير القادمة؟</p>
          </div>
          <div className="header-actions" style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
            <button className="btn-notification" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-silver)', padding: '0.8rem', borderRadius: '50%', cursor: 'pointer', position: 'relative'}}>
              <span className="icon" style={{fontSize: '1.2rem'}}>🔔</span>
              {pendingRequests.length > 0 && <span style={{position: 'absolute', top: '-5px', right: '-5px', background: '#ff4757', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '50%'}}>{pendingRequests.length}</span>}
            </button>
            <button className="btn-logout" onClick={handleLogout}>تسجيل خروج</button>
          </div>
        </header>

        <div className="content-wrapper">
          {activeTab === 'home' && primaryPackage && (
            <div className="home-tab">
              {/* Package Title Bar */}
              <div className="package-title-bar mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}><Calendar size={24}/> تفاصيل الباقة الإجمالية</h3>
                <span className="badge-glow" style={{ fontSize: '1.1rem', padding: '0.6rem 1.5rem' }}>{primaryPackage.name}</span>
              </div>

              {/* Hero Stats Grid */}
              <div className="hero-stats-grid mb-4">
                <div className="stat-card premium-glass glow-purple">
                  <div className="stat-icon"><Clock size={28} /></div>
                  <div className="stat-info">
                    <span className="stat-label">إجمالي الساعات</span>
                    <strong className="stat-value">{formatTime(totalHours)}</strong>
                  </div>
                </div>
                <div className="stat-card premium-glass glow-neon">
                  <div className="stat-icon"><CheckCircle size={28} /></div>
                  <div className="stat-info">
                    <span className="stat-label">المستخدم الكلي</span>
                    <strong className="stat-value text-neon">{formatTime(primaryPackage.usedHours)}</strong>
                  </div>
                </div>
                <div className="stat-card premium-glass glow-silver">
                  <div className="stat-icon"><Clock3 size={28} /></div>
                  <div className="stat-info">
                    <span className="stat-label">المتبقي الكلي</span>
                    <strong className="stat-value text-silver">{formatTime(remainingHours)}</strong>
                  </div>
                </div>
                <div className="stat-card premium-glass glow-border">
                  <div className="stat-icon"><Calendar size={28} /></div>
                  <div className="stat-info">
                    <span className="stat-label">الصلاحية</span>
                    <strong className="stat-value" style={{fontSize: '1rem'}}>{primaryPackage.latestExpiry || 'غير محدد'}</strong>
                  </div>
                </div>
              </div>

              {/* Time Filters */}
              <div className="time-filters-container mb-4">
                <button className={`filter-btn ${timeFilter === 'last_shoot' ? 'active' : ''}`} onClick={() => setTimeFilter('last_shoot')}>اخر موعد تصوير</button>
                <button className={`filter-btn ${timeFilter === 'week' ? 'active' : ''}`} onClick={() => setTimeFilter('week')}>اخر اسبوع</button>
                <button className={`filter-btn ${timeFilter === 'month' ? 'active' : ''}`} onClick={() => setTimeFilter('month')}>اخر شهر</button>
                <button className={`filter-btn ${timeFilter === 'all' ? 'active' : ''}`} onClick={() => setTimeFilter('all')}>مدة الباقة كاملة</button>
              </div>

              {/* Massive Consumption Chart Section */}
              <div className="mt-card premium-glass mb-4">
                <div className="card-header">
                  <h3><Clock size={20}/> تفاصيل الاستهلاك للفترة المحددة</h3>
                </div>
                <div className="card-body" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 60%', minWidth: '300px', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="name" stroke="#fff" tick={{fill: '#b3b3b3'}} />
                        <YAxis stroke="#fff" tick={{fill: '#b3b3b3'}} />
                        <Tooltip contentStyle={{backgroundColor: '#1e142e', border: '1px solid #9d4edd', borderRadius: '8px'}}/>
                        <Bar dataKey="hours" fill="url(#colorUv)" radius={[4, 4, 0, 0]} />
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#c678ff" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#9d4edd" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="package-chart" style={{ flex: '1 1 30%', minWidth: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="chart-center-text">
                      <strong style={{fontSize: '1.8rem'}}>{filteredUsedHours}</strong>
                      <span>ساعة استهلاك</span>
                    </div>
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie data={pieData} innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="schedule-tab">
              {/* Next Appointment Hero */}
              <div className="mt-card premium-glass mb-4 glow-purple" style={{ textAlign: 'center', padding: '2rem' }}>
                <h3 style={{ color: '#8c8c8c', margin: '0 0 0.5rem', fontSize: '1.2rem' }}>الموعد القادم</h3>
                {nextAppointment ? (
                  <div>
                    <strong style={{ fontSize: '2rem', color: '#fff', display: 'block' }}>{getDayName(nextAppointment.date)}</strong>
                    <span style={{ fontSize: '1.2rem', color: 'var(--color-neon-purple)' }} dir="ltr">{nextAppointment.start_time} - {nextAppointment.end_time}</span>
                  </div>
                ) : (
                  <strong style={{ fontSize: '1.5rem', color: '#fff' }}>لا توجد مواعيد قادمة</strong>
                )}
              </div>

              {/* Calendar Grid */}
              <div className="mt-card premium-glass">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-action"><ChevronRight size={20}/></button>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>{format(currentMonth, 'MMMM yyyy', { locale: ar })}</h3>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-action"><ChevronLeft size={20}/></button>
                </div>
                <div className="card-body">
                  <div className="calendar-grid">
                    {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, i) => (
                      <div key={i} className="calendar-day-header">{day}</div>
                    ))}
                    {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn: 0}), end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn: 0}) }).map((day, idx) => {
                      const dayBookings = bookings.filter(b => isSameDay(new Date(b.date), day));
                      const isSelectedMonth = isSameMonth(day, currentMonth);
                      const hasBooking = dayBookings.length > 0;
                      return (
                        <div 
                          key={idx} 
                          className={`calendar-cell ${isSelectedMonth ? '' : 'disabled'} ${hasBooking ? 'has-booking' : ''}`}
                          onClick={() => hasBooking && setDayModal({ isOpen: true, date: day, bookingsForDay: dayBookings })}
                        >
                          <span className="day-number">{format(day, 'd')}</span>
                          {hasBooking && <div className="booking-dot"></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'finance' && primaryPackage && (
            <div className="finance-tab">
               <div className="mt-card premium-glass mb-4">
                  <div className="card-header">
                    <h3><CreditCard size={20}/> الرسوم البيانية للحالة المادية</h3>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Glass Buttons Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                      <div className="stat-card premium-glass glow-silver" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
                        <span className="stat-label" style={{ marginBottom: '0.5rem' }}>إجمالي التكلفة</span>
                        <strong className="stat-value text-silver">{cost} ج</strong>
                      </div>
                      <div className="stat-card premium-glass glow-neon" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
                        <span className="stat-label" style={{ marginBottom: '0.5rem' }}>المدفوع الكلي</span>
                        <strong className="stat-value text-neon">{primaryPackage.paid} ج</strong>
                      </div>
                      <div className="stat-card premium-glass glow-purple" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', borderColor: 'rgba(255, 71, 87, 0.3)' }}>
                        <span className="stat-label" style={{ marginBottom: '0.5rem' }}>المتبقي</span>
                        <strong className="stat-value" style={{ color: '#ff4757' }}>{remainingCost} ج</strong>
                      </div>
                    </div>

                    {/* Chart Row */}
                    <div style={{ height: '300px', position: 'relative', marginTop: '1rem' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={[{name: 'المدفوع', value: parseFloat(primaryPackage.paid) || 0}, {name: 'المتبقي', value: remainingCost > 0 ? remainingCost : 0}]} 
                            innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none"
                            label={({ name, value }) => `${name} (${value} ج)`}
                            labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                          >
                            <Cell fill="#2ed573" />
                            <Cell fill="#ff4757" />
                          </Pie>
                          <Tooltip contentStyle={{backgroundColor: '#1e142e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px'}}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
               </div>

               <div className="mt-card premium-glass">
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>سجل الدفعات السابقة</h3>
                    <button className="btn-modern-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }} onClick={() => setPaymentModal({ isOpen: true, amount: '', file: null })}>
                      + إضافة مبلغ مالي
                    </button>
                  </div>
                  <div className="table-responsive">
                    <table className="mt-table">
                      <thead>
                        <tr>
                          <th>التاريخ</th>
                          <th>المبلغ</th>
                          <th>الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.length > 0 ? payments.map((p, i) => (
                          <tr key={i}>
                            <td dir="ltr">{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                            <td className="text-neon"><strong>{p.amount} ج</strong></td>
                            <td><span className="status-badge badge-green">مكتمل</span></td>
                          </tr>
                        )) : (
                          <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: '#8c8c8c' }}>لم يتم تسجيل دفعات بعد</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'offers' && (
            <div className="offers-tab">
               <div className="mt-card premium-glass">
                  <div className="card-header">
                    <h3><Tag size={20}/> أحدث العروض والخصومات</h3>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                      {siteData?.offers?.filter(o => o.is_active).map(offer => (
                        <div key={offer.id} style={{ background: 'linear-gradient(135deg, rgba(157, 78, 221, 0.1), rgba(0, 0, 0, 0))', border: '1px solid var(--color-vibrant-purple)', borderRadius: '16px', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: '-15px', left: '-20px', background: 'var(--color-vibrant-purple)', color: '#fff', padding: '30px 40px 10px', transform: 'rotate(-45deg)', fontWeight: 'bold', zIndex: 1, textAlign: 'center' }}>{offer.discount}</div>
                          <h4 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '1rem', width: '100%', paddingLeft: '60px' }}>{offer.title}</h4>
                          <p style={{ color: '#c0c0c0', lineHeight: '1.6' }}>{offer.desc}</p>
                          <button className="btn-modern-primary" style={{ marginTop: '1.5rem', width: '100%' }}>استفد من العرض الآن</button>
                        </div>
                      ))}
                      {(!siteData?.offers || siteData.offers.filter(o => o.is_active).length === 0) && (
                        <p style={{ textAlign: 'center', color: '#8c8c8c', width: '100%' }}>لا توجد عروض متاحة حالياً.</p>
                      )}
                    </div>
                  </div>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* Reschedule Modal */}
      {rescheduleModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content premium-glass">
            <h3>تغيير موعد الجلسة</h3>
            <p>الجلسة الحالية: {rescheduleModal.booking.date} (<span dir="ltr">{rescheduleModal.booking.start_time}</span>)</p>
            <form onSubmit={submitReschedule}>
              <div className="form-group">
                <label>التاريخ المقترح:</label>
                <input type="date" required value={rescheduleModal.date} onChange={e => setRescheduleModal({...rescheduleModal, date: e.target.value})}/>
              </div>
              <div className="form-group">
                <label>الوقت المقترح:</label>
                <input type="time" required value={rescheduleModal.time} onChange={e => setRescheduleModal({...rescheduleModal, time: e.target.value})}/>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setRescheduleModal({ isOpen: false, booking: null, date: '', time: '' })}>إلغاء</button>
                <button type="submit" className="btn-modern-primary">إرسال طلب التغيير</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {dayModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content premium-glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>تفاصيل موعد {format(dayModal.date, 'EEEE d MMMM', { locale: ar })}</h3>
              <button className="btn-action" onClick={() => setDayModal({ isOpen: false, date: null, bookingsForDay: [] })} style={{ padding: '0.3rem', borderRadius: '50%' }}><X size={20}/></button>
            </div>
            {dayModal.bookingsForDay.map(b => (
              <div key={b.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '16px', marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem', color: '#fff', fontSize: '1.3rem', fontWeight: 'bold' }}>الساعة: <span className="text-neon" dir="ltr">{b.start_time} - {b.end_time}</span></p>
                <p style={{ margin: '0 0 1.5rem', color: '#8c8c8c' }}>الباقة: {b.service}</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn-modern-primary" style={{ flex: 1, padding: '0.8rem', fontSize: '1rem' }} onClick={() => { setDayModal({...dayModal, isOpen: false}); setRescheduleModal({ isOpen: true, booking: b, date: '', time: '' }); }}>تغيير الموعد</button>
                  <button className="btn-cancel" style={{ flex: 1, padding: '0.8rem', fontSize: '1rem', background: 'rgba(255,71,87,0.1)', color: '#ff4757', borderColor: 'rgba(255,71,87,0.3)' }} onClick={() => { setPendingRequests([...pendingRequests, {id: b.id, cancel: true}]); setDayModal({...dayModal, isOpen: false}); }}>إلغاء الموعد</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {paymentModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content premium-glass">
            <h3>إضافة دفعة مالية</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              setPayments([{ amount: paymentModal.amount, created_at: new Date().toISOString() }, ...payments]);
              setPaymentModal({ isOpen: false, amount: '', file: null });
              alert('تم رفع الإيصال بانتظار المراجعة من الإدارة!');
            }}>
              <div className="form-group">
                <label>المبلغ (جنية):</label>
                <input type="number" required value={paymentModal.amount} onChange={e => setPaymentModal({...paymentModal, amount: e.target.value})} placeholder="مثال: 1500" />
              </div>
              <div className="form-group">
                <label>إيصال التحويل (صورة الاسكرين):</label>
                <input type="file" accept="image/*" required onChange={e => setPaymentModal({...paymentModal, file: e.target.files[0]})} style={{ padding: '0.5rem' }} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setPaymentModal({ isOpen: false, amount: '', file: null })}>إلغاء</button>
                <button type="submit" className="btn-modern-primary">تأكيد ورفع</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
