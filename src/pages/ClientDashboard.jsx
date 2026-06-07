import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calendar, Clock, CreditCard, ChevronRight, CheckCircle, Clock3 } from 'lucide-react';
import './ClientDashboard.css';

const ClientDashboard = () => {
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState('overview');
  const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, booking: null, date: '', time: '' });
  const [pendingRequests, setPendingRequests] = useState([]); // Simulate database for pending requests

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

  const pieData = [
    { name: 'مستخدم', value: primaryPackage ? primaryPackage.usedHours : 0 },
    { name: 'متبقي', value: remainingHours }
  ];
  const PIE_COLORS = ['#c678ff', 'rgba(255,255,255,0.05)'];

  const barData = bookings.slice(0, 5).map(b => ({
    name: b.date,
    hours: b.actual_hours || 0
  }));

  return (
    <div className="mt-dashboard">
      {/* Sidebar */}
      <aside className="mt-sidebar">
        <div className="sidebar-brand">
          <h1>MT Dashboard</h1>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <span className="icon">📊</span> نظرة عامة
          </button>
          <button className={`nav-btn ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
            <span className="icon">📅</span> المواعيد والجدول
          </button>
          <button className={`nav-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
            <span className="icon">💳</span> الماليات والفواتير
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
          <button className="btn-logout" onClick={handleLogout}>تسجيل خروج</button>
        </header>

        <div className="content-wrapper">
          {activeTab === 'overview' && primaryPackage && (
            <div className="overview-tab">
              <div className="cards-grid">
                
                {/* Package Details Card */}
                <div className="mt-card premium-glass">
                  <div className="card-header">
                    <h3><Calendar size={20}/> تفاصيل الباقة الحالية</h3>
                    <span className="badge-glow">{primaryPackage.name}</span>
                  </div>
                  <div className="card-body package-split">
                    <div className="package-info">
                      <div className="info-item">
                        <span className="label">إجمالي الساعات:</span>
                        <span className="value">{formatTime(totalHours)}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">المستخدم:</span>
                        <span className="value text-neon">{formatTime(primaryPackage.usedHours)}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">المتبقي:</span>
                        <span className="value text-silver">{formatTime(remainingHours)}</span>
                      </div>
                      <div className="info-item mt-2">
                        <span className="label">الصلاحية:</span>
                        <span className="value">{primaryPackage.latestExpiry || 'غير محدد'}</span>
                      </div>
                    </div>
                    <div className="package-chart">
                      <div className="chart-center-text">
                        <strong>{Math.round(progressPercent)}%</strong>
                        <span>مستهلك</span>
                      </div>
                      <ResponsiveContainer width={120} height={120}>
                        <PieChart>
                          <Pie data={pieData} innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Financial Status Card */}
                <div className="mt-card premium-glass">
                  <div className="card-header">
                    <h3><CreditCard size={20}/> الحالة المادية</h3>
                  </div>
                  <div className="card-body">
                    <div className="finance-row">
                      <div className="finance-box">
                        <span>إجمالي التكلفة</span>
                        <strong>{cost} ج</strong>
                      </div>
                      <div className="finance-box box-paid">
                        <span>المدفوع</span>
                        <strong>{primaryPackage.paid} ج</strong>
                      </div>
                      <div className="finance-box box-debt">
                        <span>المتبقي</span>
                        <strong>{remainingCost} ج</strong>
                      </div>
                    </div>
                    {remainingCost > 0 && (
                      <button className="btn-modern-primary w-100 mt-4">سداد الدفعة المتبقية ورفع الإيصال</button>
                    )}
                  </div>
                </div>

              </div>

              {/* Chart Section */}
              <div className="mt-card premium-glass mt-4">
                <div className="card-header">
                  <h3><Clock size={20}/> معدل استهلاك الساعات (آخر 5 جلسات)</h3>
                </div>
                <div className="card-body" style={{ height: '300px' }}>
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
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="schedule-tab">
              <div className="mt-card premium-glass">
                <div className="card-header">
                  <h3>جدول المواعيد وتغييرها</h3>
                </div>
                <div className="table-responsive">
                  <table className="mt-table">
                    <thead>
                      <tr>
                        <th>اليوم والتاريخ</th>
                        <th>وقت الجلسة</th>
                        <th>الباقة (الخدمة)</th>
                        <th>حالة الموعد</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map(b => {
                        const isPending = pendingRequests.some(pr => pr.id === b.id);
                        return (
                          <tr key={b.id}>
                            <td>{getDayName(b.date)}</td>
                            <td dir="ltr">{b.start_time} - {b.end_time}</td>
                            <td>{b.service}</td>
                            <td>
                              {isPending ? (
                                <span className="status-badge badge-pending"><Clock3 size={14}/> في انتظار المراجعة</span>
                              ) : b.status === 'ملغي' ? (
                                <span className="status-badge badge-red">ملغي</span>
                              ) : (
                                <span className="status-badge badge-green"><CheckCircle size={14}/> {b.status}</span>
                              )}
                            </td>
                            <td>
                              <button 
                                className="btn-action" 
                                disabled={isPending || b.status === 'ملغي'}
                                onClick={() => setRescheduleModal({ isOpen: true, booking: b, date: '', time: '' })}
                              >
                                تغيير الموعد
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="finance-tab">
               <div className="mt-card premium-glass">
                  <div className="card-header">
                    <h3>سجل المدفوعات وتفاصيل الحساب</h3>
                  </div>
                  <div className="card-body">
                    <p className="text-silver">هنا يمكنك مراجعة كافة الفواتير وإيصالات الدفع المرتبطة بحسابك.</p>
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
            <p>الجلسة الحالية: {rescheduleModal.booking.date} ({rescheduleModal.booking.start_time})</p>
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
    </div>
  );
};

export default ClientDashboard;
