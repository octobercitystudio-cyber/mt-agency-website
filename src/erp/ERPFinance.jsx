import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';

let globalFinanceCache = null;
let globalConfigCache = null;
let globalFinanceLastFetch = 0;

const ERPFinance = () => {
  const [allTransactions, setAllTransactions] = useState(globalFinanceCache || []);
  const [appConfig, setAppConfig] = useState(globalConfigCache || {});
  const [loading, setLoading] = useState(!globalFinanceCache);
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const isAdmin = true; // Hardcoded based on the template logic

  // Modals States
  const [modalState, setModalState] = useState({
    transfer: false,
    addTransaction: false,
    settleDues: false,
    advance: false,
    payAdvance: false,
    adjustPartner: false
  });

  // Form States
  const [txForm, setTxForm] = useState({ type: 'إيراد', amount: '', method: 'كاش', detail: '', date: format(new Date(), 'yyyy-MM-dd'), entity: 'الشركة' });
  const [transferForm, setTransferForm] = useState({ from_method: 'كاش', to_method: 'فودافون كاش', amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
  const [settleForm, setSettleForm] = useState({ partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
  const [advanceForm, setAdvanceForm] = useState({ partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
  const [payAdvanceForm, setPayAdvanceForm] = useState({ partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
  const [adjustDueForm, setAdjustDueForm] = useState({ partner: 'اشرف', new_due: '', current_due: 0 });
  const [adjustWalletForm, setAdjustWalletForm] = useState({ method: '', new_balance: '', current_balance: 0 });

  const methodsList = ['كاش', 'فودافون كاش', 'انستاباي'];
  const partnersList = ['اشرف', 'مروة'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (force = false) => {
    if (globalFinanceCache && globalConfigCache) {
       setAllTransactions(globalFinanceCache);
       setAppConfig(globalConfigCache);
       setLoading(false);
       if (!force && (Date.now() - globalFinanceLastFetch < 30000)) return; // Cache valid for 30s
    } else {
       setLoading(true);
    }

    const { data: fData } = await supabase.from('finance').select('*').order('date', { ascending: false }).order('id', { ascending: false });
    const { data: cData } = await supabase.from('app_config').select('*');
    
    if (fData) {
       setAllTransactions(fData);
       globalFinanceCache = fData;
    }
    if (cData) {
      const cfg = {};
      cData.forEach(c => cfg[c.key] = c.value);
      setAppConfig(cfg);
      globalConfigCache = cfg;
    }
    
    globalFinanceLastFetch = Date.now();
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
    
    const balances = { 'كاش': 0, 'فودافون كاش': 0, 'انستاباي': 0, 'إنستاباي (InstaPay)': 0, 'تحويل بنكي': 0 };

    const incomes = [];
    const expenses = [];

    allTransactions.forEach(t => {
      const amt = safeFloat(t.amount);
      const isCurrentMonth = t.date && t.date.startsWith(selectedMonth);

      if (isCurrentMonth) {
        if (['إيراد', 'سداد سلفة', 'تحويل وارد'].includes(t.type)) {
          if (['إيراد', 'سداد سلفة'].includes(t.type)) total_inc += amt;
          incomes.push(t);
        } else if (['مصروف', 'تحويل صادر', 'سحب سلفة', 'سداد مستحقات'].includes(t.type)) {
          if (['مصروف', 'سحب سلفة'].includes(t.type)) total_exp += amt;
          expenses.push(t);
        }
      }

      const method = t.method || 'كاش';
      if (balances[method] === undefined) balances[method] = 0;

      if (['إيراد', 'سداد سلفة', 'تحويل وارد'].includes(t.type)) {
        balances[method] += amt;
      } else if (['مصروف', 'تحويل صادر'].includes(t.type) && t.entity === 'الشركة') {
        balances[method] -= amt;
      } else if (['سداد مستحقات', 'سحب سلفة'].includes(t.type)) {
        balances[method] -= amt;
      }

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

    const final_instapay = balances['انستاباي'] + balances['إنستاباي (InstaPay)'] + balances['تحويل بنكي'];

    return { 
      total_inc, total_exp, net_profit, 
      balances: { cash: balances['كاش'], vodafone: balances['فودافون كاش'], instapay: final_instapay }, 
      ashraf_due, marwa_due, 
      incomes, expenses 
    };
  }, [allTransactions, appConfig, selectedMonth]);

  const { total_inc, total_exp, net_profit, balances, ashraf_due, marwa_due, incomes, expenses } = calculations;

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
      setModalState(s => ({...s, addTransaction: false}));
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

    await supabase.from('finance').insert([{ type: 'تحويل صادر', amount: amt, method: transferForm.from_method, detail: detailOut, date: transferForm.date, entity: 'الشركة' }]);
    await supabase.from('finance').insert([{ type: 'تحويل وارد', amount: amt, method: transferForm.to_method, detail: detailIn, date: transferForm.date, entity: 'الشركة' }]);

    setModalState(s => ({...s, transfer: false}));
    setTransferForm({ from_method: 'كاش', to_method: 'فودافون كاش', amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
    fetchData();
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    await supabase.from('finance').insert([{
      type: 'سداد مستحقات',
      amount: safeFloat(settleForm.amount),
      method: settleForm.method,
      detail: `سداد مستحقات أ. ${settleForm.partner}`,
      date: settleForm.date,
      entity: settleForm.partner
    }]);
    setModalState(s => ({...s, settleDues: false}));
    setSettleForm({ partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
    fetchData();
  };

  const handleAdvance = async (e) => {
    e.preventDefault();
    await supabase.from('finance').insert([{
      type: 'سحب سلفة',
      amount: safeFloat(advanceForm.amount),
      method: advanceForm.method,
      detail: `سحب سلفة لـ أ. ${advanceForm.partner}`,
      date: advanceForm.date,
      entity: advanceForm.partner
    }]);
    setModalState(s => ({...s, advance: false}));
    setAdvanceForm({ partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
    fetchData();
  };

  const handlePayAdvance = async (e) => {
    e.preventDefault();
    await supabase.from('finance').insert([{
      type: 'سداد سلفة',
      amount: safeFloat(payAdvanceForm.amount),
      method: payAdvanceForm.method,
      detail: `سداد سلفة من أ. ${payAdvanceForm.partner}`,
      date: payAdvanceForm.date,
      entity: payAdvanceForm.partner
    }]);
    setModalState(s => ({...s, payAdvance: false}));
    setPayAdvanceForm({ partner: 'اشرف', amount: '', method: 'كاش', date: format(new Date(), 'yyyy-MM-dd') });
    fetchData();
  };

  const handleAdjustDue = async (e) => {
    e.preventDefault();
    const partner = adjustDueForm.partner;
    const new_due = safeFloat(adjustDueForm.new_due);
    
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
    if (exists) {
      await supabase.from('app_config').update({ value: new_adj.toString() }).eq('key', adj_key);
    } else {
      await supabase.from('app_config').insert([{ key: adj_key, value: new_adj.toString() }]);
    }

    setModalState(s => ({...s, adjustPartner: false}));
    fetchData();
  };

  const handleAdjustWallet = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    const method = adjustWalletForm.method;
    const new_bal = safeFloat(adjustWalletForm.new_balance);
    const curr_bal = adjustWalletForm.current_balance;
    const diff = new_bal - curr_bal;
    
    if (diff === 0) {
      setModalState(s => ({...s, adjustWallet: false}));
      return;
    }
    
    const adminNote = prompt('اكتب ملاحظة لعملية التسوية (اختياري):', 'تسوية إدارية');
    const detailText = adminNote ? `تسوية إدارية: ${adminNote}` : 'تسوية إدارية';
    
    const type = diff > 0 ? 'إيراد' : 'مصروف';
    const amount = Math.abs(diff);
    
    await supabase.from('finance').insert([{
      type: type,
      amount: amount,
      method: method,
      detail: detailText,
      date: format(new Date(), 'yyyy-MM-dd'),
      entity: 'الشركة'
    }]);
    
    setModalState(s => ({...s, adjustWallet: false}));
    fetchData();
  };

  const deleteTransaction = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل المالي؟')) {
      await supabase.from('finance').delete().eq('id', id);
      fetchData();
    }
  };

  const changeMonth = (offset) => {
    const current = parseISO(`${selectedMonth}-01`);
    const newDate = offset > 0 ? addMonths(current, 1) : subMonths(current, 1);
    setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  const openSettleModal = (partner, maxDue) => {
    setSettleForm({ ...settleForm, partner, amount: maxDue > 0 ? maxDue : '' });
    setModalState(s => ({...s, settleDues: true}));
  };

  const openAdvanceModal = (partner) => {
    setAdvanceForm({ ...advanceForm, partner });
    setModalState(s => ({...s, advance: true}));
  };

  const openPayAdvanceModal = (partner, maxAdv) => {
    setPayAdvanceForm({ ...payAdvanceForm, partner, amount: maxAdv > 0 ? maxAdv : '' });
    setModalState(s => ({...s, payAdvance: true}));
  };

  const openAdjustPartnerModal = (partner, currentDue) => {
    setAdjustDueForm({ partner, new_due: '', current_due: currentDue });
    setModalState(s => ({...s, adjustPartner: true}));
  };

  const openAdjustWalletModal = (method, currentBalance) => {
    setAdjustWalletForm({ method, new_balance: '', current_balance: currentBalance });
    setModalState(s => ({...s, adjustWallet: true}));
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>جاري تحميل الحسابات...</div>;

  return (
    <div className="container-fluid p-0">
      <style>{`
        .wallet-card { transition: all 0.3s ease; border: 1px solid rgba(0,0,0,0.05); }
        .wallet-card:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(0,0,0,0.1) !important; }
        
        .table-container { overflow: auto; max-height: 500px; padding-top: 5px; }
        .table-container::-webkit-scrollbar { width: 6px; height: 6px; } 
        .table-container::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        
        .month-selector { background: white; border: 1px solid #e2e8f0; border-radius: 50px; padding: 5px; display: inline-flex; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
        
        .gradient-primary { background: linear-gradient(135deg, #4318ff 0%, #868cff 100%); color: white; }
        .gradient-success { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: white; }
        .gradient-danger { background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); color: white; }

        .bg-income-container { background-color: #f7fdf9 !important; border: 1px solid #dcfce7 !important; }
        .table-income tbody tr td { background-color: #e8faed !important; border-bottom: 6px solid #f7fdf9 !important; transition: all 0.2s ease; }
        .table-income tbody tr:hover td { background-color: #d1f4dc !important; transform: scale(0.99); }
        .thead-income th { background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color: #ffffff !important; border: none !important; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2); }

        .bg-expense-container { background-color: #fff9f9 !important; border: 1px solid #fee2e2 !important; }
        .table-expense tbody tr td { background-color: #ffefef !important; border-bottom: 6px solid #fff9f9 !important; transition: all 0.2s ease; }
        .table-expense tbody tr:hover td { background-color: #ffe0e0 !important; transform: scale(0.99); }
        .thead-expense th { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important; color: #ffffff !important; border: none !important; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2); }

        .due-row td { background-color: #fffbeb !important; border-bottom: 6px solid #fff9f9 !important; transition: all 0.2s ease; }
        .due-row:hover td { background-color: #fef3c7 !important; transform: scale(0.99); }
      `}</style>

      {/* Header Area */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)' }}>
            الإدارة المالية <i className="fas fa-chart-line ms-2" style={{ color: 'var(--erp-primary)' }}></i>
          </h3>
          <p className="small m-0 mt-1" style={{ color: 'var(--erp-text-muted)' }}>نظرة شاملة على الإيرادات والمصروفات الخاصة بالشركة.</p>
        </div>
        
        <div className="d-flex flex-wrap align-items-center justify-content-center gap-3">
          <div className="month-selector">
            <button onClick={() => changeMonth(1)} className="btn btn-sm btn-light rounded-circle text-primary"><i className="fas fa-chevron-right"></i></button>
            <span className="m-0 px-4 fw-bold" style={{ color: '#2b3674' }}>{selectedMonth}</span>
            <button onClick={() => changeMonth(-1)} className="btn btn-sm btn-light rounded-circle text-primary"><i className="fas fa-chevron-left"></i></button>
          </div>
          
          <button className="btn btn-dark rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center" onClick={() => window.print()}>
            <i className="fas fa-print me-2"></i> طباعة
          </button>
          <button className="btn btn-info text-dark rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center" onClick={() => setModalState({...modalState, transfer: true})}>
            <i className="fas fa-exchange-alt me-2"></i> تحويل رصيد
          </button>
          <button className="btn rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center" style={{ background: 'var(--erp-primary)', color: 'white' }} onClick={() => setModalState({...modalState, addTransaction: true})}>
            <i className="fas fa-plus-circle me-2"></i> عملية مالية
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="card border-0 rounded-4 p-4 h-100 gradient-success shadow-sm wallet-card position-relative overflow-hidden">
            <i className="fas fa-arrow-up position-absolute end-0 top-0 mt-3 ms-3 opacity-25" style={{ fontSize: '80px', transform: 'scaleX(-1)' }}></i>
            <div className="position-relative z-1">
              <p className="mb-1 fw-bold opacity-75">إيرادات شهر ({format(parseISO(`${selectedMonth}-01`), 'MM-yyyy')})</p>
              <h2 className="fw-bold m-0">{total_inc.toLocaleString()} <span className="fs-6 opacity-75">ج.م</span></h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 rounded-4 p-4 h-100 gradient-danger shadow-sm wallet-card position-relative overflow-hidden">
            <i className="fas fa-arrow-down position-absolute end-0 top-0 mt-3 ms-3 opacity-25" style={{ fontSize: '80px', transform: 'scaleX(-1)' }}></i>
            <div className="position-relative z-1">
              <p className="mb-1 fw-bold opacity-75">مصروفات شهر ({format(parseISO(`${selectedMonth}-01`), 'MM-yyyy')})</p>
              <h2 className="fw-bold m-0">{total_exp.toLocaleString()} <span className="fs-6 opacity-75">ج.م</span></h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 rounded-4 p-4 h-100 gradient-primary shadow-sm wallet-card position-relative overflow-hidden">
            <i className="fas fa-star position-absolute end-0 top-0 mt-3 ms-3 opacity-25" style={{ fontSize: '80px' }}></i>
            <div className="position-relative z-1">
              <p className="mb-1 fw-bold opacity-75">صافي الأرباح للشهر</p>
              <h2 className="fw-bold m-0">{net_profit.toLocaleString()} <span className="fs-6 opacity-75">ج.م</span></h2>
            </div>
          </div>
        </div>
      </div>

      {/* Vault Balances */}
      <h5 className="fw-bold mb-3" style={{ color: 'var(--erp-text-main)' }}>
        <i className="fas fa-wallet ms-2 text-muted"></i> أرصدة الخزائن الحالية (تراكمي)
      </h5>
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 wallet-card h-100" style={{ background: 'var(--erp-surface)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div style={{ background: 'rgba(25, 135, 84, 0.1)', color: '#198754', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-money-bill-wave fs-4"></i>
              </div>
              {isAdmin && (
                <button className="btn btn-link p-0 text-primary no-print" title="تسوية الرصيد" onClick={() => openAdjustWalletModal('كاش', balances.cash)}><i className="fas fa-pen"></i></button>
              )}
            </div>
            <p className="fw-bold mb-1 small" style={{ color: 'var(--erp-text-muted)' }}>صندوق الكاش (النقدية)</p>
            <h3 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)' }}>{balances.cash.toLocaleString()} <span className="fs-6" style={{ color: 'var(--erp-text-muted)' }}>ج.م</span></h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 wallet-card h-100" style={{ background: 'var(--erp-surface)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div style={{ background: 'rgba(220, 53, 69, 0.1)', color: '#dc3545', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-mobile-alt fs-4"></i>
              </div>
              {isAdmin && (
                <button className="btn btn-link p-0 text-danger no-print" title="تسوية الرصيد" onClick={() => openAdjustWalletModal('فودافون كاش', balances.vodafone)}><i className="fas fa-pen"></i></button>
              )}
            </div>
            <p className="fw-bold mb-1 small" style={{ color: 'var(--erp-text-muted)' }}>محفظة فودافون كاش</p>
            <h3 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)' }}>{balances.vodafone.toLocaleString()} <span className="fs-6" style={{ color: 'var(--erp-text-muted)' }}>ج.م</span></h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 wallet-card h-100" style={{ background: 'var(--erp-surface)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div style={{ background: '#f4f0ff', color: '#6f42c1', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-paper-plane fs-4"></i>
              </div>
              {isAdmin && (
                <button className="btn btn-link p-0 no-print" style={{ color: '#6f42c1' }} title="تسوية الرصيد"><i className="fas fa-pen"></i></button>
              )}
            </div>
            <p className="fw-bold mb-1 small" style={{ color: 'var(--erp-text-muted)' }}>حساب البنك (InstaPay)</p>
            <h3 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)' }}>{balances.instapay.toLocaleString()} <span className="fs-6" style={{ color: 'var(--erp-text-muted)' }}>ج.م</span></h3>
          </div>
        </div>
      </div>

      {/* Partners Dues */}
      <div className="row g-4 mb-4">
        {[
          { name: 'أ. أشرف', key: 'اشرف', due: ashraf_due },
          { name: 'أ. مروة', key: 'مروة', due: marwa_due }
        ].map(partner => (
          <div className="col-md-6" key={partner.key}>
            <div className="card border-0 shadow-sm rounded-4 p-3 d-flex flex-row align-items-center justify-content-between wallet-card" style={{ background: 'var(--erp-surface)' }}>
              <div className="d-flex align-items-center">
                <div style={{ background: 'var(--erp-bg)', padding: '15px', borderRadius: '50%', marginRight: '15px' }}>
                  <i className="fas fa-user fs-5 text-dark"></i>
                </div>
                <div>
                  <h6 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)' }}>
                    {partner.name}
                    {isAdmin && <button className="btn btn-sm btn-link p-0 ms-2" style={{ color: 'var(--erp-primary)' }} onClick={() => openAdjustPartnerModal(partner.key, partner.due)}><i className="fas fa-edit"></i></button>}
                  </h6>
                  <small style={{ color: 'var(--erp-text-muted)' }}>مستحقات متأخرة أو سلف (تراكمية)</small>
                </div>
              </div>
              <div className="text-end">
                {partner.due > 0 && <h5 className="fw-bold m-0 mb-1" style={{ color: 'var(--erp-success)' }}>له: {partner.due.toLocaleString()} <small className="fs-6" style={{ color: 'var(--erp-text-muted)' }}>ج</small></h5>}
                {partner.due < 0 && <h5 className="fw-bold m-0 mb-1" style={{ color: 'var(--erp-danger)' }}>عليه: {(partner.due * -1).toLocaleString()} <small className="fs-6" style={{ color: 'var(--erp-text-muted)' }}>ج</small></h5>}
                {partner.due === 0 && <h5 className="fw-bold m-0 mb-1" style={{ color: 'var(--erp-text-muted)' }}>0 <small className="fs-6">ج</small></h5>}
                
                <div className="d-flex gap-1 justify-content-end mt-2">
                  <button className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold no-print" onClick={() => openAdvanceModal(partner.key)}>سحب سلفة</button>
                  {partner.due > 0 && <button className="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold no-print" onClick={() => openSettleModal(partner.key, partner.due)}>سداد له</button>}
                  {partner.due < 0 && <button className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold no-print" onClick={() => openPayAdvanceModal(partner.key, partner.due * -1)}>سداد السلفة</button>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction Tables */}
      <div className="row g-4">
        {/* Incomes */}
        <div className="col-xl-6">
          <div className="d-flex justify-content-between align-items-center mb-3 px-2">
            <h5 className="fw-bold m-0" style={{ color: 'var(--erp-success)' }}><i className="fas fa-arrow-down me-2"></i> سجل الواردات (إيرادات)</h5>
            <span className="badge rounded-pill shadow-sm py-2 px-3" style={{ background: 'var(--erp-success)', color: 'white' }}>{incomes.length} عملية</span>
          </div>
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-income-container">
            <div className="card-body p-2 table-container">
              <div className="table-responsive">
<table className="table table-borderless align-middle m-0 table-income text-center" style={{ whiteSpace: 'nowrap' }}>
                <thead className="sticky-top thead-income">
                  <tr>
                    <th className="small fw-bold py-3 rounded-start-3">التاريخ</th>
                    <th className="small fw-bold py-3">المعاملة</th>
                    <th className="small fw-bold py-3">النوع/المحفظة</th>
                    <th className="small fw-bold py-3 rounded-end-3">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map(i => {
                    const dayName = format(parseISO(i.date), 'EEEE', { locale: ar });
                    return (
                      <tr key={i.id}>
                        <td className="rounded-start-3">
                          <span className="d-block fw-bold mb-1" style={{ color: 'var(--erp-text-main)', fontSize: '0.85rem' }}>{dayName}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>{i.date}</span>
                        </td>
                        <td><span className="fw-bold small" style={{ color: 'var(--erp-text-main)' }}>{i.detail}</span></td>
                        <td>
                          {i.type === 'سداد سلفة' && <span className="badge border shadow-sm py-2 px-3" style={{ background: 'var(--erp-primary)', color: 'white', borderColor: 'var(--erp-primary)' }}>{i.entity} (سداد سلفة)</span>}
                          {i.type === 'تحويل وارد' && <span className="badge border shadow-sm py-2 px-3" style={{ background: '#0dcaf0', color: '#000', borderColor: '#0dcaf0' }}>{i.method} (تحويل وارد)</span>}
                          {['إيراد'].includes(i.type) && <span className="badge border shadow-sm py-2 px-3" style={{ background: 'white', color: 'var(--erp-success)', borderColor: 'var(--erp-success)' }}>{i.method}</span>}
                        </td>
                        <td className="rounded-end-3">
                          <span className="fw-bold fs-6 d-block" style={{ color: 'var(--erp-success)' }}>+{i.amount.toLocaleString()} ج</span>
                          {isAdmin && (
                            <div className="mt-2 d-flex gap-2 justify-content-center">
                              <button className="btn btn-sm btn-light text-primary border no-print py-0 px-2" title="تعديل"><i className="fas fa-edit"></i></button>
                              <button className="btn btn-sm btn-light border py-0 px-2 text-danger opacity-50 no-print" onClick={() => deleteTransaction(i.id)} title="حذف"><i className="fas fa-trash"></i></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {incomes.length === 0 && <tr><td colSpan="4" className="text-center py-5 fw-bold" style={{ color: 'var(--erp-success)', opacity: 0.5 }}>لا توجد إيرادات.</td></tr>}
                </tbody>
              </table>
</div>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="col-xl-6">
          <div className="d-flex justify-content-between align-items-center mb-3 px-2">
            <h5 className="fw-bold m-0" style={{ color: 'var(--erp-danger)' }}><i className="fas fa-arrow-up me-2"></i> سجل الصادر (مصروفات)</h5>
            <span className="badge rounded-pill shadow-sm py-2 px-3" style={{ background: 'var(--erp-danger)', color: 'white' }}>{expenses.length} عملية</span>
          </div>
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-expense-container">
            <div className="card-body p-2 table-container">
              <div className="table-responsive">
<table className="table table-borderless align-middle m-0 table-expense text-center" style={{ whiteSpace: 'nowrap' }}>
                <thead className="sticky-top thead-expense">
                  <tr>
                    <th className="small fw-bold py-3 rounded-start-3">التاريخ</th>
                    <th className="small fw-bold py-3">المعاملة</th>
                    <th className="small fw-bold py-3">وسيلة الدفع</th>
                    <th className="small fw-bold py-3">الجهة</th>
                    <th className="small fw-bold py-3 rounded-end-3">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => {
                    const dayName = format(parseISO(e.date), 'EEEE', { locale: ar });
                    const isDue = ['سداد مستحقات', 'سحب سلفة'].includes(e.type);
                    return (
                      <tr key={e.id} className={isDue ? 'due-row' : ''}>
                        <td className="rounded-start-3">
                          <span className="d-block fw-bold mb-1" style={{ color: 'var(--erp-text-main)', fontSize: '0.85rem' }}>{dayName}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>{e.date}</span>
                        </td>
                        <td><span className="fw-bold small" style={{ color: 'var(--erp-text-main)' }}>{e.detail}</span></td>
                        <td><span className="badge border shadow-sm py-2 px-3" style={{ background: 'white', color: 'var(--erp-danger)', borderColor: 'var(--erp-danger)' }}>{e.method}</span></td>
                        <td>
                          {e.type === 'سداد مستحقات' && <span className="badge border shadow-sm py-2 px-3" style={{ background: '#ffc107', color: '#000', borderColor: '#ffc107' }}>{e.entity} (سداد مستحقات)</span>}
                          {e.type === 'سحب سلفة' && <span className="badge border shadow-sm py-2 px-3" style={{ background: 'var(--erp-danger)', color: 'white', borderColor: 'var(--erp-danger)' }}>{e.entity} (سحب سلفة)</span>}
                          {e.type === 'تحويل صادر' && <span className="badge border shadow-sm py-2 px-3" style={{ background: '#0dcaf0', color: '#000', borderColor: '#0dcaf0' }}>تحويل محفظة</span>}
                          {['مصروف'].includes(e.type) && <span className="badge border shadow-sm py-2 px-3" style={{ background: 'white', color: 'var(--erp-danger)', borderColor: 'var(--erp-danger)' }}>{e.entity}</span>}
                        </td>
                        <td className="rounded-end-3">
                          <span className="fw-bold fs-6 d-block" style={{ color: e.type === 'سداد مستحقات' ? 'var(--erp-text-main)' : 'var(--erp-danger)' }}>-{e.amount.toLocaleString()} ج</span>
                          {isAdmin && (
                            <div className="mt-2 d-flex gap-2 justify-content-center">
                              <button className="btn btn-sm btn-light text-primary border no-print py-0 px-2" title="تعديل"><i className="fas fa-edit"></i></button>
                              <button className="btn btn-sm btn-light border py-0 px-2 text-danger opacity-50 no-print" onClick={() => deleteTransaction(e.id)} title="حذف"><i className="fas fa-trash"></i></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {expenses.length === 0 && <tr><td colSpan="5" className="text-center py-5 fw-bold" style={{ color: 'var(--erp-danger)', opacity: 0.5 }}>لا توجد مصروفات.</td></tr>}
                </tbody>
              </table>
</div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* 1. Transaction Modal */}
      {modalState.addTransaction && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, addTransaction: false})}>
          <div className="erp-modal-content border-0 shadow-lg rounded-5 overflow-hidden p-0" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4" style={{ background: 'var(--erp-primary)', color: 'white' }}>
              <h5 className="fw-bold m-0 d-flex align-items-center"><i className="fas fa-file-invoice-dollar me-2"></i> تسجيل عملية مالية</h5>
            </div>
            <form onSubmit={handleAddTransaction} className="p-4 bg-white">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>نوع العملية</label>
                  <select className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value})} required>
                    <option value="إيراد" style={{ color: 'var(--erp-success)' }}>إيراد (+)</option>
                    <option value="مصروف" style={{ color: 'var(--erp-danger)' }}>مصروف (-)</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>تاريخ العملية</label>
                  <input type="date" className="form-control border-0" style={{ background: 'var(--erp-bg)' }} value={txForm.date} onChange={e => setTxForm({...txForm, date: e.target.value})} required />
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>المبلغ</label>
                  <input type="number" step="0.01" className="form-control border-0 fw-bold text-center" style={{ background: 'var(--erp-bg)' }} value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} required />
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>الخزينة (طريقة الدفع)</label>
                  <select className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.method} onChange={e => setTxForm({...txForm, method: e.target.value})} required>
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {txForm.type === 'مصروف' && (
                  <div className="col-12 mt-3 animate__animated animate__fadeIn">
                    <label className="small fw-bold mb-1" style={{ color: 'var(--erp-danger)' }}>دُفع بواسطة (الجهة)</label>
                    <select className="form-select border-0 fw-bold" style={{ background: 'rgba(220, 53, 69, 0.1)', color: 'var(--erp-danger)' }} value={txForm.entity} onChange={e => setTxForm({...txForm, entity: e.target.value})} required>
                      <option value="الشركة">من خزينة الشركة</option>
                      {partnersList.map(p => <option key={p} value={p}>أ. {p} (من ماله الخاص)</option>)}
                    </select>
                  </div>
                )}
                <div className="col-12 mt-3">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>البيان والتفاصيل</label>
                  <input type="text" className="form-control border-0 py-2" style={{ background: 'var(--erp-bg)' }} value={txForm.detail} onChange={e => setTxForm({...txForm, detail: e.target.value})} placeholder="مثال: فاتورة إنترنت، دفعة حجز..." required />
                </div>
              </div>
              <button type="submit" className="btn w-100 py-3 rounded-4 fw-bold shadow mt-4" style={{ background: 'var(--erp-primary)', color: 'white' }}>اعتماد وحفظ</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Transfer Modal */}
      {modalState.transfer && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, transfer: false})}>
          <div className="erp-modal-content border-0 shadow-lg rounded-5 overflow-hidden p-0" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4" style={{ background: '#0dcaf0', color: '#000' }}>
              <h5 className="fw-bold m-0 d-flex align-items-center"><i className="fas fa-exchange-alt me-2"></i> تحويل رصيد بين المحافظ</h5>
            </div>
            <form onSubmit={handleTransfer} className="p-4 bg-white">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>من محفظة (تُسحب منها)</label>
                  <select className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={transferForm.from_method} onChange={e => setTransferForm({...transferForm, from_method: e.target.value})} required>
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>إلى محفظة (تُضاف إليها)</label>
                  <select className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={transferForm.to_method} onChange={e => setTransferForm({...transferForm, to_method: e.target.value})} required>
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>المبلغ المحول (ج.م)</label>
                  <input type="number" step="0.01" className="form-control border-0 fw-bold text-center fs-5" style={{ background: 'var(--erp-bg)', color: 'var(--erp-primary)' }} value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} required />
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>تاريخ التحويل</label>
                  <input type="date" className="form-control border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={transferForm.date} onChange={e => setTransferForm({...transferForm, date: e.target.value})} required />
                </div>
                <div className="col-12 mt-3">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>ملاحظات (اختياري)</label>
                  <input type="text" className="form-control border-0 py-2" style={{ background: 'var(--erp-bg)' }} value={transferForm.note} onChange={e => setTransferForm({...transferForm, note: e.target.value})} placeholder="السبب..." />
                </div>
              </div>
              <button type="submit" className="btn w-100 py-3 rounded-4 fw-bold shadow mt-4" style={{ background: '#0dcaf0', color: '#000' }}>تأكيد التحويل</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Settle Dues Modal */}
      {modalState.settleDues && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, settleDues: false})}>
          <div className="erp-modal-content border-0 shadow-lg rounded-5 overflow-hidden p-0" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4" style={{ background: 'var(--erp-success)', color: 'white' }}>
              <h5 className="fw-bold m-0 d-flex align-items-center"><i className="fas fa-hand-holding-usd me-2"></i> سداد مستحقات شريك</h5>
            </div>
            <form onSubmit={handleSettle} className="p-4 bg-white text-center">
              <h5 className="fw-bold mb-1" style={{ color: 'var(--erp-text-main)' }}>سداد لـ أ. {settleForm.partner}</h5>
              <div className="mb-3 text-start mt-4">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>تاريخ المعاملة</label>
                <input type="date" className="form-control border-0 py-2 fw-bold rounded-4" style={{ background: 'var(--erp-bg)' }} value={settleForm.date} onChange={e => setSettleForm({...settleForm, date: e.target.value})} required />
              </div>
              <div className="mb-3 text-start">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>المبلغ المراد سداده الآن</label>
                <input type="number" step="0.01" className="form-control border-0 py-3 fs-3 fw-bold text-center rounded-4" style={{ background: 'rgba(25, 135, 84, 0.1)', color: 'var(--erp-success)' }} value={settleForm.amount} onChange={e => setSettleForm({...settleForm, amount: e.target.value})} required />
              </div>
              <div className="mb-3 text-start">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>سحب المبلغ من خزينة:</label>
                <select className="form-select border-0 py-2 fw-bold rounded-4" style={{ background: 'var(--erp-bg)' }} value={settleForm.method} onChange={e => setSettleForm({...settleForm, method: e.target.value})} required>
                  {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button type="submit" className="btn w-100 py-3 rounded-4 fw-bold shadow mt-3" style={{ background: 'var(--erp-success)', color: 'white' }}>تأكيد السداد</button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Advance Modal */}
      {modalState.advance && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, advance: false})}>
          <div className="erp-modal-content border-0 shadow-lg rounded-5 overflow-hidden p-0" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4" style={{ background: 'var(--erp-danger)', color: 'white' }}>
              <h5 className="fw-bold m-0 d-flex align-items-center"><i className="fas fa-hand-holding-usd me-2"></i> سحب سلفة للشريك</h5>
            </div>
            <form onSubmit={handleAdvance} className="p-4 bg-white text-center">
              <h5 className="fw-bold mb-1" style={{ color: 'var(--erp-text-main)' }}>سلفة لـ أ. {advanceForm.partner}</h5>
              <p className="small mb-3" style={{ color: 'var(--erp-text-muted)' }}>هذا المبلغ سيتحول لمديونية شخصية على الشريك وسيخصم من أرباحه مستقبلاً.</p>
              <div className="mb-3 text-start mt-4">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>تاريخ المعاملة</label>
                <input type="date" className="form-control border-0 py-2 fw-bold rounded-4" style={{ background: 'var(--erp-bg)' }} value={advanceForm.date} onChange={e => setAdvanceForm({...advanceForm, date: e.target.value})} required />
              </div>
              <div className="mb-3 text-start">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>المبلغ المراد سحبه كسلفة</label>
                <input type="number" step="0.01" className="form-control border-0 py-3 fs-3 fw-bold text-center rounded-4" style={{ background: 'rgba(220, 53, 69, 0.1)', color: 'var(--erp-danger)' }} value={advanceForm.amount} onChange={e => setAdvanceForm({...advanceForm, amount: e.target.value})} required />
              </div>
              <div className="mb-3 text-start">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>سحب المبلغ من خزينة:</label>
                <select className="form-select border-0 py-2 fw-bold rounded-4" style={{ background: 'var(--erp-bg)' }} value={advanceForm.method} onChange={e => setAdvanceForm({...advanceForm, method: e.target.value})} required>
                  {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button type="submit" className="btn w-100 py-3 rounded-4 fw-bold shadow mt-3" style={{ background: 'var(--erp-danger)', color: 'white' }}>تأكيد سحب السلفة</button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Pay Advance Modal */}
      {modalState.payAdvance && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, payAdvance: false})}>
          <div className="erp-modal-content border-0 shadow-lg rounded-5 overflow-hidden p-0" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4" style={{ background: 'var(--erp-primary)', color: 'white' }}>
              <h5 className="fw-bold m-0 d-flex align-items-center"><i className="fas fa-undo me-2"></i> سداد سلفة الشريك</h5>
            </div>
            <form onSubmit={handlePayAdvance} className="p-4 bg-white text-center">
              <h5 className="fw-bold mb-1" style={{ color: 'var(--erp-text-main)' }}>سداد من أ. {payAdvanceForm.partner}</h5>
              <div className="mb-3 text-start mt-4">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>تاريخ المعاملة</label>
                <input type="date" className="form-control border-0 py-2 fw-bold rounded-4" style={{ background: 'var(--erp-bg)' }} value={payAdvanceForm.date} onChange={e => setPayAdvanceForm({...payAdvanceForm, date: e.target.value})} required />
              </div>
              <div className="mb-3 text-start">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>المبلغ المراد سداده الآن لخزينة الشركة</label>
                <input type="number" step="0.01" className="form-control border-0 py-3 fs-3 fw-bold text-center rounded-4" style={{ background: 'rgba(67, 24, 255, 0.1)', color: 'var(--erp-primary)' }} value={payAdvanceForm.amount} onChange={e => setPayAdvanceForm({...payAdvanceForm, amount: e.target.value})} required />
              </div>
              <div className="mb-3 text-start">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>إيداع المبلغ في خزينة:</label>
                <select className="form-select border-0 py-2 fw-bold rounded-4" style={{ background: 'var(--erp-bg)' }} value={payAdvanceForm.method} onChange={e => setPayAdvanceForm({...payAdvanceForm, method: e.target.value})} required>
                  {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button type="submit" className="btn w-100 py-3 rounded-4 fw-bold shadow mt-3" style={{ background: 'var(--erp-primary)', color: 'white' }}>تأكيد السداد والخزينة</button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Adjust Partner Due Modal (Admin Only) */}
      {modalState.adjustPartner && isAdmin && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, adjustPartner: false})}>
          <div className="erp-modal-content border-0 shadow-lg rounded-5 overflow-hidden p-0" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4" style={{ background: '#1e293b', color: 'white' }}>
              <h5 className="fw-bold m-0 d-flex align-items-center"><i className="fas fa-balance-scale me-2 text-warning"></i> تعديل إداري لمستحقات الشريك</h5>
            </div>
            <form onSubmit={handleAdjustDue} className="p-4 bg-white text-center">
              <div className="p-3 rounded-4 mb-4 border" style={{ background: 'var(--erp-bg)' }}>
                <small className="fw-bold block" style={{ color: 'var(--erp-text-muted)' }}>الرصيد الحالي المُسجل لـ (<span style={{ color: 'var(--erp-primary)' }}>أ. {adjustDueForm.partner}</span>)</small>
                <h3 className="fw-bold m-0 mt-1" style={{ color: 'var(--erp-text-main)' }}>{adjustDueForm.current_due.toLocaleString()} ج.م</h3>
              </div>
              <div className="mb-4 text-start">
                <label className="small fw-bold mb-2" style={{ color: 'var(--erp-text-main)' }}>المبلغ الجديد الصحيح (للمستحقات) بالموجب أو السالب:</label>
                <input type="number" step="0.01" className="form-control border-0 py-3 fs-2 fw-bold text-center rounded-4" style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#000' }} value={adjustDueForm.new_due} onChange={e => setAdjustDueForm({...adjustDueForm, new_due: e.target.value})} required placeholder="مثال: 0 لتصفير الحساب" />
              </div>
              <div className="alert border-0 rounded-4 small fw-bold mb-4 text-start" style={{ background: 'rgba(255, 193, 7, 0.1)', color: '#856404' }}>
                <i className="fas fa-info-circle me-1"></i> سيتم إنشاء عملية "تسوية إدارية" خفية لضبط الدفاتر بحيث يصبح الرصيد مساوياً للرقم الجديد.
              </div>
              <button type="submit" className="btn w-100 py-3 rounded-4 fw-bold shadow" style={{ background: '#1e293b', color: 'white' }}>اعتماد الرصيد الجديد</button>
            </form>
          </div>
        </div>
      )}
      {/* 7. Adjust Wallet Modal (Admin Only) */}
      {modalState.adjustWallet && isAdmin && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, adjustWallet: false})}>
          <div className="erp-modal-content rounded-5 border-0 shadow-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header bg-dark text-white border-0 p-4 rounded-top-5">
              <h5 className="fw-bold m-0 d-flex align-items-center"><i className="fas fa-sliders-h me-2"></i> تسوية إدارية لخزينة ({adjustWalletForm.method})</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setModalState({...modalState, adjustWallet: false})}></button>
            </div>
            <form onSubmit={handleAdjustWallet} className="p-4 bg-white text-center">
              
              <div className="mb-4">
                <small className="fw-bold block" style={{ color: 'var(--erp-text-muted)' }}>الرصيد الحالي المُسجل</small>
                <h3 className="fw-bold m-0 mt-1" style={{ color: 'var(--erp-text-main)' }}>{adjustWalletForm.current_balance.toLocaleString()} ج.م</h3>
              </div>
              
              <div className="mb-4 text-start">
                <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>الرصيد الفعلي الجديد</label>
                <input type="number" step="0.01" className="form-control border-0 py-3 fs-2 fw-bold text-center rounded-4" style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#000' }} value={adjustWalletForm.new_balance} onChange={e => setAdjustWalletForm({...adjustWalletForm, new_balance: e.target.value})} required placeholder="مثال: 5000" />
              </div>

              <div className="alert alert-info text-start mb-0 p-3 rounded-4 border-0 bg-opacity-10" style={{ fontSize: '0.85rem' }}>
                <i className="fas fa-info-circle me-1"></i> سيتم إنشاء عملية "تسوية إدارية" إما كإيراد أو مصروف لضبط الدفاتر بحيث يصبح الرصيد مساوياً للرقم الجديد.
              </div>

              <button type="submit" className="btn w-100 py-3 rounded-4 fw-bold shadow mt-4" style={{ background: '#000', color: 'white' }}>حفظ التعديل الدفتري</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ERPFinance;
