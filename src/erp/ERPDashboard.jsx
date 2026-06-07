import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Truck, DollarSign, TrendingUp, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
// Using the dark admin styles as requested
import '../admin/AdminLayout.css';

const ERPDashboard = () => {
  const [stats, setStats] = useState({
    activePackages: 0,
    weekDeliveries: 0,
    marketDues: 0,
    netProfit: 0
  });
  const [todayBookings, setTodayBookings] = useState([]);
  const [tomorrowBookings, setTomorrowBookings] = useState([]);
  const [dueTasks, setDueTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
      // Calculate tomorrow correctly (if today is Thursday, next workday might be Saturday in the original app, but let's just use +1 day or +2 if thursday as per original logic)
      const dayOfWeek = new Date().getDay(); // 0 is Sunday, 4 is Thursday, 5 is Friday
      const daysToAdd = dayOfWeek === 4 ? 2 : 1;
      const tomorrowStr = format(addDays(new Date(), daysToAdd), 'yyyy-MM-dd');
      
      const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      const currentMonth = format(new Date(), 'yyyy-MM');

      // 1. Fetch Finance for Net Profit
      const { data: financeData } = await supabase
        .from('finance')
        .select('*')
        .like('date', `${currentMonth}%`);
      
      let realInc = 0;
      let realExp = 0;
      if (financeData) {
        financeData.forEach(f => {
          if (['إيراد', 'سداد سلفة'].includes(f.type)) realInc += Number(f.amount || 0);
          if (['مصروف', 'سحب سلفة'].includes(f.type)) realExp += Number(f.amount || 0);
        });
      }
      const netProfit = realInc - realExp;

      // 2. Fetch Deliveries
      const { data: deliveriesData } = await supabase
        .from('bookings')
        .select('id')
        .gte('delivery_date', todayStr)
        .lte('delivery_date', nextWeekStr)
        .not('status', 'like', '%مؤرشف%')
        .neq('delivery_date', null)
        .neq('delivery_date', '');
      
      const weekDeliveries = deliveriesData ? deliveriesData.length : 0;

      // 3. Fetch Packages and Debts (Market Dues)
      // This requires complex grouping similar to the original app.
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('client_name, service, actual_hours, actual_reels, custom_price, discount, payment, status')
        .neq('status', 'دفعة');
        
      // Fetch services to know package totals
      const { data: servicesData } = await supabase
        .from('services')
        .select('*');
        
      let activePackages = 0;
      let marketDues = 0;

      if (bookingsData && servicesData) {
        // Group bookings by client and service
        const grouped = {};
        bookingsData.forEach(b => {
          const key = `${b.client_name}_${b.service}`;
          if (!grouped[key]) grouped[key] = { client: b.client_name, service: b.service, used_h: 0, used_r: 0, custom_price: -1, discount: 0, paid: 0, is_archived: b.service.includes('مؤرشف') };
          
          grouped[key].used_h += Number(b.actual_hours || 0);
          grouped[key].used_r += Number(b.actual_reels || 0);
          if (Number(b.custom_price) > -1) grouped[key].custom_price = Math.max(grouped[key].custom_price, Number(b.custom_price));
          grouped[key].discount = Math.max(grouped[key].discount, Number(b.discount || 0));
        });

        // Add payments
        const { data: paymentsData } = await supabase
          .from('bookings')
          .select('*')
          .eq('status', 'دفعة');
          
        if (paymentsData) {
          paymentsData.forEach(p => {
            const key = `${p.client_name}_${p.service}`;
            if (grouped[key]) {
              grouped[key].paid += Number(p.payment || 0);
            }
          });
        }

        // Calculate Active Packages and Debts
        Object.values(grouped).forEach(g => {
          const srvName = g.service.replace(' (مؤرشف)', '');
          const srv = servicesData.find(s => s.name === srvName);
          
          if (srv) {
            if (!g.is_archived) {
              if (['باقة شهرية', 'باقة يومية', 'تصوير بالساعة'].includes(srv.category)) {
                if (Number(srv.total_hours) - g.used_h > 0) activePackages++;
              } else if (srv.category === 'باقة ريلز') {
                if (Number(srv.total_reels) - g.used_r > 0) activePackages++;
              }
            }
            
            const basePrice = Number(srv.price || 0);
            const custom = g.custom_price;
            const price = custom > -1 ? custom : Math.max(0, basePrice - g.discount);
            const rem = Math.max(0, price - g.paid);
            marketDues += rem;
          }
        });
      }

      setStats({
        activePackages,
        weekDeliveries,
        marketDues,
        netProfit
      });

      // 4. Fetch Today and Tomorrow Bookings
      const { data: tdyBkgs } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', todayStr)
        .neq('status', 'دفعة')
        .neq('start_time', '')
        .order('start_time', { ascending: true });
        
      const { data: tmrwBkgs } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', tomorrowStr)
        .neq('status', 'دفعة')
        .neq('start_time', '')
        .order('start_time', { ascending: true });

      setTodayBookings(tdyBkgs || []);
      setTomorrowBookings(tmrwBkgs || []);

      // 5. Fetch Reminders/Tasks
      const { data: tasksData } = await supabase
        .from('reminders')
        .select('*')
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      const due = [];
      const now = new Date();
      if (tasksData) {
        tasksData.forEach(t => {
          if (t.due_date) {
            const dueDate = new Date(t.due_date);
            const notifyDate = new Date(dueDate.getTime() - (t.notify_before || 0) * 60000);
            if (now >= notifyDate) {
              due.push(t);
            }
          }
        });
      }
      setDueTasks(due);

    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleCompleteTask = async (id, isRecurring, dueDateStr) => {
    if (isRecurring) {
      const dueDate = new Date(dueDateStr);
      dueDate.setMonth(dueDate.getMonth() + 1); // simple +1 month for recurring
      await supabase.from('reminders').update({ due_date: dueDate.toISOString() }).eq('id', id);
    } else {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', id);
    }
    loadDashboardData();
  };

  return (
    <div className="admin-section">
      {/* Top Banner exactly like the screenshot */}
      <div style={{ background: 'var(--color-vibrant-purple)', borderRadius: '20px', padding: '30px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', boxShadow: '0 10px 30px rgba(157, 78, 221, 0.3)' }}>
        <div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 15px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '15px' }}>
            ⚡ نظام الإدارة الذكي
          </div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '2.8rem' }}>😊</span>
            لوحة تحكم Multi Task Agency
          </h1>
          <p style={{ margin: '10px 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>مرحباً بك مجدداً ! Owner - October City Studio</p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px 30px', borderRadius: '20px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '1rem', opacity: 0.9, marginBottom: '5px' }}>
            {format(currentTime, 'EEEE, d MMMM yyyy', { locale: ar })}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {format(currentTime, 'hh:mm:ss')}
            <span style={{ fontSize: '1.2rem', marginRight: '5px' }}>{format(currentTime, 'aa', { locale: ar })}</span>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: '#8c8c8c', margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 'bold' }}>باقات نشطة</p>
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>{loading ? '...' : stats.activePackages}</h3>
          </div>
          <div style={{ background: 'rgba(52, 152, 219, 0.2)', padding: '15px', borderRadius: '50%', color: '#3498db' }}>
            <Package size={28} />
          </div>
        </div>

        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: '#8c8c8c', margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 'bold' }}>تسليمات (أسبوع)</p>
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>{loading ? '...' : stats.weekDeliveries}</h3>
          </div>
          <div style={{ background: 'rgba(0, 209, 178, 0.2)', padding: '15px', borderRadius: '50%', color: '#00d1b2' }}>
            <Truck size={28} />
          </div>
        </div>

        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: '#8c8c8c', margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 'bold' }}>مستحقات السوق</p>
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#f1c40f' }}>{loading ? '...' : stats.marketDues.toLocaleString()}</h3>
          </div>
          <div style={{ background: 'rgba(241, 196, 15, 0.2)', padding: '15px', borderRadius: '50%', color: '#f1c40f' }}>
            <DollarSign size={28} />
          </div>
        </div>

        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: '#8c8c8c', margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 'bold' }}>صافي الربح</p>
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#2ecc71' }}>{loading ? '...' : stats.netProfit.toLocaleString()}</h3>
          </div>
          <div style={{ background: 'rgba(46, 204, 113, 0.2)', padding: '15px', borderRadius: '50%', color: '#2ecc71' }}>
            <TrendingUp size={28} />
          </div>
        </div>
      </div>

      {/* Bookings Tables (Today & Tomorrow) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        
        {/* Tomorrow Bookings */}
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '2px solid rgba(52, 152, 219, 0.5)', paddingBottom: '10px' }}>
            <Calendar size={24} color="#3498db" />
            <h3 style={{ margin: 0, color: '#fff' }}>مواعيد غداً</h3>
          </div>
          {loading ? <div style={{ color: '#8c8c8c', textAlign: 'center', padding: '20px' }}>جاري التحميل...</div> : tomorrowBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c8c8c' }}>
              <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '10px' }}>☕</div>
              جدول الغد فارغ حتى الآن
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '10px', textAlign: 'right' }}>العميل</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>الوقت</th>
                </tr>
              </thead>
              <tbody>
                {tomorrowBookings.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{b.client_name}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#3498db' }} dir="ltr">{b.start_time} {Number(b.start_time.split(':')[0]) >= 12 ? 'م' : 'ص'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Today Bookings */}
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '2px solid rgba(157, 78, 221, 0.5)', paddingBottom: '10px' }}>
            <Calendar size={24} color="var(--color-vibrant-purple)" />
            <h3 style={{ margin: 0, color: '#fff' }}>مواعيد اليوم</h3>
          </div>
          {loading ? <div style={{ color: '#8c8c8c', textAlign: 'center', padding: '20px' }}>جاري التحميل...</div> : todayBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c8c8c' }}>
              <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '10px' }}>☕</div>
              جدول اليوم فارغ
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '10px', textAlign: 'right' }}>العميل</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>الوقت</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {todayBookings.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{b.client_name}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-vibrant-purple)' }} dir="ltr">{b.start_time} {Number(b.start_time.split(':')[0]) >= 12 ? 'م' : 'ص'}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem' }}>
                        {b.status || 'مؤكد'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Due Tasks & Reminders */}
      <div className="admin-card" style={{ borderTop: '4px solid #f1c40f' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={24} color="#f1c40f" />
            <h3 style={{ margin: 0, color: '#fff' }}>مهام والتزامات مستحقة الآن</h3>
          </div>
          <button className="btn-modern" style={{ background: '#f1c40f', color: '#000', fontWeight: 'bold', padding: '8px 20px', borderRadius: '50px' }}>
            إدارة المهام
          </button>
        </div>

        {loading ? <div style={{ color: '#8c8c8c', textAlign: 'center', padding: '20px' }}>جاري التحميل...</div> : dueTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c' }}>
            لا توجد مهام مستحقة حالياً.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '15px', textAlign: 'right' }}>المهمة</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>المبلغ</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>الاستحقاق</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {dueTasks.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{t.title}</td>
                    <td style={{ padding: '15px', textAlign: 'center', color: '#2ecc71', fontWeight: 'bold' }}>
                      {t.amount > 0 ? `${t.amount} ج.م` : '-'}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center', color: '#c0c0c0' }} dir="ltr">
                      {format(new Date(t.due_date), 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleCompleteTask(t.id, t.is_recurring, t.due_date)}
                        style={{ background: '#198754', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        <CheckCircle size={16} /> إنجاز
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default ERPDashboard;
