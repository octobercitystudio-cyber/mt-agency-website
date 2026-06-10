import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { StopCircle, Play, X, Save } from 'lucide-react';
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

  useEffect(() => {
    fetchActiveSession();
    fetchServices();

    const handleUpdate = () => fetchActiveSession();
    window.addEventListener('sessionTimerUpdated', handleUpdate);

    // Fallback polling just in case Realtime isn't fully enabled on this table
    const pollInterval = setInterval(fetchActiveSession, 15000);

    // Setup realtime subscription
    const subscription = supabase
      .channel('public:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, payload => {
        // If a new active timer is created or updated
        if (payload.new && payload.new.status === 'active_timer') {
          setActiveSession(payload.new);
        }
        // If the active timer is stopped/deleted
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
      // Calculate initial elapsed based on notes (start timestamp)
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

  const openManageModal = () => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    setEditHours(h);
    setEditMinutes(m);
    // If we have client packages, ideally we'd filter `services` to only what the client owns,
    // but the admin can select any service here for flexibility.
    setSelectedService('');
    setIsModalOpen(true);
  };

  const handleStopAndSave = async () => {
    if (!selectedService) {
      alert('يرجى تحديد الباقة / الخدمة');
      return;
    }
    
    setIsSaving(true);
    const finalHours = parseFloat(editHours) + (parseFloat(editMinutes) / 60);
    
    try {
      const { error } = await supabase.from('bookings').update({
        status: 'مكتمل', // Session is now complete and should be deducted
        actual_hours: finalHours,
        service: selectedService,
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: `وقت البدء: ${format(new Date(activeSession.notes), 'yyyy-MM-dd HH:mm:ss')} | تم إيقاف وحفظ المؤقت`
      }).eq('id', activeSession.id);

      if (error) {
        console.error(error);
        alert('حدث خطأ أثناء الحفظ');
      } else {
        setActiveSession(null);
        setIsModalOpen(false);
      }
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

  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: '85px',
        left: '50%',
        transform: 'translateX(-50%)',
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
                <input type="number" className="form-control" min="0" value={editHours} onChange={e => setEditHours(e.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label">عدد الدقائق</label>
                <input type="number" className="form-control" min="0" max="59" value={editMinutes} onChange={e => setEditMinutes(e.target.value)} />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">الباقة / الخدمة التي سيتم الخصم منها</label>
              <select className="form-select" value={selectedService} onChange={e => setSelectedService(e.target.value)}>
                <option value="">-- اختر الباقة --</option>
                {services.map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.category})</option>
                ))}
              </select>
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
