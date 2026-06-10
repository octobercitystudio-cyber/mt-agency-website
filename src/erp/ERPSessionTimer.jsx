import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { StopCircle, Play, X, Save, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const ERPSessionTimer = () => {
  const [activeSession, setActiveSession] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit state
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // New logic states
  const [isReels, setIsReels] = useState(false);
  const [actualReels, setActualReels] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [remainingHours, setRemainingHours] = useState(0);
  const [overageAction, setOverageAction] = useState('current'); // 'current' or 'split'

  useEffect(() => {
    fetchActiveSession();
    fetchServices();

    const handleUpdate = () => fetchActiveSession();
    window.addEventListener('sessionTimerUpdated', handleUpdate);

    const pollInterval = setInterval(fetchActiveSession, 15000);

    const subscription = supabase
      .channel('public:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, payload => {
        if (payload.new && payload.new.status === 'active_timer') {
          setActiveSession(payload.new);
        }
        if ((payload.old && payload.old.status === 'active_timer' && payload.new && payload.new.status !== 'active_timer') || 
            (payload.eventType === 'DELETE' && activeSession && payload.old.id === activeSession.id)) {
          setActiveSession(null);
          setIsModalOpen(false);
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('sessionTimerUpdated', handleUpdate);
      clearInterval(pollInterval);
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'active_timer')
        .order('id', { ascending: false })
        .limit(1);
      
      if (!error && data && data.length > 0) {
        setActiveSession(data[0]);
      } else {
        setActiveSession(null);
      }
    } catch (e) {
      console.error('Error fetching session:', e);
    }
  };

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*');
    if (data) setServices(data);
  };

  useEffect(() => {
    let interval = null;
    if (activeSession) {
      const startMs = new Date(activeSession.notes).getTime();
      
      const updateTimer = () => {
        const nowMs = new Date().getTime();
        const diffSecs = Math.floor((nowMs - startMs) / 1000);
        setElapsedSeconds(diffSecs > 0 ? diffSecs : 0);
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession]);

  const openManageModal = async () => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    setEditHours(h);
    setEditMinutes(m);

    if (activeSession) {
      const srvName = activeSession.service.replace(' (مؤرشف)', '');
      const srv = services.find(s => s.name === srvName);
      
      if (srv && srv.category === 'باقة ريلز') {
        setIsReels(true);
        setActualReels(0);
        setDeliveryDate(activeSession.delivery_date || format(new Date(), 'yyyy-MM-dd'));
      } else {
        setIsReels(false);
        setDeliveryDate(activeSession.delivery_date || format(new Date(new Date().getTime() + 86400000), 'yyyy-MM-dd')); // Tomorrow
        if (srv) {
          const { data: bData } = await supabase.from('bookings')
            .select('actual_hours')
            .eq('client_name', activeSession.client_name)
            .eq('service', activeSession.service)
            .neq('status', 'دفعة');
            
          let used = 0;
          bData?.forEach(b => { used += Number(b.actual_hours || 0); });
          const remaining = Number(srv.total_hours || 0) - used;
          setRemainingHours(remaining);
        } else {
          setRemainingHours(9999);
        }
      }
    }
    setIsModalOpen(true);
  };

  const handleStopAndSave = async () => {
    setIsSaving(true);
    const finalHours = parseFloat(editHours) + (parseFloat(editMinutes) / 60);
    
    try {
      const baseUpdate = {
        status: 'مكتمل',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: `وقت البدء: ${format(new Date(activeSession.notes), 'yyyy-MM-dd HH:mm:ss')} | تم إيقاف وحفظ المؤقت`,
        delivery_date: deliveryDate
      };

      if (isReels) {
        await supabase.from('bookings').update({
          ...baseUpdate,
          actual_reels: Number(actualReels)
        }).eq('id', activeSession.id);
      } else {
        if (finalHours > remainingHours && overageAction === 'split' && remainingHours > 0) {
          // Update current to remaining, insert new for the rest
          await supabase.from('bookings').update({
            ...baseUpdate,
            actual_hours: remainingHours
          }).eq('id', activeSession.id);

          await supabase.from('bookings').insert([{
            client_name: activeSession.client_name,
            service: 'تصوير بالساعة',
            date: baseUpdate.date,
            start_time: '',
            end_time: '',
            actual_hours: finalHours - remainingHours,
            custom_price: 0,
            discount: 0,
            status: 'مؤكد',
            delivery_date: deliveryDate,
            notes: 'تم توليدها تلقائياً كزيادة من جلسة المؤقت السابقة.'
          }]);
        } else {
          // Just save all on the current package (will show as negative balance)
          await supabase.from('bookings').update({
            ...baseUpdate,
            actual_hours: finalHours
          }).eq('id', activeSession.id);
        }
      }

      // Automatically create a reminder for delivery if it's tomorrow or later
      if (deliveryDate) {
         const dDate = new Date(deliveryDate);
         await supabase.from('reminders').insert([
           {
             title: `تسليم غداً لعميل: ${activeSession.client_name}`,
             description: `تجهيز وتسليم خدمة ${activeSession.service} الخاصة بجلسة المؤقت.`,
             due_date: dDate.toISOString(),
             notify_before: 1440, // 24 hours
             status: 'pending'
           },
           {
             title: `تسليم اليوم لعميل: ${activeSession.client_name} 🚨`,
             description: `موعد التسليم النهائي لخدمة ${activeSession.service} اليوم.`,
             due_date: dDate.toISOString(),
             notify_before: 0,
             status: 'pending'
           }
         ]);
      }

      setActiveSession(null);
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ بالاتصال');
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeSession) return null;

  const formatDisplayTime = (totalSecs) => {
    const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const s = String(totalSecs % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const finalHoursComputed = parseFloat(editHours || 0) + (parseFloat(editMinutes || 0) / 60);
  const isOverlimit = !isReels && finalHoursComputed > remainingHours;

  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: '85px',
        left: '20px',
        background: '#1e1b2e',
        border: '1px solid #332d4a',
        borderRadius: '50rem',
        padding: '10px 25px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        zIndex: 1040,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        direction: 'rtl'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', borderLeft: '1px solid #444', paddingLeft: '20px' }}>
          <div style={{ width: '12px', height: '12px', background: '#ff4757', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
          <div style={{ lineHeight: '1.2' }}>
            <span style={{ fontSize: '0.75rem', color: '#a3aed1' }}>تصوير جاري</span><br/>
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{activeSession.client_name}</span>
          </div>
        </div>
        
        <div style={{ color: '#ffb8b8', fontSize: '1.4rem', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px' }} dir="ltr">
          {formatDisplayTime(elapsedSeconds)}
        </div>

        <button 
          onClick={openManageModal}
          style={{
            background: '#ffb8b8',
            color: '#1e1b2e',
            border: 'none',
            padding: '8px 20px',
            borderRadius: '50rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <StopCircle size={18} /> إدارة الجلسة
        </button>
      </div>

      {isModalOpen && (
        <div className="erp-modal-overlay" style={{ zIndex: 1050 }}>
          <div className="erp-modal-content" style={{ maxWidth: '400px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 style={{ margin: 0, fontWeight: 'bold', color: '#ff4757', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StopCircle size={24} /> إيقاف الجلسة
              </h4>
              <button className="btn btn-sm btn-light" onClick={() => setIsModalOpen(false)}><X size={18}/></button>
            </div>
            
            <p className="text-muted mb-4">يمكنك تعديل الوقت المحسوب يدوياً قبل حفظه وخصمه من باقة العميل <strong>{activeSession.client_name}</strong>.</p>
            
            <div className="row mb-3">
              <div className="col-6">
                <label className="form-label">عدد الساعات</label>
                <input type="number" className="form-control" min="0" value={editHours} onChange={e => setEditHours(e.target.value)} disabled={isReels} />
              </div>
              <div className="col-6">
                <label className="form-label">عدد الدقائق</label>
                <input type="number" className="form-control" min="0" max="59" value={editMinutes} onChange={e => setEditMinutes(e.target.value)} disabled={isReels} />
              </div>
            </div>

            {isReels && (
              <div className="mb-3 p-3 rounded" style={{ background: 'rgba(67, 24, 255, 0.05)', border: '1px solid rgba(67, 24, 255, 0.2)' }}>
                <label className="form-label fw-bold text-primary">عدد الفيديوهات (الريلز) المصورة</label>
                <input type="number" className="form-control fw-bold text-center" min="0" value={actualReels} onChange={e => setActualReels(e.target.value)} />
              </div>
            )}

            {isOverlimit && (
              <div className="mb-3 p-3 rounded" style={{ background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.3)' }}>
                <label className="form-label fw-bold text-danger d-flex align-items-center gap-1"><AlertTriangle size={16}/> تجاوز الساعات المحددة للباقة!</label>
                <p className="small text-danger mb-2">لقد تخطى العميل الرصيد المتبقي للباقة ({remainingHours.toFixed(2)} س). طريقة المعالجة:</p>
                <select className="form-select form-select-sm" value={overageAction} onChange={e => setOverageAction(e.target.value)}>
                  <option value="current">تسجيل كل الساعات على الباقة الحالية (الرصيد سيكون بالسالب)</option>
                  <option value="split">فصل الزيادة وتسجيلها كـ "تصوير بالساعة" كخدمة جديدة</option>
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">تاريخ التسليم</label>
              <input type="date" className="form-control" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              {!isReels && <small className="text-muted">تم تحديد موعد التسليم تلقائياً لليوم التالي.</small>}
            </div>

            <div className="mb-4">
              <label className="form-label">الباقة المسجلة (تلقائي)</label>
              <div className="form-control" style={{ background: 'rgba(255,255,255,0.05)', color: '#a3aed1', border: '1px solid rgba(255,255,255,0.1)', cursor: 'not-allowed' }}>
                {activeSession.service}
              </div>
            </div>

            <div className="d-flex gap-2">
              <button 
                className="btn w-100 fw-bold" 
                style={{ background: '#ff4757', color: '#fff' }}
                onClick={handleStopAndSave}
                disabled={isSaving}
              >
                {isSaving ? 'جاري الحفظ...' : 'إيقاف وحفظ نهائي'} <Save size={18} className="ms-1"/>
              </button>
              <button 
                className="btn btn-light w-100 fw-bold" 
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                استكمال التصوير <Play size={18} className="ms-1"/>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
        }
      `}</style>
    </>
  );
};

export default ERPSessionTimer;
