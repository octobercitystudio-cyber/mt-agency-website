import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, PlusCircle, Trash2, Search, Calendar, Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Users, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';

const ERPFinance = () => {
  const [allTransactions, setAllTransactions] = useState([]);
  const [appConfig, setAppConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  
  // Modals States
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isAdjustDueModalOpen, setIsAdjustDueModalOpen] = useState(false);

  // Form States
  const [txForm, setTxForm] = useState({ type: 'إيراد', amount: '', method: 'كاش', detail: '', date: format(new Date(), 'yyyy-MM-dd'), entity: 'الشركة' });
  const [transferForm, setTransferForm] = useState({ from_method: 'كاش', to_method: 'فودافون كاش', amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
  const [settleForm, setSettleForm] = useState({ partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
  const [advanceForm, setAdvanceForm] = useState({ type: 'سحب سلفة', partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
  const [adjustDueForm, setAdjustDueForm] = useState({ partner: 'اشرف', new_due: '' });

  const methodsList = ['كاش', 'فودافون كاش', 'إنستاباي (InstaPay)', 'تحويل بنكي'];
  const partnersList = ['اشرف', 'مروة'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: fData } = await supabase.from('finance').select('*').order('date', { ascending: false }).order('id', { ascending: false });
    const { data: cData } = await supabase.from('app_config').select('*');
    
    if (fData) setAllTransactions(fData);
    
    if (cData) {
      const cfg = {};
      cData.forEach(c => cfg[c.key] = c.value);
      setAppConfig(cfg);
    }
    
    setLoading(false);
  };

  const safeFloat = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0.0 : parsed;
  };

  // Derived Calculations
  const calculations = useMemo(() => {
    let total_inc = 0;
    let total_exp = 0;
    
    let ashraf_e1 = 0; // مصروف, سداد سلفة
    let ashraf_e2 = 0; // سداد مستحقات, سحب سلفة
    let marwa_e1 = 0;
    let marwa_e2 = 0;
    
    const balances = { 'كاش': 0, 'فودافون كاش': 0, 'إنستاباي (InstaPay)': 0, 'تحويل بنكي': 0 };

    // Month filter transactions
    const monthTransactions = [];

    allTransactions.forEach(t => {
      const amt = safeFloat(t.amount);
      const isCurrentMonth = t.date && t.date.startsWith(selectedMonth);

      if (isCurrentMonth) {
        monthTransactions.push(t);
        
        // Month Income & Expense (for Net Profit)
        if (['إيراد', 'سداد سلفة'].includes(t.type)) {
          total_inc += amt;
        } else if (['مصروف', 'سحب سلفة'].includes(t.type)) {
          total_exp += amt;
        }
      }

      // Vault Balances (Global)
      const method = t.method || 'كاش';
      if (!balances[method]) balances[method] = 0;

      if (['إيراد', 'سداد سلفة', 'تحويل وارد'].includes(t.type)) {
        balances[method] += amt;
      } else if (['مصروف', 'تحويل صادر'].includes(t.type) && t.entity === 'الشركة') {
        balances[method] -= amt;
      } else if (['سداد مستحقات', 'سحب سلفة'].includes(t.type)) {
        balances[method] -= amt;
      }

      // Partner Dues (Global)
      if (t.entity === 'اشرف') {
        if (['مصروف', 'سداد سلفة'].includes(t.type)) ashraf_e1 += amt;
        if (['سداد مستحقات', 'سحب سلفة'].includes(t.type)) ashraf_e2 += amt;
      } else if (t.entity === 'مروة') {
        if (['مصروف', 'سداد سلفة'].includes(t.type)) marwa_e1 += amt;
        if (['سداد مستحقات', 'سحب سلفة'].includes(t.type)) marwa_e2 += amt;
      }
    });

    const net_profit = total_inc - total_exp;
    const ashraf_due = (ashraf_e1 - ashraf_e2) + safeFloat(appConfig['partner_اشرف_adj'] || 0);
    const marwa_due = (marwa_e1 - marwa_e2) + safeFloat(appConfig['partner_مروة_adj'] || 0);

    return { total_inc, total_exp, net_profit, balances, ashraf_due, marwa_due, monthTransactions };
  }, [allTransactions, appConfig, selectedMonth]);

  const { total_inc, total_exp, net_profit, balances, ashraf_due, marwa_due, monthTransactions } = calculations;

  const filteredTransactions = monthTransactions.filter(t => 
    t.detail?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.entity?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('finance').insert([{
      type: txForm.type,
      amount: safeFloat(txForm.amount),
      method: txForm.method,
      detail: txForm.detail,
      date: txForm.date,
      entity: txForm.type === 'مصروف' ? txForm.entity : 'الشركة'
    }]);

    if (!error) {
      setIsTxModalOpen(false);
      setTxForm({ type: 'إيراد', amount: '', method: 'كاش', detail: '', date: format(new Date(), 'yyyy-MM-dd'), entity: 'الشركة' });
      fetchData();
    } else {
      alert('حدث خطأ أثناء حفظ المعاملة');
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (transferForm.from_method === transferForm.to_method) {
      alert('لا يمكن التحويل لنفس المحفظة!');
      return;
    }
    const amt = safeFloat(transferForm.amount);
    const note = transferForm.note.trim() ? ` - ${transferForm.note}` : '';
    const detailOut = `تحويل صادر إلى ${transferForm.to_method}${note}`;
    const detailIn = `تحويل وارد من ${transferForm.from_method}${note}`;

    const { error: err1 } = await supabase.from('finance').insert([{ type: 'تحويل صادر', amount: amt, method: transferForm.from_method, detail: detailOut, date: transferForm.date, entity: 'الشركة' }]);
    const { error: err2 } = await supabase.from('finance').insert([{ type: 'تحويل وارد', amount: amt, method: transferForm.to_method, detail: detailIn, date: transferForm.date, entity: 'الشركة' }]);

    if (!err1 && !err2) {
      setIsTransferModalOpen(false);
      setTransferForm({ from_method: 'كاش', to_method: 'فودافون كاش', amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
      fetchData();
    }
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('finance').insert([{
      type: 'سداد مستحقات',
      amount: safeFloat(settleForm.amount),
      method: settleForm.method,
      detail: `سداد مستحقات أ. ${settleForm.partner}`,
      date: settleForm.date,
      entity: settleForm.partner
    }]);
    if (!error) {
      setIsSettleModalOpen(false);
      setSettleForm({ partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
      fetchData();
    }
  };

  const handleAdvance = async (e) => {
    e.preventDefault();
    const detail = advanceForm.type === 'سحب سلفة' ? `سحب سلفة لـ أ. ${advanceForm.partner}` : `سداد سلفة من أ. ${advanceForm.partner}`;
    const { error } = await supabase.from('finance').insert([{
      type: advanceForm.type,
      amount: safeFloat(advanceForm.amount),
      method: advanceForm.method,
      detail: detail,
      date: advanceForm.date,
      entity: advanceForm.partner
    }]);
    if (!error) {
      setIsAdvanceModalOpen(false);
      setAdvanceForm({ type: 'سحب سلفة', partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
      fetchData();
    }
  };

  const handleAdjustDue = async (e) => {
    e.preventDefault();
    const partner = adjustDueForm.partner;
    const new_due = safeFloat(adjustDueForm.new_due);
    
    // Recalculate base due
    let e1 = 0, e2 = 0;
    allTransactions.forEach(t => {
      if (t.entity === partner) {
        if (['مصروف', 'سداد سلفة'].includes(t.type)) e1 += safeFloat(t.amount);
        if (['سداد مستحقات', 'سحب سلفة'].includes(t.type)) e2 += safeFloat(t.amount);
      }
    });
    const base_due = e1 - e2;
    const new_adj = new_due - base_due;
    const adj_key = `partner_${partner}_adj`;

    const exists = appConfig[adj_key] !== undefined;
    let error;
    if (exists) {
      const res = await supabase.from('app_config').update({ value: new_adj.toString() }).eq('key', adj_key);
      error = res.error;
    } else {
      const res = await supabase.from('app_config').insert([{ key: adj_key, value: new_adj.toString() }]);
      error = res.error;
    }

    if (!error) {
      setIsAdjustDueModalOpen(false);
      setAdjustDueForm({ partner: 'اشرف', new_due: '' });
      fetchData();
    }
  };

  const deleteTransaction = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل المالي؟')) {
      const { error } = await supabase.from('finance').delete().eq('id', id);
      if (!error) fetchData();
    }
  };

  const changeMonth = (offset) => {
    const current = parseISO(`${selectedMonth}-01`);
    const newDate = offset > 0 ? addMonths(current, 1) : subMonths(current, 1);
    setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  const getTypeStyle = (type) => {
    if (['إيراد', 'سداد سلفة', 'تحويل وارد'].includes(type)) return { bg: '#d1e7dd', color: '#0f5132' };
    if (['مصروف', 'تحويل صادر', 'سحب سلفة', 'سداد مستحقات'].includes(type)) return { bg: '#f8d7da', color: '#842029' };
    return { bg: '#e2e3e5', color: '#41464b' };
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>جاري تحميل الحسابات...</div>;

  return (
    <div>
      {/* Header and Month Controls */}
      <div className="erp-header">
        <div>
          <h2>الإدارة المالية للشركة</h2>
          <p>إدارة الخزائن، الشركاء، المديونيات والأرباح</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => changeMonth(-1)} style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}>
            <ChevronRight size={18} />
          </button>
          <div style={{ background: 'var(--erp-primary)', color: 'white', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold' }}>
            {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: ar })}
          </div>
          <button onClick={() => changeMonth(1)} style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}>
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      {/* Global Financial Summaries (Current Month) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div className="erp-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)', color: 'white' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '15px', borderRadius: '12px' }}><TrendingUp size={30} /></div>
          <div>
            <p style={{ margin: 0, opacity: 0.8, fontWeight: 'bold' }}>صافي الأرباح (للشهر)</p>
            <h3 style={{ margin: '5px 0 0 0', fontSize: '1.8rem' }}>{net_profit.toLocaleString()} ج.م</h3>
          </div>
        </div>
        
        <div className="erp-card" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'rgba(52, 152, 219, 0.1)', padding: '15px', borderRadius: '12px', color: '#3498db' }}><DollarSign size={30} /></div>
          <div>
            <p style={{ color: 'var(--erp-text-muted)', margin: 0, fontWeight: 'bold' }}>إجمالي الإيرادات (للشهر)</p>
            <h3 style={{ margin: '5px 0 0 0', fontSize: '1.8rem', color: 'var(--erp-text-main)' }}>{total_inc.toLocaleString()} ج.م</h3>
          </div>
        </div>

        <div className="erp-card" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'rgba(231, 76, 60, 0.1)', padding: '15px', borderRadius: '12px', color: '#e74c3c' }}><TrendingDown size={30} /></div>
          <div>
            <p style={{ color: 'var(--erp-text-muted)', margin: 0, fontWeight: 'bold' }}>إجمالي المصروفات (للشهر)</p>
            <h3 style={{ margin: '5px 0 0 0', fontSize: '1.8rem', color: 'var(--erp-text-main)' }}>{total_exp.toLocaleString()} ج.م</h3>
          </div>
        </div>
      </div>

      {/* Vault Balances and Partner Dues */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {/* Vault Balances */}
        <div className="erp-card">
          <h4 style={{ marginBottom: '15px', color: 'var(--erp-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={20} /> أرصدة الخزائن (الفعلية)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #dee2e6' }}>
              <strong style={{ color: '#212529' }}>كاش (نقدي)</strong>
              <strong style={{ color: balances['كاش'] >= 0 ? '#198754' : '#dc3545', direction: 'ltr' }}>{balances['كاش']?.toLocaleString()} ج</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #dee2e6' }}>
              <strong style={{ color: '#212529' }}>فودافون كاش</strong>
              <strong style={{ color: balances['فودافون كاش'] >= 0 ? '#198754' : '#dc3545', direction: 'ltr' }}>{balances['فودافون كاش']?.toLocaleString()} ج</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #dee2e6' }}>
              <strong style={{ color: '#212529' }}>إنستاباي (InstaPay)</strong>
              <strong style={{ color: balances['إنستاباي (InstaPay)'] >= 0 ? '#198754' : '#dc3545', direction: 'ltr' }}>{balances['إنستاباي (InstaPay)']?.toLocaleString()} ج</strong>
            </div>
          </div>
        </div>

        {/* Partner Dues */}
        <div className="erp-card">
          <h4 style={{ marginBottom: '15px', color: 'var(--erp-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} /> مستحقات الشركاء المتبقية
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(52, 152, 219, 0.05)', borderRadius: '10px', border: '1px solid rgba(52, 152, 219, 0.2)' }}>
              <strong style={{ color: '#0d6efd' }}>أشرف السيد</strong>
              <strong style={{ color: ashraf_due >= 0 ? '#198754' : '#dc3545', direction: 'ltr' }}>{ashraf_due.toLocaleString()} ج</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(155, 89, 182, 0.05)', borderRadius: '10px', border: '1px solid rgba(155, 89, 182, 0.2)' }}>
              <strong style={{ color: '#6f42c1' }}>مروة أسامة</strong>
              <strong style={{ color: marwa_due >= 0 ? '#198754' : '#dc3545', direction: 'ltr' }}>{marwa_due.toLocaleString()} ج</strong>
            </div>
            <button onClick={() => setIsAdjustDueModalOpen(true)} style={{ marginTop: '10px', background: 'var(--erp-surface)', color: 'var(--erp-text-main)', border: '1px dashed var(--erp-border)', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
              تعديل يدوي لمستحقات الشركاء
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button className="erp-btn-primary" onClick={() => setIsTxModalOpen(true)}><PlusCircle size={18} /> عملية مالية (إيراد/مصروف)</button>
        <button style={{ background: '#0dcaf0', color: '#000', padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }} onClick={() => setIsTransferModalOpen(true)}><ArrowRightLeft size={18} /> تحويل بين المحافظ</button>
        <button style={{ background: '#198754', color: '#fff', padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }} onClick={() => setIsSettleModalOpen(true)}><DollarSign size={18} /> سداد مستحقات شريك</button>
        <button style={{ background: '#ffc107', color: '#000', padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }} onClick={() => setIsAdvanceModalOpen(true)}><RefreshCw size={18} /> سحب / سداد سلفة</button>
      </div>

      {/* Transactions Table */}
      <div className="erp-card">
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <Search size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--erp-text-muted)' }} />
          <input type="text" placeholder="ابحث في السجلات..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="erp-input" style={{ paddingRight: '45px' }} />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'right' }}>التاريخ</th>
                <th style={{ textAlign: 'center' }}>النوع</th>
                <th style={{ textAlign: 'center' }}>المبلغ</th>
                <th style={{ textAlign: 'right' }}>الخزنة / المحفظة</th>
                <th style={{ textAlign: 'right' }}>التفاصيل والملاحظات</th>
                <th style={{ textAlign: 'right' }}>الجهة</th>
                <th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(tx => {
                const style = getTypeStyle(tx.type);
                return (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap' }}><Calendar size={14} style={{ marginLeft: '5px', verticalAlign: 'middle', color: 'var(--erp-text-muted)' }} /> {tx.date}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: style.bg, color: style.color, padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>{tx.type}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', direction: 'ltr' }}>{tx.amount?.toLocaleString()} ج.م</td>
                    <td style={{ color: 'var(--erp-text-muted)' }}>{tx.method}</td>
                    <td style={{ color: 'var(--erp-text-muted)', maxWidth: '300px', whiteSpace: 'normal' }}>{tx.detail || '-'}</td>
                    <td style={{ color: 'var(--erp-text-muted)' }}>{tx.entity}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => deleteTransaction(tx.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }} title="حذف السجل"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--erp-text-muted)' }}>لا توجد حركات مالية مسجلة في هذا الشهر.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* 1. Transaction Modal */}
      {isTxModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsTxModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()}>
            <h3>تسجيل عملية مالية</h3>
            <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">النوع</label>
                  <select className="erp-input" value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value})} required>
                    <option value="إيراد">إيراد (+)</option>
                    <option value="مصروف">مصروف (-)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">المبلغ</label>
                  <input type="number" step="0.01" className="erp-input" value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">طريقة الدفع (الخزنة)</label>
                  <select className="erp-input" value={txForm.method} onChange={e => setTxForm({...txForm, method: e.target.value})} required>
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">التاريخ</label>
                  <input type="date" className="erp-input" value={txForm.date} onChange={e => setTxForm({...txForm, date: e.target.value})} required />
                </div>
              </div>
              <div>
                <label className="erp-label">تفاصيل العملية / ملاحظات</label>
                <input type="text" className="erp-input" value={txForm.detail} onChange={e => setTxForm({...txForm, detail: e.target.value})} required />
              </div>
              {txForm.type === 'مصروف' && (
                <div>
                  <label className="erp-label">الجهة التابع لها المصروف</label>
                  <select className="erp-input" value={txForm.entity} onChange={e => setTxForm({...txForm, entity: e.target.value})} required>
                    <option value="الشركة">الشركة (مصاريف تشغيل)</option>
                    {partnersList.map(p => <option key={p} value={p}>أ. {p}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" className="erp-btn-primary" style={{ marginTop: '10px' }}>حفظ العملية</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Transfer Modal */}
      {isTransferModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsTransferModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()}>
            <h3>تحويل رصيد بين المحافظ</h3>
            <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">من محفظة (صادر)</label>
                  <select className="erp-input" value={transferForm.from_method} onChange={e => setTransferForm({...transferForm, from_method: e.target.value})} required>
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <ArrowRightLeft size={24} style={{ color: 'var(--erp-text-muted)', marginBottom: '10px' }} />
                <div style={{ flex: 1 }}>
                  <label className="erp-label">إلى محفظة (وارد)</label>
                  <select className="erp-input" value={transferForm.to_method} onChange={e => setTransferForm({...transferForm, to_method: e.target.value})} required>
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="erp-label">المبلغ</label>
                <input type="number" step="0.01" className="erp-input" value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} required />
              </div>
              <div>
                <label className="erp-label">التاريخ</label>
                <input type="date" className="erp-input" value={transferForm.date} onChange={e => setTransferForm({...transferForm, date: e.target.value})} required />
              </div>
              <div>
                <label className="erp-label">ملاحظات التحويل</label>
                <input type="text" className="erp-input" value={transferForm.note} onChange={e => setTransferForm({...transferForm, note: e.target.value})} />
              </div>
              <button type="submit" className="erp-btn-primary" style={{ marginTop: '10px', background: '#0dcaf0', color: '#000' }}>تنفيذ التحويل</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Settle Dues Modal */}
      {isSettleModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsSettleModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()}>
            <h3>سداد مستحقات شريك</h3>
            <form onSubmit={handleSettle} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="erp-label">الشريك المستفيد</label>
                <select className="erp-input" value={settleForm.partner} onChange={e => setSettleForm({...settleForm, partner: e.target.value})} required>
                  {partnersList.map(p => <option key={p} value={p}>أ. {p}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">المبلغ المسدد</label>
                  <input type="number" step="0.01" className="erp-input" value={settleForm.amount} onChange={e => setSettleForm({...settleForm, amount: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">طريقة السداد</label>
                  <select className="erp-input" value={settleForm.method} onChange={e => setSettleForm({...settleForm, method: e.target.value})} required>
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="erp-label">التاريخ</label>
                <input type="date" className="erp-input" value={settleForm.date} onChange={e => setSettleForm({...settleForm, date: e.target.value})} required />
              </div>
              <button type="submit" className="erp-btn-primary" style={{ marginTop: '10px', background: '#198754' }}>تسجيل السداد</button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Advance Modal */}
      {isAdvanceModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsAdvanceModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()}>
            <h3>السلف الإدارية</h3>
            <form onSubmit={handleAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="erp-label">نوع العملية</label>
                <select className="erp-input" value={advanceForm.type} onChange={e => setAdvanceForm({...advanceForm, type: e.target.value})} required>
                  <option value="سحب سلفة">سحب سلفة (خروج نقدية)</option>
                  <option value="سداد سلفة">سداد سلفة (دخول نقدية)</option>
                </select>
              </div>
              <div>
                <label className="erp-label">الشريك المعني</label>
                <select className="erp-input" value={advanceForm.partner} onChange={e => setAdvanceForm({...advanceForm, partner: e.target.value})} required>
                  {partnersList.map(p => <option key={p} value={p}>أ. {p}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">المبلغ</label>
                  <input type="number" step="0.01" className="erp-input" value={advanceForm.amount} onChange={e => setAdvanceForm({...advanceForm, amount: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="erp-label">طريقة الدفع/الاستلام</label>
                  <select className="erp-input" value={advanceForm.method} onChange={e => setAdvanceForm({...advanceForm, method: e.target.value})} required>
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="erp-label">التاريخ</label>
                <input type="date" className="erp-input" value={advanceForm.date} onChange={e => setAdvanceForm({...advanceForm, date: e.target.value})} required />
              </div>
              <button type="submit" className="erp-btn-primary" style={{ marginTop: '10px', background: '#ffc107', color: '#000' }}>تسجيل السلفة</button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Adjust Partner Due Modal */}
      {isAdjustDueModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsAdjustDueModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()}>
            <h3>تعديل يدوي لمستحقات شريك</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)' }}>هذا الإجراء سيقوم بحفظ فارق تسوية في الإعدادات ولن يؤثر على أرصدة الخزائن.</p>
            <form onSubmit={handleAdjustDue} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="erp-label">الشريك</label>
                <select className="erp-input" value={adjustDueForm.partner} onChange={e => setAdjustDueForm({...adjustDueForm, partner: e.target.value})} required>
                  {partnersList.map(p => <option key={p} value={p}>أ. {p}</option>)}
                </select>
              </div>
              <div>
                <label className="erp-label">المستحق النهائي الجديد (ج.م)</label>
                <input type="number" step="0.01" className="erp-input" value={adjustDueForm.new_due} onChange={e => setAdjustDueForm({...adjustDueForm, new_due: e.target.value})} required />
              </div>
              <button type="submit" className="erp-btn-primary" style={{ marginTop: '10px', background: 'var(--erp-primary)' }}>حفظ التعديل</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ERPFinance;
