import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, PlusCircle, Trash2, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import '../admin/AdminLayout.css';

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
    <div className="admin-section">
      <div className="admin-header">
        <div>
          <h2>الحسابات المالية</h2>
          <p>إدارة المدفوعات والإيرادات للعملاء.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <PlusCircle size={18} /> تسجيل دفعة جديدة
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'rgba(46, 204, 113, 0.2)', padding: '15px', borderRadius: '12px', color: '#2ecc71' }}>
            <DollarSign size={30} />
          </div>
          <div>
            <p style={{ color: '#8c8c8c', margin: 0 }}>إجمالي الإيرادات (للبحث الحالي)</p>
            <h3 style={{ margin: '5px 0 0 0', fontSize: '1.8rem', color: '#fff' }}>{totalRevenue.toLocaleString()} ج.م</h3>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c' }} />
            <input 
              type="text" 
              placeholder="ابحث عن دفعة باسم العميل أو الملاحظات..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-input"
              style={{ paddingRight: '45px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8c8c8c' }}>جاري تحميل البيانات المالية...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '15px', textAlign: 'right' }}>التاريخ</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>العميل</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>المبلغ</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>طريقة الدفع</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>ملاحظات</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(payment => (
                  <tr key={payment.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={14} color="#8c8c8c" />
                        {payment.created_at ? format(new Date(payment.created_at), 'dd MMM yyyy', { locale: ar }) : '-'}
                      </div>
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: 'var(--color-vibrant-purple)' }}>{payment.client_name}</td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#2ecc71' }}>
                      +{payment.amount} ج.م
                    </td>
                    <td style={{ padding: '15px', color: '#c0c0c0' }}>{payment.payment_method || 'غير محدد'}</td>
                    <td style={{ padding: '15px', color: '#c0c0c0' }}>{payment.notes || '-'}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button onClick={() => deletePayment(payment.id)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }} title="حذف الدفعة">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#8c8c8c' }}>لا توجد مدفوعات متاحة.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add Payment */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="admin-card" style={{ width: '90%', maxWidth: '500px', background: 'var(--bg-dark)' }}>
            <h3 style={{ marginBottom: '20px' }}>تسجيل دفعة جديدة</h3>
            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>العميل</label>
                <select className="admin-input" value={newPayment.client_name} onChange={e => setNewPayment({...newPayment, client_name: e.target.value})} required>
                  <option value="">-- اختر العميل --</option>
                  {clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>المبلغ المدفوع (ج.م)</label>
                <input type="number" className="admin-input" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} required />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>طريقة الدفع</label>
                <select className="admin-input" value={newPayment.payment_method} onChange={e => setNewPayment({...newPayment, payment_method: e.target.value})} required>
                  <option value="كاش">كاش (نقدي)</option>
                  <option value="إنستاباي (InstaPay)">إنستاباي (InstaPay)</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>التاريخ</label>
                <input type="date" className="admin-input" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} required />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>ملاحظات (اختياري)</label>
                <input type="text" className="admin-input" value={newPayment.notes} onChange={e => setNewPayment({...newPayment, notes: e.target.value})} placeholder="رقم التحويل أو أي ملاحظة..." />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>حفظ الدفعة</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary" style={{ flex: 1 }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ERPFinance;
