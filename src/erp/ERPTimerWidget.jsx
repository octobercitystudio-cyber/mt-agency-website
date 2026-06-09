import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, Play, Square, User } from 'lucide-react';
import { differenceInSeconds } from 'date-fns';

const ERPTimerWidget = () => {
  const [activeClient, setActiveClient] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    fetchState();
    const interval = setInterval(() => {
      fetchState(false);
    }, 10000); // Check remote state every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer;
    if (startTime && activeClient) {
      timer = setInterval(() => {
        setElapsed(differenceInSeconds(new Date(), new Date(startTime)));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [startTime, activeClient]);

  const fetchState = async (loadClients = true) => {
    if (loadClients) {
      const { data: c } = await supabase.from('clients').select('name').order('name');
      if (c) setClients(c.map(x => x.name));
    }
    
    // Fetch timer state
    const { data: tc } = await supabase.from('app_config').select('value').eq('key', 'timer_client').single();
    const { data: ts } = await supabase.from('app_config').select('value').eq('key', 'timer_start').single();
    
    const client = tc?.value || '';
    const start = ts?.value || '';
    
    setActiveClient(client);
    setStartTime(start ? new Date(start) : null);
    if (!client) setSelectedClient('');
  };

  const setRemoteState = async (client, start) => {
    // Upsert app_config
    const upsertConfig = async (key, value) => {
      const { data } = await supabase.from('app_config').select('id').eq('key', key).single();
      if (data) {
        await supabase.from('app_config').update({ value }).eq('id', data.id);
      } else {
        await supabase.from('app_config').insert([{ key, value, type: 'text' }]);
      }
    };
    
    await upsertConfig('timer_client', client);
    await upsertConfig('timer_start', start);
  };

  const handleToggle = async () => {
    if (activeClient) {
      // Stop
      if (window.confirm(`هل تريد إيقاف المؤقت للعميل ${activeClient}؟ الوقت المسجل: ${formatTime(elapsed)}`)) {
        await setRemoteState('', '');
        setActiveClient('');
        setStartTime(null);
        setSelectedClient('');
      }
    } else {
      // Start
      if (!selectedClient) {
        alert('الرجاء اختيار العميل أولاً');
        return;
      }
      const now = new Date().toISOString();
      await setRemoteState(selectedClient, now);
      setActiveClient(selectedClient);
      setStartTime(new Date(now));
    }
  };

  const formatTime = (totalSeconds) => {
    if (!totalSeconds || totalSeconds < 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ background: activeClient ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#fff', color: activeClient ? '#fff' : '#1e293b' }}>
      <div className="card-body p-4">
        <div className="row align-items-center">
          
          <div className="col-12 col-md-4 d-flex align-items-center mb-3 mb-md-0">
            <div className={`rounded-circle p-3 me-3 d-flex justify-content-center align-items-center ${activeClient ? 'bg-white text-success' : 'bg-light text-primary'}`} style={{ width: '50px', height: '50px' }}>
              <Clock size={24} />
            </div>
            <div>
              <h5 className="fw-bold mb-0">مؤقت جلسة التصوير</h5>
              <p className={`small mb-0 ${activeClient ? 'text-white-50' : 'text-muted'}`}>حساب وقت الجلسة الحية بدقة</p>
            </div>
          </div>

          <div className="col-12 col-md-4 mb-3 mb-md-0">
            {activeClient ? (
              <div className="text-center">
                <span className="badge bg-white text-success rounded-pill px-3 py-2 mb-2 d-inline-flex align-items-center">
                  <User size={14} className="me-1" /> جاري التصوير للعميل: {activeClient}
                </span>
                <div className="display-4 fw-bold" style={{ letterSpacing: '2px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(elapsed)}
                </div>
              </div>
            ) : (
              <select className="form-select border-0 bg-light p-3 rounded-4 shadow-sm fw-bold" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                <option value="">-- اختر العميل لبدء الجلسة --</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          <div className="col-12 col-md-4 text-md-end text-center">
            {activeClient ? (
              <button className="btn btn-light text-danger rounded-pill px-4 py-3 fw-bold shadow-sm w-100" onClick={handleToggle}>
                <Square size={18} className="me-2 mb-1" /> إيقاف الجلسة وحفظ الوقت
              </button>
            ) : (
              <button className="btn btn-primary rounded-pill px-4 py-3 fw-bold shadow-sm w-100" onClick={handleToggle} disabled={!selectedClient}>
                <Play size={18} className="me-2 mb-1" /> بدء الجلسة الآن
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ERPTimerWidget;
