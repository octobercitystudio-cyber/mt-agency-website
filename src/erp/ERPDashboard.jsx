import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Truck, DollarSign, TrendingUp, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import ERPTimerWidget from './ERPTimerWidget';
import './ERPLayout.css';

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const dayOfWeek = new Date().getDay();
      const daysToAdd = dayOfWeek === 4 ? 2 : 1;
      const tomorrowStr = format(addDays(new Date(), daysToAdd), 'yyyy-MM-dd');
      const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      const currentMonth = format(new Date(), 'yyyy-MM');

      // 1. Fetch Finance
      const { data: financeData } = await supabase.from('finance').select('*').like('date', `${currentMonth}%`);
      let realInc = 0; let realExp = 0;
      if (financeData) {
        financeData.forEach(f => {
          if (['إيراد', 'سداد سلفة'].includes(f.type)) realInc += Number(f.amount || 0);
          if (['مصروف', 'سحب سلفة'].includes(f.type)) realExp += Number(f.amount || 0);
        });
      }
      const netProfit = realInc - realExp;

      // 2. Deliveries
      const { data: deliveriesData } = await supabase.from('bookings').select('id').gte('delivery_date', todayStr).lte('delivery_date', nextWeekStr).not('status', 'like', '%مؤرشف%').neq('delivery_date', null).neq('delivery_date', '');
      const weekDeliveries = deliveriesData ? deliveriesData.length : 0;

      // 3. Packages and Debts
      const { data: bookingsData } = await supabase.from('bookings').select('client_name, service, actual_hours, actual_reels, custom_price, discount, payment, status').neq('status', 'دفعة');
      const { data: servicesData } = await supabase.from('services').select('*');
        
      let activePackages = 0;
      let marketDues = 0;

      if (bookingsData && servicesData) {
        const grouped = {};
        bookingsData.forEach(b => {
          const key = `${b.client_name}_${b.service}`;
          if (!grouped[key]) grouped[key] = { client: b.client_name, service: b.service, used_h: 0, used_r: 0, custom_price: -1, discount: 0, paid: 0, is_archived: b.service.includes('مؤرشف') };
          grouped[key].used_h += Number(b.actual_hours || 0);
          grouped[key].used_r += Number(b.actual_reels || 0);
          if (Number(b.custom_price) > -1) grouped[key].custom_price = Math.max(grouped[key].custom_price, Number(b.custom_price));
          grouped[key].discount = Math.max(grouped[key].discount, Number(b.discount || 0));
        });

        const { data: paymentsData } = await supabase.from('bookings').select('*').eq('status', 'دفعة');
        if (paymentsData) {
          paymentsData.forEach(p => {
            const key = `${p.client_name}_${p.service}`;
            if (grouped[key]) grouped[key].paid += Number(p.payment || 0);
          });
        }

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
            marketDues += Math.max(0, price - g.paid);
          }
        });
      }

      setStats({ activePackages, weekDeliveries, marketDues, netProfit });

      // 4. Bookings
      const { data: tdyBkgs } = await supabase.from('bookings').select('*').eq('date', todayStr).neq('status', 'دفعة').neq('start_time', '').order('start_time', { ascending: true });
      const { data: tmrwBkgs } = await supabase.from('bookings').select('*').eq('date', tomorrowStr).neq('status', 'دفعة').neq('start_time', '').order('start_time', { ascending: true });
      setTodayBookings(tdyBkgs || []);
      setTomorrowBookings(tmrwBkgs || []);

      // 5. Tasks
      const { data: tasksData } = await supabase.from('reminders').select('*').eq('status', 'pending').order('due_date', { ascending: true });
      const due = [];
      const now = new Date();
      if (tasksData) {
        tasksData.forEach(t => {
          if (t.due_date) {
            const dueDate = new Date(t.due_date);
            const notifyDate = new Date(dueDate.getTime() - (t.notify_before || 0) * 60000);
            if (now >= notifyDate) due.push(t);
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

  useEffect(() => { loadDashboardData(); }, []);

  const handleCompleteTask = async (id, isRecurring, dueDateStr) => {
    if (isRecurring) {
      const dueDate = new Date(dueDateStr);
      dueDate.setMonth(dueDate.getMonth() + 1);
      await supabase.from('reminders').update({ due_date: dueDate.toISOString() }).eq('id', id);
    } else {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', id);
    }
    loadDashboardData();
  };

  return (
    <div style={{ padding: '0' }} className="container-fluid">
      
      {/* Top Banner exactly like the light aesthetic */}
      <div style={{ background: 'var(--erp-surface)', borderRadius: '20px', padding: '30px', border: '1px solid var(--erp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', boxShadow: 'var(--erp-shadow)' }}>
        <div>
          <div style={{ background: 'rgba(67, 24, 255, 0.1)', color: 'var(--erp-primary)', padding: '5px 15px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '15px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚡</span> نظام الإدارة الذكي
          </div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: '2.5rem', color: 'var(--erp-text-main)', display: 'flex', alignItems: 'center', gap: '15px' }}>
            لوحة تحكم MT Agency
          </h1>
          <p style={{ margin: '10px 0 0 0', color: 'var(--erp-text-muted)', fontSize: '1.1rem', fontWeight: '600' }}>مرحباً بك مجدداً ! Owner - October City Studio</p>
        </div>
        <div style={{ background: 'var(--erp-bg)', padding: '20px 30px', borderRadius: '20px', textAlign: 'center', border: '1px solid var(--erp-border)' }}>
          <div style={{ fontSize: '1rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>
            {format(currentTime, 'EEEE, d MMMM yyyy', { locale: ar })}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--erp-primary)' }}>
            {format(currentTime, 'hh:mm:ss')}
            <span style={{ fontSize: '1.2rem', marginRight: '5px' }}>{format(currentTime, 'aa', { locale: ar })}</span>
          </div>
        </div>
      </div>
      <ERPTimerWidget />

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: 'var(--erp-surface)', borderRadius: '15px', padding: '20px', border: '1px solid var(--erp-border)', boxShadow: 'var(--erp-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.3s' }} className="hover-elevate">
          <div>
            <p style={{ color: 'var(--erp-text-muted)', margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 'bold' }}>باقات نشطة</p>
            <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--erp-text-main)', fontWeight: '800' }}>{loading ? '...' : stats.activePackages}</h3>
          </div>
          <div style={{ background: 'rgba(67, 24, 255, 0.1)', padding: '15px', borderRadius: '50%', color: 'var(--erp-primary)' }}>
            <Package size={28} />
          </div>
        </div>

        <div style={{ background: 'var(--erp-surface)', borderRadius: '15px', padding: '20px', border: '1px solid var(--erp-border)', boxShadow: 'var(--erp-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.3s' }} className="hover-elevate">
          <div>
            <p style={{ color: 'var(--erp-text-muted)', margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 'bold' }}>تسليمات (أسبوع)</p>
            <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--erp-text-main)', fontWeight: '800' }}>{loading ? '...' : stats.weekDeliveries}</h3>
          </div>
          <div style={{ background: 'rgba(13, 202, 240, 0.15)', padding: '15px', borderRadius: '50%', color: '#0dcaf0' }}>
            <Truck size={28} />
          </div>
        </div>

        <div style={{ background: 'var(--erp-surface)', borderRadius: '15px', padding: '20px', border: '1px solid var(--erp-border)', boxShadow: 'var(--erp-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.3s' }} className="hover-elevate">
          <div>
            <p style={{ color: 'var(--erp-text-muted)', margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 'bold' }}>مستحقات السوق</p>
            <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--erp-warning)', fontWeight: '800' }}>{loading ? '...' : stats.marketDues.toLocaleString()}</h3>
          </div>
          <div style={{ background: 'rgba(255, 193, 7, 0.15)', padding: '15px', borderRadius: '50%', color: 'var(--erp-warning)' }}>
            <DollarSign size={28} />
          </div>
        </div>

        <div style={{ background: 'var(--erp-surface)', borderRadius: '15px', padding: '20px', border: '1px solid var(--erp-border)', boxShadow: 'var(--erp-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.3s' }} className="hover-elevate">
          <div>
            <p style={{ color: 'var(--erp-text-muted)', margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 'bold' }}>صافي الربح</p>
            <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--erp-success)', fontWeight: '800' }}>{loading ? '...' : stats.netProfit.toLocaleString()}</h3>
          </div>
          <div style={{ background: 'rgba(25, 135, 84, 0.15)', padding: '15px', borderRadius: '50%', color: 'var(--erp-success)' }}>
            <TrendingUp size={28} />
          </div>
        </div>
      </div>

      {/* Bookings Tables (Today & Tomorrow) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '30px' }}>
        
        {/* Today Bookings */}
        <div style={{ background: 'var(--erp-surface)', borderRadius: '20px', padding: '0', border: '1px solid var(--erp-border)', boxShadow: 'var(--erp-shadow)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', borderBottom: '1px solid var(--erp-border)', background: 'var(--erp-bg)' }}>
            <div style={{ background: 'rgba(67, 24, 255, 0.1)', padding: '10px', borderRadius: '12px', color: 'var(--erp-primary)' }}>
              <Clock size={20} />
            </div>
            <h4 style={{ margin: 0, color: 'var(--erp-text-main)', fontWeight: 'bold' }}>مواعيد اليوم</h4>
          </div>
          <div style={{ padding: '0' }}>
            {loading ? <div style={{ color: 'var(--erp-text-muted)', textAlign: 'center', padding: '30px', fontWeight: 'bold' }}>جاري التحميل...</div> : todayBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--erp-text-muted)', fontWeight: 'bold' }}>
                <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '10px' }}>☕</div>
                جدول اليوم فارغ
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--erp-text-main)' }}>
                <thead>
                  <tr style={{ background: 'var(--erp-bg)' }}>
                    <th style={{ padding: '15px 20px', textAlign: 'right', borderBottom: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>العميل</th>
                    <th style={{ padding: '15px 20px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>الوقت</th>
                    <th style={{ padding: '15px 20px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {todayBookings.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--erp-border)', transition: 'background 0.2s' }} className="hover-row">
                      <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{b.client_name}</td>
                      <td style={{ padding: '15px 20px', textAlign: 'center', color: 'var(--erp-primary)', fontWeight: 'bold', direction: 'ltr' }}>{b.start_time} {Number(b.start_time.split(':')[0]) >= 12 ? 'م' : 'ص'}</td>
                      <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                        <span style={{ background: 'rgba(25, 135, 84, 0.1)', color: 'var(--erp-success)', padding: '6px 15px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
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

        {/* Tomorrow Bookings */}
        <div style={{ background: 'var(--erp-surface)', borderRadius: '20px', padding: '0', border: '1px solid var(--erp-border)', boxShadow: 'var(--erp-shadow)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', borderBottom: '1px solid var(--erp-border)', background: 'var(--erp-bg)' }}>
            <div style={{ background: 'rgba(13, 202, 240, 0.1)', padding: '10px', borderRadius: '12px', color: '#0dcaf0' }}>
              <Calendar size={20} />
            </div>
            <h4 style={{ margin: 0, color: 'var(--erp-text-main)', fontWeight: 'bold' }}>مواعيد غداً</h4>
          </div>
          <div style={{ padding: '0' }}>
            {loading ? <div style={{ color: 'var(--erp-text-muted)', textAlign: 'center', padding: '30px', fontWeight: 'bold' }}>جاري التحميل...</div> : tomorrowBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--erp-text-muted)', fontWeight: 'bold' }}>
                <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '10px' }}>☕</div>
                جدول الغد فارغ حتى الآن
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--erp-text-main)' }}>
                <thead>
                  <tr style={{ background: 'var(--erp-bg)' }}>
                    <th style={{ padding: '15px 20px', textAlign: 'right', borderBottom: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>العميل</th>
                    <th style={{ padding: '15px 20px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {tomorrowBookings.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--erp-border)', transition: 'background 0.2s' }} className="hover-row">
                      <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{b.client_name}</td>
                      <td style={{ padding: '15px 20px', textAlign: 'center', color: '#0dcaf0', fontWeight: 'bold', direction: 'ltr' }}>{b.start_time} {Number(b.start_time.split(':')[0]) >= 12 ? 'م' : 'ص'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Due Tasks & Reminders */}
      <div style={{ background: 'var(--erp-surface)', borderRadius: '20px', padding: '0', border: '1px solid var(--erp-warning)', boxShadow: '0 10px 30px rgba(255, 193, 7, 0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid var(--erp-border)', background: 'rgba(255, 193, 7, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={24} color="var(--erp-warning)" />
            <h4 style={{ margin: 0, color: 'var(--erp-text-main)', fontWeight: 'bold' }}>مهام والتزامات مستحقة الآن</h4>
          </div>
          <button style={{ background: 'var(--erp-warning)', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(255, 193, 7, 0.2)' }}>
            إدارة المهام
          </button>
        </div>

        <div style={{ padding: '0' }}>
          {loading ? <div style={{ color: 'var(--erp-text-muted)', textAlign: 'center', padding: '30px', fontWeight: 'bold' }}>جاري التحميل...</div> : dueTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--erp-text-muted)', fontWeight: 'bold' }}>
              لا توجد مهام مستحقة حالياً. الأمور كلها ممتازة!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--erp-text-main)' }}>
                <thead>
                  <tr style={{ background: 'var(--erp-bg)', borderBottom: '1px solid var(--erp-border)' }}>
                    <th style={{ padding: '15px 25px', textAlign: 'right', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>المهمة</th>
                    <th style={{ padding: '15px 25px', textAlign: 'center', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>المبلغ</th>
                    <th style={{ padding: '15px 25px', textAlign: 'center', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>الاستحقاق</th>
                    <th style={{ padding: '15px 25px', textAlign: 'center', color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {dueTasks.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--erp-border)', transition: 'background 0.2s' }} className="hover-row">
                      <td style={{ padding: '20px 25px', fontWeight: 'bold', fontSize: '1.1rem' }}>{t.title}</td>
                      <td style={{ padding: '20px 25px', textAlign: 'center', color: 'var(--erp-success)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                        {t.amount > 0 ? `${t.amount} ج.م` : '-'}
                      </td>
                      <td style={{ padding: '20px 25px', textAlign: 'center', color: 'var(--erp-text-muted)', fontWeight: 'bold', direction: 'ltr' }}>
                        {format(new Date(t.due_date), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td style={{ padding: '20px 25px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleCompleteTask(t.id, t.is_recurring, t.due_date)}
                          style={{ background: 'var(--erp-success)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(25, 135, 84, 0.2)' }}
                        >
                          <CheckCircle size={18} /> إنجاز
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

    </div>
  );
};

export default ERPDashboard;
