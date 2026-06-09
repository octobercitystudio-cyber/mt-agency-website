import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Bell, AlertTriangle, Clock, CheckCircle, Package, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';

export const useGlobalAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data: clientsData } = await supabase.from('clients').select('name, dismissed_alerts');
      const { data: servicesData } = await supabase.from('services').select('*');
      const { data: bookingsData } = await supabase.from('bookings').select('*').not('service', 'like', '%(مؤرشف)%');
      const { data: remindersData } = await supabase.from('reminders').select('*').eq('status', 'pending');

      if (!clientsData || !servicesData || !bookingsData) return;

      let newAlerts = [];
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const daysToAdd = today.getDay() === 4 ? 2 : 1; // 4 is Thursday, skip Friday
      const tomorrowStr = format(addDays(today, daysToAdd), 'yyyy-MM-dd');

      // Helper to check dismissal
      const isDismissed = (clientName, alertId) => {
        const client = clientsData.find(c => c.name === clientName);
        if (!client || !client.dismissed_alerts) return false;
        return client.dismissed_alerts.includes(alertId);
      };

      // 1. Calculate Package Usage & Payments
      // Group active bookings by client and service
      const usageMap = {};
      bookingsData.forEach(b => {
        if (!b.client_name || !b.service) return;
        const key = `${b.client_name}_${b.service}`;
        if (!usageMap[key]) {
          usageMap[key] = {
            client: b.client_name, service: b.service, 
            used_h: 0, used_r: 0, paid: 0, 
            custom_price: -1, discount: 0
          };
        }
        if (b.status !== 'دفعة') {
          usageMap[key].used_h += (parseFloat(b.actual_hours) || 0);
          usageMap[key].used_r += (parseInt(b.actual_reels) || 0);
          usageMap[key].custom_price = Math.max(usageMap[key].custom_price, parseFloat(b.custom_price) || -1);
          usageMap[key].discount = Math.max(usageMap[key].discount, parseFloat(b.discount) || 0);
        } else {
          usageMap[key].paid += (parseFloat(b.payment) || 0);
        }
      });

      // Process Alerts from Usage Map
      Object.values(usageMap).forEach(usage => {
        const srv = servicesData.find(s => s.name === usage.service);
        if (!srv) return;

        // Check Debt
        const basePrice = parseFloat(srv.price) || 0;
        const finalPrice = usage.custom_price > -1 ? usage.custom_price : Math.max(0, basePrice - usage.discount);
        const debt = finalPrice - usage.paid;

        if (debt > 0) {
          let shouldAlertDebt = true;
          let extraMsg = '';

          // For Monthly packages, only alert if consumed hours reached the payment due threshold
          if (srv.category === 'باقة شهرية' && srv.payment_due_hours > 0) {
            if (usage.used_h >= srv.payment_due_hours) {
               shouldAlertDebt = true;
               extraMsg = ` (تجاوز ${srv.payment_due_hours} ساعات المستحقة للدفع)`;
            } else {
               shouldAlertDebt = false;
            }
          }

          if (shouldAlertDebt) {
            const alertId = `due_pkg_${usage.client}_${usage.service}`;
            if (!isDismissed(usage.client, alertId)) {
              newAlerts.push({
                id: alertId, client: usage.client, service: usage.service, type: 'payment',
                msg: `مديونية مستحقة بقيمة (${debt} ج.م)${extraMsg}`,
                icon: <DollarSign className="text-danger" size={18} />
              });
            }
          }
        }

        // Check Hours Remaining
        if (['باقة شهرية', 'باقة يومية', 'تصوير بالساعة'].includes(srv.category)) {
          const totalH = parseFloat(srv.total_hours) || 0;
          const remH = totalH - usage.used_h;
          if (remH > 0 && remH <= 2) {
            const alertId = `hrs_${usage.service}`;
            if (!isDismissed(usage.client, alertId)) {
              newAlerts.push({
                id: alertId, client: usage.client, service: usage.service, type: 'hours',
                msg: `الباقة أوشكت على الانتهاء (متبقي ${remH} ساعة)`,
                icon: <Clock className="text-warning" size={18} />
              });
            }
          }
        }
      });

      // 2. Check Deliveries
      bookingsData.forEach(b => {
        if (b.delivery_date === todayStr || b.delivery_date === tomorrowStr) {
          if (!b.status.includes('مؤرشف')) {
            const alertId = `del_${b.id}`;
            if (!isDismissed(b.client_name, alertId)) {
              newAlerts.push({
                id: alertId, client: b.client_name, service: b.service, type: 'delivery',
                msg: `موعد تسليم (${b.service}) هو يوم (${b.delivery_date})`,
                icon: <Package className="text-primary" size={18} />
              });
            }
          }
        }
      });

      // 3. Check Reminders
      if (remindersData) {
        remindersData.forEach(r => {
          const dueDt = new Date(r.due_date);
          const notifyDt = new Date(dueDt.getTime() - (r.notify_before * 60000));
          if (today >= notifyDt) {
            newAlerts.push({
              id: `task_alert_${r.id}`, client: 'تذكير إداري', service: r.type, type: r.type === 'مهمة' ? 'warning' : 'danger',
              msg: `⏰ ${r.title} ${r.amount > 0 ? `(بمبلغ ${r.amount} ج.م)` : ''} - مستحق: ${format(dueDt, 'hh:mm a | yyyy-MM-dd')}`,
              icon: <AlertTriangle className="text-danger" size={18} />
            });
          }
        });
      }

      setAlerts(newAlerts);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    // Poll every 5 minutes
    const interval = setInterval(fetchAlerts, 300000);
    return () => clearInterval(interval);
  }, []);

  const dismissAlert = async (clientName, alertId) => {
    if (clientName === 'تذكير إداري') {
      // For reminders, we just filter it out locally if user wants to dismiss without completing
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      return;
    }

    const { data: cData } = await supabase.from('clients').select('id, dismissed_alerts').eq('name', clientName).single();
    if (cData) {
      const curr = cData.dismissed_alerts || "";
      if (!curr.includes(alertId)) {
        const newVal = curr ? `${curr},${alertId}` : alertId;
        await supabase.from('clients').update({ dismissed_alerts: newVal }).eq('id', cData.id);
      }
    }
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  return { alerts, loading, fetchAlerts, dismissAlert };
};

