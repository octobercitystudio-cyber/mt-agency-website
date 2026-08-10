import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dataClient } from '../dataClient';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AlertCircle, ChartNoAxesCombined, Layers3, PackageOpen, ShieldCheck, UserRound, X } from 'lucide-react';
import ERPPageHero from './ERPPageHero';
import { CURRENCY_LABEL, formatEGP, formatPaymentMethod } from '../lib/businessFormat';
import useChangeSync from '../hooks/useChangeSync';
import { useData } from '../store/DataContext';
import './ERPFinance.css';

let globalFinanceCache = null;
let globalConfigCache = null;

const ERPFinance = () => {
  const { currentUser } = useData();
  const [allTransactions, setAllTransactions] = useState(globalFinanceCache || []);
  const [appConfig, setAppConfig] = useState(globalConfigCache || {});
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(!globalFinanceCache);
  const [loadError, setLoadError] = useState('');
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const isAdmin = ['owner', 'admin'].includes(currentUser?.role);
  const isOwner = currentUser?.role === 'owner';
  const [ownerAction, setOwnerAction] = useState({ open: false, mode: 'void', entry: null, amount: '', method: '', detail: '', date: '', reason: '', confirmed: false, error: '', requiresAllocation: false, allocation: {}, replacementAllocation: {} });

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
  const emptyTransaction = () => ({ type: 'إيراد', entry_kind: 'income', category: 'other_income', client_id: '', source_type: '', source_id: '', amount: '', method: 'cash', detail: '', date: format(new Date(), 'yyyy-MM-dd'), entity: 'الشركة' });
  const [txForm, setTxForm] = useState(emptyTransaction);
  const [txError, setTxError] = useState([]);
  const transactionDialogRef = useRef(null);
  const transactionErrorRef = useRef(null);
  const transactionTriggerRef = useRef(null);
  const ownerDialogRef = useRef(null);
  const ownerActionTriggerRef = useRef(null);
  const [transferForm, setTransferForm] = useState({ from_method: 'cash', to_method: 'vodafone_cash', amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
  const [settleForm, setSettleForm] = useState({ partner: 'اشرف', amount: '', method: 'cash', date: format(new Date(), 'yyyy-MM-dd') });
  const [advanceForm, setAdvanceForm] = useState({ partner: 'اشرف', amount: '', method: 'cash', date: format(new Date(), 'yyyy-MM-dd') });
  const [payAdvanceForm, setPayAdvanceForm] = useState({ partner: 'اشرف', amount: '', method: 'cash', date: format(new Date(), 'yyyy-MM-dd') });
  const [adjustDueForm, setAdjustDueForm] = useState({ partner: 'اشرف', new_due: '', current_due: 0 });
  const [adjustWalletForm, setAdjustWalletForm] = useState({ method: '', new_balance: '', current_balance: 0 });

  const methodsList = ['cash', 'bank_transfer', 'vodafone_cash', 'instapay'].map(value => ({ value, label: formatPaymentMethod(value) }));
  const partnersList = ['اشرف', 'مروة'];

  const fetchData = useCallback(async () => {
    if (globalFinanceCache && globalConfigCache) {
       setAllTransactions(globalFinanceCache);
       setAppConfig(globalConfigCache);
       setLoading(false);
    } else {
       setLoading(true);
    }

    setLoadError('');
    const [financeResult, configResult, clientsResult, packagesResult, servicesResult] = await Promise.all([
      dataClient.request('/finance/entries', { method: 'GET' }),
      dataClient.from('app_config').select('*'),
      dataClient.from('clients').select('id,name,status').order('name'),
      dataClient.from('client_packages').select('id,client_id,name,status').order('name'),
      dataClient.from('services').select('id,name,is_active').eq('is_active', 1).order('name'),
    ]);
    const fData = financeResult.data;
    const cData = configResult.data;
    const fetchError = [financeResult, configResult, clientsResult, packagesResult, servicesResult].find(result => result.error)?.error;
    if (fetchError) setLoadError(fetchError.message || 'تعذر تحميل دفتر الحسابات.');
    
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
    setClients((clientsResult.data || []).filter(client => client.status !== 'archived'));
    setPackages(packagesResult.data || []);
    setServices(servicesResult.data || []);
    
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(fetchData, 0); return () => window.clearTimeout(timer); }, [fetchData]);
  useChangeSync(useCallback((topics) => { if (topics.includes('finance')) fetchData(true); }, [fetchData]));

  useEffect(() => {
    if (!modalState.addTransaction) return undefined;
    const transactionTrigger = transactionTriggerRef.current;
    transactionDialogRef.current?.querySelector('[data-finance-initial]')?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') setModalState(state => ({ ...state, addTransaction: false }));
      if (event.key === 'Tab') {
        const focusable = [...(transactionDialogRef.current?.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex="0"]') || [])];
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); transactionTrigger?.focus(); };
  }, [modalState.addTransaction]);

  useEffect(() => { if (txError.length) transactionErrorRef.current?.focus(); }, [txError]);

  const clientPackages = useMemo(() => packages.filter(pkg => String(pkg.client_id) === String(txForm.client_id)), [packages, txForm.client_id]);
  const openTransactionModal = () => { setTxError([]); setTxForm(emptyTransaction()); setModalState(state => ({ ...state, addTransaction: true })); };
  const txErrorFields = new Set(txError.map(error => error.field));

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
      const kind = t.entry_kind || ({ 'إيراد': 'income', 'مصروف': 'expense', 'تحويل وارد': 'transfer_in', 'تحويل صادر': 'transfer_out', 'سحب سلفة': 'advance_out', 'سداد سلفة': 'advance_in', 'سداد مستحقات': 'settlement_out' }[t.type] || 'expense');
      const isCurrentMonth = t.date && t.date.startsWith(selectedMonth);

      const reversedKind = kind === 'reversal' ? String(t.category || '').replace(/^reversal_/, '') : '';
      if (isCurrentMonth) {
        if (kind === 'reversal') {
          if (['income','advance_in','transfer_in'].includes(reversedKind)) {
            if (['income','advance_in'].includes(reversedKind)) total_inc -= amt;
            incomes.push(t);
          } else {
            if (['expense','advance_out'].includes(reversedKind)) total_exp -= amt;
            expenses.push(t);
          }
        } else
        if (['income', 'advance_in', 'transfer_in'].includes(kind)) {
          if (['income', 'advance_in'].includes(kind)) total_inc += amt;
          incomes.push(t);
        } else if (['expense', 'transfer_out', 'advance_out', 'settlement_out', 'reversal'].includes(kind)) {
          if (['expense', 'advance_out'].includes(kind)) total_exp += amt;
          expenses.push(t);
        }
      }

      const displayMethod = formatPaymentMethod(t.method);
      const method = displayMethod === 'نقدي' ? 'كاش' : displayMethod === 'إنستاباي' ? 'انستاباي' : displayMethod;
      if (balances[method] === undefined) balances[method] = 0;

      if (kind === 'reversal') {
        if (['income','advance_in','transfer_in'].includes(reversedKind)) balances[method] -= amt;
        if (['expense','advance_out','settlement_out','transfer_out'].includes(reversedKind)) balances[method] += amt;
      } else if (['income', 'advance_in', 'transfer_in'].includes(kind)) {
        balances[method] += amt;
      } else if (['expense', 'transfer_out'].includes(kind) && t.entity === 'الشركة') {
        balances[method] -= amt;
      } else if (['settlement_out', 'advance_out'].includes(kind)) {
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

    const cash_adj = safeFloat(appConfig['wallet_كاش_adj'] || 0);
    const vodafone_adj = safeFloat(appConfig['wallet_فودافون كاش_adj'] || 0);
    const instapay_adj = safeFloat(appConfig['wallet_انستاباي_adj'] || 0);

    const final_instapay = balances['انستاباي'] + (balances['إنستاباي (InstaPay)'] || 0) + (balances['تحويل بنكي'] || 0) + instapay_adj;
    const final_cash = balances['كاش'] + cash_adj;
    const final_vodafone = balances['فودافون كاش'] + vodafone_adj;

    return { 
      total_inc, total_exp, net_profit, 
      balances: { cash: final_cash, vodafone: final_vodafone, instapay: final_instapay }, 
      ashraf_due, marwa_due, 
      incomes, expenses 
    };
  }, [allTransactions, appConfig, selectedMonth]);

  const { total_inc, total_exp, net_profit, balances, ashraf_due, marwa_due, incomes, expenses } = calculations;

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setTxError([]);
    const errors = [];
    if (safeFloat(txForm.amount) <= 0) errors.push({ field: 'finance-entry-amount', message: 'أدخل مبلغًا أكبر من صفر.' });
    if (!txForm.method) errors.push({ field: 'finance-entry-method', message: 'اختر طريقة الدفع.' });
    if (!txForm.date) errors.push({ field: 'finance-entry-date', message: 'اختر تاريخ العملية.' });
    if (!txForm.detail.trim()) errors.push({ field: 'finance-entry-detail', message: 'اكتب البيان والتفاصيل.' });
    if (txForm.entry_kind === 'income' && txForm.category === 'client_revenue' && !txForm.client_id) errors.push({ field: 'finance-client', message: 'اختر العميل المطلوب لإيراد العميل.' });
    if (txForm.entry_kind === 'income' && txForm.source_type && !txForm.source_id) errors.push({ field: 'finance-source', message: txForm.source_type === 'client_package' ? 'اختر الباقة المباعة المرتبطة.' : 'اختر الخدمة المرتبطة.' });
    if (errors.length) { setTxError(errors); return; }
    const { error } = await dataClient.request('/finance/manual', { method: 'POST', body: JSON.stringify({
      entry_kind: txForm.entry_kind,
      category: txForm.category,
      client_id: txForm.entry_kind === 'income' && txForm.client_id ? Number(txForm.client_id) : null,
      source_type: txForm.entry_kind === 'income' && txForm.source_type ? txForm.source_type : null,
      source_id: txForm.entry_kind === 'income' && txForm.source_id ? Number(txForm.source_id) : null,
      amount: safeFloat(txForm.amount), method: txForm.method, detail: txForm.detail, date: txForm.date,
      entity: txForm.entry_kind === 'expense' ? txForm.entity : 'الشركة',
    }) });

    if (!error) {
      setModalState(s => ({...s, addTransaction: false}));
      setTxForm(emptyTransaction());
      fetchData(true);
    } else {
      setTxError([{ field: 'finance-form', message: error.message || 'حدث خطأ أثناء حفظ المعاملة.' }]);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (transferForm.from_method === transferForm.to_method) {
      alert('لا يمكن التحويل لنفس المحفظة!');
      return;
    }
    const amt = safeFloat(transferForm.amount);
    const { error } = await dataClient.request('/finance/transfer', { method: 'POST', body: JSON.stringify({ ...transferForm, amount: amt }) });
    if (error) return alert(error.message || 'تعذر تسجيل التحويل.');

    setModalState(s => ({...s, transfer: false}));
    setTransferForm({ from_method: 'cash', to_method: 'vodafone_cash', amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
    fetchData(true);
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    await dataClient.request('/finance/manual', { method: 'POST', body: JSON.stringify({
      entry_kind: 'settlement_out', category: 'partner_settlement',
      amount: safeFloat(settleForm.amount),
      method: settleForm.method,
      detail: `سداد مستحقات أ. ${settleForm.partner}`,
      date: settleForm.date,
      entity: settleForm.partner
    }) });
    setModalState(s => ({...s, settleDues: false}));
    setSettleForm({ partner: 'اشرف', amount: '', method: 'cash', date: format(new Date(), 'yyyy-MM-dd') });
    fetchData(true);
  };

  const handleAdvance = async (e) => {
    e.preventDefault();
    await dataClient.request('/finance/manual', { method: 'POST', body: JSON.stringify({
      entry_kind: 'advance_out', category: 'partner_advance',
      amount: safeFloat(advanceForm.amount),
      method: advanceForm.method,
      detail: `سحب سلفة لـ أ. ${advanceForm.partner}`,
      date: advanceForm.date,
      entity: advanceForm.partner
    }) });
    setModalState(s => ({...s, advance: false}));
    setAdvanceForm({ partner: 'اشرف', amount: '', method: 'cash', date: format(new Date(), 'yyyy-MM-dd') });
    fetchData(true);
  };

  const handlePayAdvance = async (e) => {
    e.preventDefault();
    await dataClient.request('/finance/manual', { method: 'POST', body: JSON.stringify({
      entry_kind: 'advance_in', category: 'partner_advance_repayment',
      amount: safeFloat(payAdvanceForm.amount),
      method: payAdvanceForm.method,
      detail: `سداد سلفة من أ. ${payAdvanceForm.partner}`,
      date: payAdvanceForm.date,
      entity: payAdvanceForm.partner
    }) });
    setModalState(s => ({...s, payAdvance: false}));
    setPayAdvanceForm({ partner: 'اشرف', amount: '', method: 'cash', date: format(new Date(), 'yyyy-MM-dd') });
    fetchData(true);
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
      await dataClient.from('app_config').update({ value: new_adj.toString() }).eq('key', adj_key);
    } else {
      await dataClient.from('app_config').insert([{ key: adj_key, value: new_adj.toString() }]);
    }

    setModalState(s => ({...s, adjustPartner: false}));
    fetchData(true);
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
    
    await dataClient.request('/finance/manual', { method: 'POST', body: JSON.stringify({
      entry_kind: type === 'إيراد' ? 'income' : 'expense',
      category: 'wallet_adjustment',
      amount: amount,
      method: method,
      detail: detailText,
      date: format(new Date(), 'yyyy-MM-dd'),
      entity: 'الشركة'
    }) });
    
    setModalState(s => ({...s, adjustWallet: false}));
    fetchData(true);
  };

  const openOwnerAction = (entry, mode, event) => {
    if (!isOwner) return;
    ownerActionTriggerRef.current = event?.currentTarget || document.activeElement;
    const allocation = Object.fromEntries((entry.package_ids || []).map(id => [id, '']));
    setOwnerAction({ open: true, mode, entry, amount: String(entry.amount || ''), method: entry.method || 'cash', detail: entry.detail || '', date: entry.date || format(new Date(), 'yyyy-MM-dd'), reason: '', confirmed: false, error: '', requiresAllocation: (entry.package_ids || []).length > 1 && entry.source_type === 'payment', allocation, replacementAllocation: { ...allocation } });
  };

  const closeOwnerAction = useCallback(() => setOwnerAction(state => ({ ...state, open: false })), []);

  useEffect(() => {
    if (!ownerAction.open) return undefined;
    const dialog = ownerDialogRef.current;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => [...(dialog?.querySelectorAll(focusableSelector) || [])].filter(element => element.offsetParent !== null);
    const previousOverflow = document.body.style.overflow;
    const background = [...document.querySelectorAll('.erp-sidebar,.erp-mobile-header,.erp-bottom-nav,.finance-page > :not(.erp-modal-overlay)')];
    const previousA11y = background.map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
    background.forEach(element => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => (dialog?.querySelector('[data-owner-initial]') || focusables()[0])?.focus());
    const handleKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeOwnerAction(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables(); if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousA11y.forEach(({ element, inert, ariaHidden }) => { element.inert = inert; if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden); });
      window.requestAnimationFrame(() => ownerActionTriggerRef.current?.focus());
    };
  }, [ownerAction.open, closeOwnerAction]);
  const submitOwnerAction = async event => {
    event.preventDefault(); const entry = ownerAction.entry; if (!entry) return;
    if (ownerAction.requiresAllocation) {
      const originalTotal = Object.values(ownerAction.allocation).reduce((sum, value) => sum + Number(value || 0), 0);
      const replacementTotal = Object.values(ownerAction.replacementAllocation).reduce((sum, value) => sum + Number(value || 0), 0);
      const invalid = Math.abs(originalTotal - Number(entry.amount || 0)) >= .005 || (ownerAction.mode === 'correct' && Math.abs(replacementTotal - Number(ownerAction.amount || 0)) >= .005);
      if (invalid) {
        setOwnerAction(state => ({ ...state, error: 'راجع التوزيع: يجب أن يساوي مجموع كل عمود المبلغ المقابل بالقرش.' }));
        window.requestAnimationFrame(() => ownerDialogRef.current?.querySelector('[data-allocation-input]')?.focus());
        return;
      }
    }
    const distribution = Object.entries(ownerAction.allocation).map(([packageId, amount]) => ({ package_id: Number(packageId), amount }));
    const transfer = ['transfer_in','transfer_out'].includes(entry.entry_kind);
    const paymentId = entry.source_type === 'payment' ? entry.source_id : entry.payment_ids?.[0];
    let endpoint;
    if (transfer) endpoint = `/finance/transfers/${encodeURIComponent(String(entry.correlation_id || '').replace(/:(out|in)$/,''))}/void`;
    else if (paymentId) endpoint = `/payments/${paymentId}/${ownerAction.mode === 'correct' ? 'correct' : 'void'}`;
    else endpoint = `/finance/${entry.id}/${ownerAction.mode === 'correct' ? 'correct' : 'void'}`;
    const replacementDistribution = Object.entries(ownerAction.replacementAllocation).map(([packageId, amount]) => ({ package_id: Number(packageId), amount }));
    const payload = { reason: ownerAction.reason, allocation_distribution: ownerAction.requiresAllocation ? distribution : undefined, replacement_distribution: ownerAction.requiresAllocation && ownerAction.mode === 'correct' ? replacementDistribution : undefined };
    if (ownerAction.mode === 'correct') Object.assign(payload, { amount: ownerAction.amount, method: ownerAction.method, detail: ownerAction.detail, date: ownerAction.date, entry_kind: entry.entry_kind });
    const { error } = await dataClient.request(endpoint, { method: 'POST', body: JSON.stringify(payload) });
    if (error) return setOwnerAction(state => ({ ...state, error: error.message || 'تعذر تنفيذ الإجراء.', requiresAllocation: state.requiresAllocation || error.code === 'ambiguous_legacy_allocation' }));
    closeOwnerAction(); await fetchData(true);
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
    <div className="container-fluid p-0 finance-page">
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
      <ERPPageHero
        icon={ChartNoAxesCombined}
        eyebrow="الحسابات والتدفقات النقدية"
        title="الإدارة المالية"
        description="تابع الإيرادات والمصروفات والمستحقات وحركة المحافظ للفترة المختارة."
        actions={<>
          <button onClick={() => window.print()}><i className="fas fa-print"></i> طباعة</button>
          <button onClick={() => setModalState({...modalState, transfer: true})}><i className="fas fa-exchange-alt"></i> تحويل</button>
          {isAdmin && <button ref={transactionTriggerRef} data-variant="primary" onClick={openTransactionModal}><i className="fas fa-plus-circle"></i> عملية مالية</button>}
        </>}
        details={<div className="month-selector" aria-label="الشهر المالي">
            <button onClick={() => changeMonth(1)} className="btn btn-sm btn-light rounded-circle text-primary"><i className="fas fa-chevron-right"></i></button>
            <span className="m-0 px-4 fw-bold" style={{ color: '#2b3674' }}>{selectedMonth}</span>
            <button onClick={() => changeMonth(-1)} className="btn btn-sm btn-light rounded-circle text-primary"><i className="fas fa-chevron-left"></i></button>
        </div>}
      />
      {loadError && <div className="finance-load-error" role="alert"><AlertCircle/><span>{loadError}</span><button type="button" onClick={() => fetchData(true)}>إعادة المحاولة</button></div>}

      {/* Overview Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card border-0 rounded-4 p-3 h-100 gradient-success shadow-sm wallet-card position-relative overflow-hidden">
            <i className="fas fa-arrow-up position-absolute end-0 top-0 mt-3 ms-3 opacity-25" style={{ fontSize: '60px', transform: 'scaleX(-1)' }}></i>
            <div className="position-relative z-1">
              <p className="mb-1 fw-bold opacity-75 small">إيرادات ({format(parseISO(`${selectedMonth}-01`), 'MM-yy')})</p>
              <h3 className="fw-bold m-0">{formatEGP(total_inc)}</h3>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 rounded-4 p-3 h-100 gradient-danger shadow-sm wallet-card position-relative overflow-hidden">
            <i className="fas fa-arrow-down position-absolute end-0 top-0 mt-3 ms-3 opacity-25" style={{ fontSize: '60px', transform: 'scaleX(-1)' }}></i>
            <div className="position-relative z-1">
              <p className="mb-1 fw-bold opacity-75 small">مصروفات ({format(parseISO(`${selectedMonth}-01`), 'MM-yy')})</p>
              <h3 className="fw-bold m-0">{formatEGP(total_exp)}</h3>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 rounded-4 p-3 p-md-4 h-100 gradient-primary shadow-sm wallet-card position-relative overflow-hidden">
            <i className="fas fa-star position-absolute end-0 top-0 mt-3 ms-3 opacity-25" style={{ fontSize: '80px' }}></i>
            <div className="position-relative z-1">
              <p className="mb-1 fw-bold opacity-75">صافي الأرباح للشهر</p>
              <h2 className="fw-bold m-0">{formatEGP(net_profit)}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Vault Balances */}
      <h5 className="fw-bold mb-3" style={{ color: 'var(--erp-text-main)' }}>
        <i className="fas fa-wallet ms-2 text-muted"></i> أرصدة الخزائن الحالية (تراكمي)
      </h5>
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 wallet-card h-100" style={{ background: 'var(--erp-surface)' }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div style={{ background: 'rgba(25, 135, 84, 0.1)', color: '#198754', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-money-bill-wave fs-5"></i>
              </div>
              {isAdmin && (
                <button className="btn btn-link p-0 text-primary no-print" title="تسوية الرصيد" onClick={() => openAdjustWalletModal('كاش', balances.cash)}><i className="fas fa-pen"></i></button>
              )}
            </div>
            <p className="fw-bold mb-1 small" style={{ color: 'var(--erp-text-muted)', fontSize: '0.8rem' }}>الكاش (النقدية)</p>
            <h4 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)' }}>{formatEGP(balances.cash)}</h4>
          </div>
        </div>
        <div className="col-6 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 wallet-card h-100" style={{ background: 'var(--erp-surface)' }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div style={{ background: 'rgba(220, 53, 69, 0.1)', color: '#dc3545', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-mobile-alt fs-5"></i>
              </div>
              {isAdmin && (
                <button className="btn btn-link p-0 text-danger no-print" title="تسوية الرصيد" onClick={() => openAdjustWalletModal('فودافون كاش', balances.vodafone)}><i className="fas fa-pen"></i></button>
              )}
            </div>
            <p className="fw-bold mb-1 small" style={{ color: 'var(--erp-text-muted)', fontSize: '0.8rem' }}>فودافون كاش</p>
            <h4 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)' }}>{formatEGP(balances.vodafone)}</h4>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 wallet-card h-100" style={{ background: 'var(--erp-surface)' }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div style={{ background: '#f4f0ff', color: '#6f42c1', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-paper-plane fs-5"></i>
              </div>
              {isAdmin && (
                <button className="btn btn-link p-0 no-print" style={{ color: '#6f42c1' }} title="تسوية الرصيد" onClick={() => openAdjustWalletModal('انستاباي', balances.instapay)}><i className="fas fa-pen"></i></button>
              )}
            </div>
            <p className="fw-bold mb-1 small" style={{ color: 'var(--erp-text-muted)', fontSize: '0.8rem' }}>حساب البنك (InstaPay)</p>
            <h4 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)' }}>{formatEGP(balances.instapay)}</h4>
          </div>
        </div>
      </div>

      {/* Partners Dues */}
      <div className="row g-3 mb-4">
        {[
          { name: 'أ. أشرف', key: 'اشرف', due: ashraf_due },
          { name: 'أ. مروة', key: 'مروة', due: marwa_due }
        ].map(partner => (
          <div className="col-6" key={partner.key}>
            <div className="card border-0 shadow-sm rounded-4 p-2 p-md-3 d-flex flex-column align-items-center justify-content-center wallet-card text-center h-100" style={{ background: 'var(--erp-surface)' }}>
              <div className="d-flex flex-column flex-md-row align-items-center mb-2">
                <div className="mb-2 mb-md-0 ms-md-2" style={{ background: 'var(--erp-bg)', padding: '10px', borderRadius: '50%' }}>
                  <i className="fas fa-user text-dark" style={{ fontSize: '1rem' }}></i>
                </div>
                <h6 className="fw-bold m-0" style={{ color: 'var(--erp-text-main)', fontSize: '0.9rem' }}>
                  {partner.name}
                  {isAdmin && <button className="btn btn-sm btn-link p-0 ms-1" style={{ color: 'var(--erp-primary)' }} onClick={() => openAdjustPartnerModal(partner.key, partner.due)}><i className="fas fa-edit"></i></button>}
                </h6>
              </div>
              <div className="text-center w-100">
                {partner.due > 0 && <h5 className="fw-bold m-0 mb-1" style={{ color: 'var(--erp-success)' }}>له: {formatEGP(partner.due)}</h5>}
                {partner.due < 0 && <h5 className="fw-bold m-0 mb-1" style={{ color: 'var(--erp-danger)' }}>عليه: {formatEGP(partner.due * -1)}</h5>}
                {partner.due === 0 && <h5 className="fw-bold m-0 mb-1" style={{ color: 'var(--erp-text-muted)' }}>0 <small style={{ fontSize: '0.7rem' }}>ج</small></h5>}
                
                <div className="d-flex gap-1 justify-content-center mt-2 flex-wrap">
                  <button className="btn btn-outline-danger rounded-pill px-3 py-1 fw-bold no-print" style={{ fontSize: '0.75rem' }} onClick={() => openAdvanceModal(partner.key)}>سلفة</button>
                  {partner.due > 0 && <button className="btn btn-outline-success rounded-pill px-3 py-1 fw-bold no-print" style={{ fontSize: '0.75rem' }} onClick={() => openSettleModal(partner.key, partner.due)}>سداد</button>}
                  {partner.due < 0 && <button className="btn btn-outline-primary rounded-pill px-3 py-1 fw-bold no-print" style={{ fontSize: '0.75rem' }} onClick={() => openPayAdvanceModal(partner.key, partner.due * -1)}>تسديد</button>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="finance-ledgers-grid" aria-label="دفتر الإيرادات والمصروفات">
        <FinanceLedgerPanel kind="income" entries={incomes} total={total_inc} isOwner={isOwner} onAction={openOwnerAction}/>
        <FinanceLedgerPanel kind="expense" entries={expenses} total={total_exp} isOwner={isOwner} onAction={openOwnerAction}/>
      </div>

      {/* --- MODALS --- */}
      
      {/* 1. Transaction Modal */}
      {modalState.addTransaction && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, addTransaction: false})}>
          <div ref={transactionDialogRef} className="erp-modal-content finance-manual-dialog border-0 shadow-lg p-0" role="dialog" aria-modal="true" aria-labelledby="finance-manual-title" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4" style={{ background: 'var(--erp-primary)', color: 'white' }}>
              <h5 id="finance-manual-title" className="fw-bold m-0 d-flex align-items-center"><i className="fas fa-file-invoice-dollar me-2"></i> تسجيل عملية مالية يدوية</h5>
              <button type="button" className="finance-dialog-close" aria-label="إغلاق" onClick={() => setModalState(state => ({ ...state, addTransaction: false }))}>×</button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-4 bg-white" noValidate>
              {txError.length > 0 && <div id="finance-form-errors" ref={transactionErrorRef} className="finance-form-error" role="alert" tabIndex="-1"><AlertCircle/><div><strong>راجع الحقول المطلوبة التالية</strong><ul>{txError.map(error => <li key={`${error.field}-${error.message}`}>{error.field === 'finance-form' ? error.message : <a href={`#${error.field}`} onClick={event => { event.preventDefault(); document.getElementById(error.field)?.focus(); }}>{error.message}</a>}</li>)}</ul></div></div>}
              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="finance-entry-type" className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>نوع العملية</label>
                  <select id="finance-entry-type" data-finance-initial className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.type} onChange={e => setTxForm({...txForm,type:e.target.value,entry_kind:e.target.value==='إيراد'?'income':'expense',category:e.target.value==='إيراد'?'other_income':'general_expense',client_id:'',source_type:'',source_id:'',entity:'الشركة'})} required>
                    <option value="إيراد" style={{ color: 'var(--erp-success)' }}>إيراد (+)</option>
                    <option value="مصروف" style={{ color: 'var(--erp-danger)' }}>مصروف (-)</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label htmlFor="finance-entry-date" className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>تاريخ العملية</label>
                  <input id="finance-entry-date" type="date" className="form-control border-0" style={{ background: 'var(--erp-bg)' }} value={txForm.date} onChange={e => setTxForm({...txForm, date: e.target.value})} required aria-invalid={txErrorFields.has('finance-entry-date')||undefined} aria-describedby={txErrorFields.has('finance-entry-date')?'finance-form-errors':undefined} />
                </div>
                <div className="col-md-6">
                  <label htmlFor="finance-entry-amount" className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>المبلغ</label>
                  <input id="finance-entry-amount" type="number" step="0.01" className="form-control border-0 fw-bold text-center" style={{ background: 'var(--erp-bg)' }} value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} required aria-invalid={txErrorFields.has('finance-entry-amount')||undefined} aria-describedby={txErrorFields.has('finance-entry-amount')?'finance-form-errors':undefined} />
                </div>
                <div className="col-md-6">
                  <label htmlFor="finance-entry-method" className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>الخزينة (طريقة الدفع)</label>
                  <select id="finance-entry-method" className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.method} onChange={e => setTxForm({...txForm, method: e.target.value})} required aria-invalid={txErrorFields.has('finance-entry-method')||undefined} aria-describedby={txErrorFields.has('finance-entry-method')?'finance-form-errors':undefined}>
                    {methodsList.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6"><label htmlFor="finance-entry-category" className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>التصنيف المحاسبي</label><select id="finance-entry-category" className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.category} onChange={e => setTxForm({...txForm,category:e.target.value})} required>{txForm.entry_kind==='income'?<><option value="client_revenue">إيراد عميل</option><option value="other_income">إيراد آخر</option></>:<><option value="rent">إيجار</option><option value="equipment">معدات وصيانة</option><option value="utilities">مرافق واتصالات</option><option value="marketing">تسويق وإعلانات</option><option value="transport">انتقالات</option><option value="general_expense">مصروف عام</option></>}</select></div>
                {txForm.entry_kind === 'income' && <>
                  <div className="col-md-6 finance-conditional-field"><label htmlFor="finance-client" className="small fw-bold mb-1">اسم العميل {txForm.category === 'client_revenue' ? <b>مطلوب</b> : <span>اختياري</span>}</label><select id="finance-client" className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.client_id} onChange={e => setTxForm({...txForm,client_id:e.target.value,source_id:txForm.source_type==='client_package'?'':txForm.source_id})} required={txForm.category === 'client_revenue'} aria-invalid={txErrorFields.has('finance-client')||undefined} aria-describedby={txErrorFields.has('finance-client')?'finance-form-errors':undefined}><option value="">{txForm.category === 'client_revenue' ? 'اختر العميل' : 'إيراد عام بلا عميل'}</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
                  <div className="col-md-6 finance-conditional-field"><label htmlFor="finance-relation" className="small fw-bold mb-1">الربط التشغيلي <span>اختياري</span></label><select id="finance-relation" className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.source_type} onChange={e => setTxForm({...txForm,source_type:e.target.value,source_id:''})}><option value="">غير مرتبط بباقة أو خدمة</option><option value="client_package" disabled={!txForm.client_id}>باقة مباعة للعميل</option><option value="service">خدمة</option></select></div>
                  {txForm.source_type && <div className="col-12 finance-conditional-field"><label htmlFor="finance-source" className="small fw-bold mb-1">{txForm.source_type === 'client_package' ? 'الباقة المباعة' : 'الخدمة'} <b>مطلوب</b></label><select id="finance-source" className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.source_id} onChange={e => setTxForm({...txForm,source_id:e.target.value})} required aria-invalid={txErrorFields.has('finance-source')||undefined} aria-describedby={txErrorFields.has('finance-source')?'finance-form-errors':undefined}><option value="">اختر {txForm.source_type === 'client_package' ? 'الباقة' : 'الخدمة'}</option>{(txForm.source_type === 'client_package' ? clientPackages : services).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
                  {txForm.source_type === 'client_package' && <div className="col-12"><div className="finance-package-warning"><PackageOpen/><p><strong>هذا الربط وصفي في دفتر الحسابات فقط.</strong>لا يغيّر المدفوع على الباقة أو الفاتورة. سجّل الدفعة الفعلية من مسار الدفع/إثبات التحويل.</p></div></div>}
                </>}
                {txForm.type === 'مصروف' && (
                  <div className="col-12 mt-3 animate__animated animate__fadeIn">
                    <label htmlFor="finance-expense-entity" className="small fw-bold mb-1" style={{ color: 'var(--erp-danger)' }}>دُفع بواسطة (الجهة)</label>
                    <select id="finance-expense-entity" className="form-select border-0 fw-bold" style={{ background: 'rgba(220, 53, 69, 0.1)', color: 'var(--erp-danger)' }} value={txForm.entity} onChange={e => setTxForm({...txForm, entity: e.target.value})} required>
                      <option value="الشركة">من خزينة الشركة</option>
                      {partnersList.map(p => <option key={p} value={p}>أ. {p} (من ماله الخاص)</option>)}
                    </select>
                  </div>
                )}
                <div className="col-12 mt-3">
                  <label htmlFor="finance-entry-detail" className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>البيان والتفاصيل</label>
                  <input id="finance-entry-detail" type="text" className="form-control border-0 py-2" style={{ background: 'var(--erp-bg)' }} value={txForm.detail} onChange={e => setTxForm({...txForm, detail: e.target.value})} placeholder="مثال: فاتورة إنترنت، دفعة حجز..." required aria-invalid={txErrorFields.has('finance-entry-detail')||undefined} aria-describedby={txErrorFields.has('finance-entry-detail')?'finance-form-errors':undefined} />
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
                    {methodsList.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>إلى محفظة (تُضاف إليها)</label>
                  <select className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={transferForm.to_method} onChange={e => setTransferForm({...transferForm, to_method: e.target.value})} required>
                    {methodsList.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>المبلغ المحول ({CURRENCY_LABEL})</label>
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
                  {methodsList.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
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
                  {methodsList.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
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
                  {methodsList.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
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
                <h3 className="fw-bold m-0 mt-1" style={{ color: 'var(--erp-text-main)' }}>{formatEGP(adjustDueForm.current_due)}</h3>
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
                <h3 className="fw-bold m-0 mt-1" style={{ color: 'var(--erp-text-main)' }}>{formatEGP(adjustWalletForm.current_balance)}</h3>
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

      {ownerAction.open && <FinanceOwnerDialog dialogRef={ownerDialogRef} state={ownerAction} setState={setOwnerAction} packages={packages} onClose={closeOwnerAction} onSubmit={submitOwnerAction}/>}

    </div>
  );
};

function RevenueIdentity({ entry }) {
  const clientName = entry.client_name || 'إيراد عام';
  const sourceLabel = entry.source_label || 'غير مرتبط بباقة أو خدمة';
  const labels = entry.source_labels || [];
  return <div className={`finance-revenue-identity ${entry.client_name ? '' : 'general'}`}>
    <span className="finance-revenue-avatar" aria-hidden="true">{entry.client_name ? <UserRound/> : <Layers3/>}</span>
    <div><strong>{clientName}</strong><span title={labels.join(' · ') || sourceLabel}><PackageOpen/>{sourceLabel}{Number(entry.source_extra_count) > 0 && <b>+{entry.source_extra_count} أخرى</b>}</span></div>
  </div>;
}

const FINANCE_CATEGORY_LABELS = {
  client_revenue: 'إيراد عميل', client_payment: 'دفعة عميل', other_income: 'إيراد آخر', package_payment: 'دفعة باقة', payment_correction: 'تصحيح دفعة',
  rent: 'إيجار', equipment: 'معدات وصيانة', utilities: 'مرافق واتصالات', marketing: 'تسويق وإعلانات',
  transport: 'انتقالات', general_expense: 'مصروف عام', reminder_expense: 'سداد تذكير', wallet_adjustment: 'تسوية خزينة',
  partner_settlement: 'سداد مستحقات', partner_advance: 'سلفة شريك', partner_advance_repayment: 'سداد سلفة', internal_transfer: 'تحويل داخلي',
};

const financeCategoryLabel = entry => {
  const category = String(entry.category || '').replace(/^reversal_/, '');
  return FINANCE_CATEGORY_LABELS[category] || category.replaceAll('_', ' ') || 'غير مصنف';
};

const financeDayName = value => {
  try { return format(parseISO(value), 'EEEE', { locale: ar }); } catch { return 'تاريخ غير محدد'; }
};

function FinanceEntryState({ entry }) {
  if (entry.entry_kind === 'reversal') return <span className="finance-entry-state reversal"><ShieldCheck/> قيد عكسي</span>;
  if (entry.voided_at) return <span className="finance-entry-state voided"><ShieldCheck/> ملغى وموثق</span>;
  if (['transfer_in', 'transfer_out'].includes(entry.entry_kind)) return <span className="finance-entry-state transfer"><Layers3/> تحويل داخلي مترابط</span>;
  if (entry.is_system) return <span className="finance-entry-state system"><ShieldCheck/> قيد نظامي</span>;
  if (entry.source_type) return <span className="finance-entry-state linked"><Layers3/> مرتبط بالمصدر</span>;
  return <span className="finance-entry-state manual">قيد يدوي</span>;
}

function ExpenseIdentity({ entry }) {
  return <div className="finance-expense-identity">
    <strong>{entry.detail || 'مصروف بلا وصف'}</strong>
    <span>{entry.entity || 'الشركة'} · {financeCategoryLabel(entry)}</span>
  </div>;
}

function FinanceLedgerPanel({ kind, entries, total, isOwner, onAction }) {
  const income = kind === 'income';
  const title = income ? 'الإيرادات' : 'المصروفات';
  const headingId = `finance-${kind}-heading`;
  return <section className={`finance-ledger-panel ${kind}`} aria-labelledby={headingId}>
    <header className="finance-ledger-heading">
      <div><span>{income ? 'دفتر الوارد' : 'دفتر الصادر'}</span><h2 id={headingId}>{title}</h2><p>{entries.length} {entries.length === 1 ? 'حركة' : 'حركات'} في الفترة المحددة</p></div>
      <div className="finance-ledger-total"><span>صافي الفترة</span><strong>{formatEGP(total)}</strong></div>
    </header>
    <div className="finance-ledger-body">
      <div className="finance-ledger-table-wrap">
        <table className="finance-ledger-table">
          <caption className="visually-hidden">{title} للفترة المحددة، متضمنة المبلغ وإجراءات المالك</caption>
          <thead><tr><th scope="col">{income ? 'العميل والمصدر' : 'البيان والجهة'}</th><th scope="col">تفاصيل الحركة</th><th scope="col">المبلغ والإجراءات</th></tr></thead>
          <tbody>
            {entries.map(entry => <FinanceLedgerRow key={entry.id} entry={entry} kind={kind} isOwner={isOwner} onAction={onAction}/>)}
            {!entries.length && <tr><td colSpan="3"><FinanceLedgerEmpty kind={kind}/></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="finance-ledger-cards" aria-label={`بطاقات ${title}`}>
        {entries.map(entry => <FinanceLedgerCard key={entry.id} entry={entry} kind={kind} isOwner={isOwner} onAction={onAction}/>)}
        {!entries.length && <FinanceLedgerEmpty kind={kind}/>}
      </div>
    </div>
  </section>;
}

function FinanceLedgerRow({ entry, kind, isOwner, onAction }) {
  const income = kind === 'income';
  return <tr className={entry.entry_kind === 'reversal' ? 'is-reversal' : ''}>
    <td>{income ? <RevenueIdentity entry={entry}/> : <ExpenseIdentity entry={entry}/>}<span className="finance-row-date">{financeDayName(entry.date)} · {entry.date}</span></td>
    <td><p className="finance-row-description">{income ? entry.detail : financeCategoryLabel(entry)}</p><div className="finance-row-tags"><span>{formatPaymentMethod(entry.method)}</span><FinanceEntryState entry={entry}/></div></td>
    <td><FinanceLedgerAmount entry={entry} kind={kind}/>{isOwner && <FinanceOwnerActions entry={entry} onAction={onAction}/>}</td>
  </tr>;
}

function FinanceLedgerAmount({ entry, kind }) {
  const prefix = entry.entry_kind === 'reversal' ? '↶ ' : kind === 'income' ? '+' : '−';
  return <strong className={`finance-ledger-amount ${entry.entry_kind === 'reversal' ? 'reversal' : ''}`}>{prefix}{formatEGP(entry.amount)}</strong>;
}

function FinanceLedgerCard({ entry, kind, isOwner, onAction }) {
  const income = kind === 'income';
  return <article className={`finance-ledger-card ${kind} ${entry.entry_kind === 'reversal' ? 'is-reversal' : ''}`}>
    <header>{income ? <RevenueIdentity entry={entry}/> : <ExpenseIdentity entry={entry}/>}<FinanceLedgerAmount entry={entry} kind={kind}/></header>
    <p>{income ? entry.detail : financeCategoryLabel(entry)}</p>
    <footer><span>{financeDayName(entry.date)} · {entry.date}</span><span className="finance-method-chip">{formatPaymentMethod(entry.method)}</span><FinanceEntryState entry={entry}/></footer>
    {isOwner && <FinanceOwnerActions entry={entry} onAction={onAction}/>}
  </article>;
}

function FinanceLedgerEmpty({ kind }) {
  return <div className="finance-ledger-empty"><strong>{kind === 'income' ? 'لا توجد إيرادات' : 'لا توجد مصروفات'}</strong><span>لا توجد حركات مطابقة للشهر المحدد.</span></div>;
}

function FinanceOwnerActions({entry,onAction}) {
  const locked=entry.entry_kind==='reversal'||entry.voided_at;const transfer=['transfer_in','transfer_out'].includes(entry.entry_kind);
  return <div className="finance-owner-actions no-print" aria-label="إجراءات المالك"><button type="button" disabled={locked||transfer} onClick={event=>onAction(entry,'correct',event)}>تعديل</button><button type="button" className="void" disabled={locked} onClick={event=>onAction(entry,'void',event)}>{transfer?'إلغاء الطرفين':'إلغاء'}</button>{locked&&<small>محفوظ كسجل ملغى</small>}</div>;
}

function FinanceOwnerDialog({dialogRef,state,setState,packages,onClose,onSubmit}) {
  const entry=state.entry||{};
  const allocationTotal=Object.values(state.allocation).reduce((sum,value)=>sum+Number(value||0),0);
  const replacementTotal=Object.values(state.replacementAllocation).reduce((sum,value)=>sum+Number(value||0),0);
  const needsAllocation=state.requiresAllocation;const correct=state.mode==='correct';const transfer=['transfer_in','transfer_out'].includes(entry.entry_kind);
  const originalRemaining=Number(entry.amount||0)-allocationTotal;const replacementRemaining=Number(state.amount||0)-replacementTotal;
  return <div className="erp-modal-overlay finance-owner-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><form ref={dialogRef} className="finance-owner-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-owner-title" aria-describedby="finance-owner-description" onSubmit={onSubmit}>
    <button data-owner-initial type="button" className="finance-owner-close" onClick={onClose} aria-label="إغلاق نافذة إجراء المالك"><X/></button><span className="finance-owner-kicker"><ShieldCheck/> إجراء مالك موثق</span><h2 id="finance-owner-title">{transfer?'إلغاء التحويل الداخلي':correct?'تصحيح الحركة':'إلغاء الأثر المالي'}</h2><p id="finance-owner-description">{entry.detail} · {formatEGP(entry.amount)}</p>
    {transfer&&<div className="finance-transfer-impact" role="note"><strong>سيُعكس طرفا التحويل معًا</strong><span>الخزينة المرسلة + الخزينة المستلمة</span><b>صافي الشركة بعد العكس: صفر</b></div>}
    {correct&&<div className="finance-owner-grid"><label>المبلغ الجديد<input type="number" min="0.01" step="0.01" required value={state.amount} onChange={event=>setState({...state,amount:event.target.value})}/></label><label>طريقة الدفع<input required value={state.method} onChange={event=>setState({...state,method:event.target.value})}/></label><label>التاريخ<input type="date" required value={state.date} onChange={event=>setState({...state,date:event.target.value})}/></label><label>البيان<input required value={state.detail} onChange={event=>setState({...state,detail:event.target.value})}/></label></div>}
    <section className="finance-impact-strip"><article><span>القيد الأصلي</span><b>{formatEGP(entry.amount)}</b></article><article><span>الخزينة</span><b>{transfer?'عكس الخروج والدخول':correct?`عكس ثم ${formatEGP(state.amount)}`:'عكس كامل'}</b></article><article><span>المصدر</span><b>{entry.source_type==='payment'?'دفعة وحصص وفاتورة':transfer?'تحويل داخلي · طرفان':'قيد يدوي'}</b></article></section>
    {needsAllocation&&<section className="finance-allocation"><h3>توزيع الدفعة القديمة مطلوب</h3><p>إجمالي الدفعة الأصلية: <b>{formatEGP(entry.amount)}</b>. أدخل كل حصة في عمودها؛ لن يخمّن النظام التوزيع.</p><div className={`finance-allocation-head ${correct?'with-replacement':''}`}><span>الباقة</span><b>التوزيع الأصلي</b>{correct&&<b>التوزيع البديل</b>}</div>{Object.keys(state.allocation).map((packageId,index)=>{const pkg=packages.find(item=>Number(item.id)===Number(packageId));const name=pkg?.name||`باقة #${packageId}`;return <div className={`finance-allocation-row ${correct?'with-replacement':''}`} key={packageId}><strong>{name}</strong><label><span>الأصلي</span><input data-allocation-input={index===0?true:undefined} aria-label={`التوزيع الأصلي لـ ${name}`} type="number" min="0" step="0.01" required value={state.allocation[packageId]} onChange={event=>setState({...state,allocation:{...state.allocation,[packageId]:event.target.value}})}/></label>{correct&&<label><span>البديل</span><input aria-label={`التوزيع البديل لـ ${name}`} type="number" min="0" step="0.01" required value={state.replacementAllocation[packageId]} onChange={event=>setState({...state,replacementAllocation:{...state.replacementAllocation,[packageId]:event.target.value}})}/></label>}</div>})}<div className="finance-allocation-totals"><strong className={Math.abs(originalRemaining)<.005?'balanced':'unbalanced'}>الأصلية {formatEGP(allocationTotal)} · المتبقي {formatEGP(originalRemaining)}</strong>{correct&&<strong className={Math.abs(replacementRemaining)<.005?'balanced':'unbalanced'}>البديلة {formatEGP(replacementTotal)} · المتبقي {formatEGP(replacementRemaining)}</strong>}</div></section>}
    {state.error&&<div className="finance-owner-error" role="alert"><AlertCircle/>{state.error}</div>}<label className="finance-owner-reason">سبب {correct?'التصحيح':'الإلغاء'}<textarea minLength="5" required rows="3" value={state.reason} onChange={event=>setState({...state,reason:event.target.value})}/></label><label className="finance-owner-confirm"><input type="checkbox" checked={state.confirmed} onChange={event=>setState({...state,confirmed:event.target.checked})}/> أفهم أن التاريخ لن يُحذف وسيُنشأ قيد عكسي موثق{transfer?' لطرفي التحويل معًا':''}.</label><button className={correct?'correct':'void'} disabled={!state.confirmed||state.reason.trim().length<5}>{correct?'حفظ كعكس + بديل':transfer?'إلغاء طرفي التحويل':'تأكيد الإلغاء الموثق'}</button>
  </form></div>;
}

export default ERPFinance;
