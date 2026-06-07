import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, PlusCircle, Trash2, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
// CSS is handled in ERPLayout.css

const ERPFinance = () => {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    client_name: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    payment_method: 'كاش'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Payments
    const { data: pData } = await supabase
      .from('payments')
      .select('*')
      .order('id', { ascending: false });
    
    // Fetch Clients for dropdown
    const { data: cData } = await supabase
      .from('clients')
      .select('name');

    if (pData) setPayments(pData);
    if (cData) setClients(cData);
    
    setLoading(false);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('payments')
      .insert([{
        client_name: newPayment.client_name,
        amount: Number(newPayment.amount),
        notes: newPayment.notes,
        payment_method: newPayment.payment_method,
        // Since there might not be a date column in the original schema, we use created_at or explicitly date if added.
        // Assuming we rely on Supabase's default created_at, but we can pass date if the schema supports it.
        created_at: new Date(newPayment.date).toISOString()
      }]);

    if (!error) {
      fetchData();
      setIsModalOpen(false);
      setNewPayment({ client_name: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '', payment_method: 'كاش' });
      
      // Update Client Debt implicitly if we had a trigger, but for now we just record the payment.
    } else {
      console.error(error);
      alert('حدث خطأ أثناء حفظ الدفعة');
    }
  };

  const deletePayment = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل المالي؟')) {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (!error) fetchData();
    }
  };

  const filteredPayments = payments.filter(p => 
    p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div>
      <div className="erp-header">
        <div>
          <h2>الحسابات المالية</h2>
          <p>إدارة المدفوعات والإيرادات للعملاء.</p>
        </div>
        <button className="erp-btn-primary" onClick={() => setIsModalOpen(true)}>
          <PlusCircle size={18} /> تسجيل دفعة جديدة
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="erp-card" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'rgba(46, 204, 113, 0.1)', padding: '15px', borderRadius: '12px', color: '#2ecc71' }}>
            <DollarSign size={30} />
          </div>
          <div>
            <p style={{ color: 'var(--erp-text-muted)', margin: 0, fontWeight: 'bold' }}>إجمالي الإيرادات (للبحث الحالي)</p>
            <h3 style={{ margin: '5px 0 0 0', fontSize: '1.8rem', color: 'var(--erp-text-main)' }}>{totalRevenue.toLocaleString()} ج.م</h3>
          </div>
        </div>
      </div>

      <div className="erp-card">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--erp-text-muted)' }} />
            <input 
              type="text" 
              placeholder="ابحث عن دفعة باسم العميل أو الملاحظات..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="erp-input"
              style={{ paddingRight: '45px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--erp-text-muted)' }}>جاري تحميل البيانات المالية...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'right' }}>التاريخ</th>
                  <th style={{ textAlign: 'right' }}>العميل</th>
                  <th style={{ textAlign: 'center' }}>المبلغ</th>
                  <th style={{ textAlign: 'right' }}>طريقة الدفع</th>
                  <th style={{ textAlign: 'right' }}>ملاحظات</th>
                  <th style={{ textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(payment => (
                  <tr key={payment.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <Calendar size={14} color="var(--erp-text-muted)" />
                        {payment.created_at ? format(new Date(payment.created_at), 'dd MMM yyyy', { locale: ar }) : '-'}
                      </div>
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--erp-primary)' }}>{payment.client_name}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#2ecc71' }}>
                      +{payment.amount} ج.م
                    </td>
                    <td style={{ color: 'var(--erp-text-muted)' }}>{payment.payment_method || 'غير محدد'}</td>
                    <td style={{ color: 'var(--erp-text-muted)' }}>{payment.notes || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => deletePayment(payment.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="حذف الدفعة">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--erp-text-muted)' }}>لا توجد مدفوعات متاحة.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add Payment */}
      {isModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()}>
            <h3>تسجيل دفعة جديدة</h3>
            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="erp-label">العميل</label>
                <select className="erp-input" value={newPayment.client_name} onChange={e => setNewPayment({...newPayment, client_name: e.target.value})} required>
                  <option value="">-- اختر العميل --</option>
                  {clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="erp-label">المبلغ المدفوع (ج.م)</label>
                <input type="number" className="erp-input" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} required />
              </div>

              <div>
                <label className="erp-label">طريقة الدفع</label>
                <select className="erp-input" value={newPayment.payment_method} onChange={e => setNewPayment({...newPayment, payment_method: e.target.value})} required>
                  <option value="كاش">كاش (نقدي)</option>
                  <option value="إنستاباي (InstaPay)">إنستاباي (InstaPay)</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                </select>
              </div>

              <div>
                <label className="erp-label">التاريخ</label>
                <input type="date" className="erp-input" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} required />
              </div>

              <div>
                <label className="erp-label">ملاحظات (اختياري)</label>
                <input type="text" className="erp-input" value={newPayment.notes} onChange={e => setNewPayment({...newPayment, notes: e.target.value})} placeholder="رقم التحويل أو أي ملاحظة..." />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="erp-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>حفظ الدفعة</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="erp-btn-danger" style={{ flex: 1, justifyContent: 'center' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ERPFinance;