// Offcanvas Component
import { DollarSign, X } from 'lucide-react';

export const NotificationsOffcanvas = ({ isOpen, onClose, alerts, onDismiss }) => {
  return (
    <>
      {isOpen && <div className="offcanvas-backdrop fade show" onClick={onClose} style={{zIndex: 1040}}></div>}
      <div className={`offcanvas offcanvas-end ${isOpen ? 'show' : ''}`} tabIndex="-1" style={{zIndex: 1045, width: '380px'}}>
        <div className="offcanvas-header bg-dark text-white border-bottom p-4">
          <h5 className="offcanvas-title fw-bold m-0 d-flex align-items-center">
            <Bell className="me-2 text-warning" size={24} /> مركز الإشعارات والتنبيهات
          </h5>
          <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
        </div>
        <div className="offcanvas-body p-0" style={{background: '#f8fafc', direction: 'rtl'}}>
          
          {alerts.length === 0 ? (
            <div className="text-center py-5">
              <CheckCircle size={50} style={{color: 'var(--erp-success)', opacity: 0.5, marginBottom: '15px'}} />
              <h5 className="fw-bold text-muted">لا توجد إشعارات جديدة</h5>
              <p className="text-muted mb-0">تم مراجعة كافة التنبيهات.</p>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {alerts.map((alert, idx) => (
                <div key={`${alert.id}_${idx}`} className="list-group-item list-group-item-action p-4 border-bottom position-relative hover- transition-all">
                  <button onClick={() => onDismiss(alert.client, alert.id)} className="btn btn-sm btn-link position-absolute top-0 end-0 mt-2 me-2 text-muted p-1 hover-danger" title="تجاهل">
                    <X size={16} />
                  </button>
                  <div className="d-flex gap-3">
                    <div className="mt-1">
                      {alert.icon}
                    </div>
                    <div>
                      <h6 className="fw-bold mb-1 text-dark" style={{paddingLeft: '20px'}}>{alert.client} <span className="text-muted fw-normal">({alert.service})</span></h6>
                      <p className="mb-0 text-muted" style={{fontSize: '0.9rem', lineHeight: '1.5'}}>{alert.msg}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
      <style>{`
        .hover-:hover { background-color: #f1f5f9 !important; }
        .hover-danger:hover { color: var(--erp-danger) !important; background: rgba(239, 68, 68, 0.1); border-radius: 5px; }
        .transition-all { transition: all 0.2s ease-in-out; }
      `}</style>
    </>
  );
};
