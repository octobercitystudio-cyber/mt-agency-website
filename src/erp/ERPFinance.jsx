import { PAYMENT_METHOD_OPTIONS, normalizePaymentMethod } from '../lib/paymentMethods';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dataClient } from '../dataClient';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { AlertCircle, ArrowDown, ArrowLeftRight, ArrowUp, ChartNoAxesCombined, ChevronLeft, ChevronRight, CirclePlus, Info, PackageOpen, Printer, ShieldCheck, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ERPPageHero from './ERPPageHero';
import { CURRENCY_LABEL, formatEGP, formatPaymentMethod } from '../lib/businessFormat';
import { calculateOperationalFinanceMovement, normalizeFinanceEntryKind } from '../lib/financeMetrics';
import useChangeSync from '../hooks/useChangeSync';
import { useData } from '../store/DataContext';
import ClientCombobox from '../components/ClientCombobox';
import FinanceClearLedger, { FinanceOverview, FinanceWallets } from './FinanceClearLedger';
import FinanceReceivablesDialog from './FinanceReceivablesDialog';
import { safeUiError } from '../lib/uiError';
import './ERPFinance.css';

let globalFinanceCache = null;
const packagePaymentRequestKey = () => `finance-package-payment-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const ERPFinance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useData();
  const [allTransactions, setAllTransactions] = useState(globalFinanceCache || []);
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [services, setServices] = useState([]);
  const [employeeAccounts, setEmployeeAccounts] = useState([]);
  const [employeeAccountsWarning, setEmployeeAccountsWarning] = useState('');
  const [loading, setLoading] = useState(!globalFinanceCache);
  const [loadError, setLoadError] = useState('');
  const [receivables, setReceivables] = useState({ loading: true, error: '', data: null });
  const [receivablesOpen, setReceivablesOpen] = useState(false);
  const receivablesSequenceRef = useRef(0);
  const receivablesTriggerRef = useRef(null);
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [financePeriod, setFinancePeriod] = useState(null);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [periodError, setPeriodError] = useState('');
  const isAdmin = ['owner', 'admin'].includes(currentUser?.role);
  const isOwner = currentUser?.role === 'owner';
  const employeeFilter = searchParams.get('employee_user_id') || '';
  const targetEntryId = searchParams.get('finance_entry_id') || '';
  const [ownerAction, setOwnerAction] = useState({ open: false, mode: 'void', entry: null, amount: '', method: '', detail: '', date: '', reason: '', confirmed: false, error: '', requiresAllocation: false, allocation: {}, replacementAllocation: {} });

  // Modals States
  const [modalState, setModalState] = useState({
    transfer: false,
    addTransaction: false
  });

  // Form States
  const selectedPeriodDate = () => selectedMonth === format(new Date(), 'yyyy-MM') ? format(new Date(), 'yyyy-MM-dd') : `${selectedMonth}-01`;
  const emptyTransaction = () => ({ type: 'إيراد', entry_kind: 'income', category: 'other_income', client_id: '', employee_user_id: 'company', source_type: '', source_id: '', amount: '', method: 'cash', detail: '', date: selectedPeriodDate(), entity: 'الشركة' });
  const [txForm, setTxForm] = useState(emptyTransaction);
  const [txError, setTxError] = useState([]);
  const transactionDialogRef = useRef(null);
  const transactionErrorRef = useRef(null);
  const transactionTriggerRef = useRef(null);
  const transactionRequestKeyRef = useRef('');
  const ownerDialogRef = useRef(null);
  const ownerActionTriggerRef = useRef(null);
  const [transferForm, setTransferForm] = useState({ from_method: 'cash', to_method: 'vodafone_cash', amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
  const [adjustWalletForm, setAdjustWalletForm] = useState({ method: '', new_balance: '', current_balance: 0 });

  const methodsList = PAYMENT_METHOD_OPTIONS;

  const fetchReceivables = useCallback(async () => {
    const sequence = ++receivablesSequenceRef.current;
    setReceivables({ loading: true, error: '', data: null });
    try {
      const result = await dataClient.request('/dashboard/receivables', { method: 'GET' });
      if (sequence !== receivablesSequenceRef.current) return;
      if (result.error) throw result.error;
      if (!result.data || result.data.amount == null || !Array.isArray(result.data.items)) throw new Error('تعذر تحميل بيانات المستحقات.');
      setReceivables({ loading: false, error: '', data: result.data });
    } catch (error) {
      if (sequence !== receivablesSequenceRef.current) return;
      setReceivables({ loading: false, error: safeUiError(error, 'تعذر تحميل مستحقات العملاء الآن.'), data: null });
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(fetchReceivables, 0); return () => { window.clearTimeout(timer); receivablesSequenceRef.current += 1; }; }, [fetchReceivables]);
  const closeReceivables = useCallback(() => setReceivablesOpen(false), []);
  const openReceivables = event => { receivablesTriggerRef.current = event.currentTarget; setReceivablesOpen(true); fetchReceivables(); };

  const fetchData = useCallback(async () => {
    if (globalFinanceCache) {
       setAllTransactions(globalFinanceCache);
       setLoading(false);
    } else {
       setLoading(true);
    }

    setLoadError('');
    const [financeResult, clientsResult, packagesResult, servicesResult, employeeAccountsResult] = await Promise.all([
      dataClient.request('/finance/entries', { method: 'GET' }),
      dataClient.from('clients').select('id,name,phone1,phone2,status').order('name'),
      dataClient.from('client_packages').select('id,client_id,name,status').order('name'),
      dataClient.from('services').select('id,name,is_active').eq('is_active', 1).order('name'),
      dataClient.request(`/attendance/employee-accounts?month=${selectedMonth}`, { method: 'GET' }),
    ]);
    const fData = financeResult.data;
    const fetchError = [financeResult, clientsResult, packagesResult, servicesResult].find(result => result.error)?.error;
    if (fetchError) setLoadError(fetchError.message || 'تعذر تحميل دفتر الحسابات.');
    
    if (fData) {
       setAllTransactions(fData);
       globalFinanceCache = fData;
    }
    setClients((clientsResult.data || []).filter(client => client.status !== 'archived'));
    setPackages(packagesResult.data || []);
    setServices(servicesResult.data || []);
    setEmployeeAccounts(employeeAccountsResult.data?.accounts || []);
    setEmployeeAccountsWarning(employeeAccountsResult.error?.message || (employeeAccountsResult.data?.schema_ready === false ? 'حسابات الموظفين تحتاج تحديث قاعدة البيانات رقم 027. باقي عمليات الخزنة تعمل بصورة طبيعية.' : ''));
    
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { const timer = window.setTimeout(fetchData, 0); return () => window.clearTimeout(timer); }, [fetchData]);
  useChangeSync(useCallback((topics) => {
    if (topics.includes('finance')) fetchData(true);
    if (topics.some(topic => ['finance', 'client_packages', 'packages', 'clients'].includes(topic))) fetchReceivables();
  }, [fetchData, fetchReceivables]));

  const fetchFinancePeriod = useCallback(async () => {
    setPeriodError('');
    const { data, error } = await dataClient.request(`/finance/periods?month=${encodeURIComponent(selectedMonth)}`, { method: 'GET' });
    if (error) { setFinancePeriod(null); setPeriodError(error.message || 'تعذر تحميل حالة الشهر المالي.'); return; }
    setFinancePeriod(data);
  }, [selectedMonth]);
  useEffect(() => { const timer = window.setTimeout(fetchFinancePeriod, 0); return () => window.clearTimeout(timer); }, [fetchFinancePeriod]);

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
  const periodOpen = financePeriod?.status === 'open';
  const canAdjustWallet = periodOpen && selectedMonth === format(new Date(), 'yyyy-MM');
  const openTransactionModal = (entryKind, event) => { if (!periodOpen || !isAdmin) return; transactionTriggerRef.current = event.currentTarget; transactionRequestKeyRef.current = packagePaymentRequestKey(); setTxError([]); setTxForm({ ...emptyTransaction(), type: entryKind === 'income' ? 'إيراد' : 'مصروف', entry_kind: entryKind, category: entryKind === 'income' ? 'other_income' : 'general_expense' }); setModalState(state => ({ ...state, addTransaction: true })); };
  const txErrorFields = new Set(txError.map(error => error.field));

  const safeFloat = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0.0 : parsed;
  };

  // Derived Calculations
  const filteredEmployee = employeeAccounts.find(account => String(account.user.id) === employeeFilter);

  const calculations = useMemo(() => {
    const movement = calculateOperationalFinanceMovement(allTransactions, selectedMonth);
    const balances = { 'كاش': 0, 'فودافون كاش': 0, 'انستاباي': 0, 'إنستاباي (InstaPay)': 0, 'تحويل بنكي': 0 };
    const monthlyTransactions = allTransactions.filter(transaction => String(transaction.date || '').slice(0, 7) === selectedMonth);

    monthlyTransactions.forEach(t => {
      const amt = safeFloat(t.amount);
      const kind = normalizeFinanceEntryKind(t);
      const reversedKind = kind === 'reversal' ? String(t.category || '').replace(/^reversal_/, '') : '';

      const displayMethod = formatPaymentMethod(t.method);
      const method = displayMethod === 'نقدي' ? 'كاش' : displayMethod === 'إنستاباي' ? 'انستاباي' : displayMethod;
      if (balances[method] === undefined) balances[method] = 0;

      if (kind === 'reversal') {
        if (['income','advance_in','transfer_in'].includes(reversedKind)) balances[method] -= amt;
        if (reversedKind === 'expense' && t.entity === 'الشركة') balances[method] += amt;
        if (['advance_out','settlement_out','transfer_out'].includes(reversedKind)) balances[method] += amt;
      } else if (['income', 'advance_in', 'transfer_in'].includes(kind)) {
        balances[method] += amt;
      } else if (['expense', 'transfer_out'].includes(kind) && t.entity === 'الشركة') {
        balances[method] -= amt;
      } else if (['settlement_out', 'advance_out'].includes(kind)) {
        balances[method] -= amt;
      }

    });

    const final_instapay = balances['انستاباي'] + (balances['إنستاباي (InstaPay)'] || 0) + (balances['تحويل بنكي'] || 0);
    const final_cash = balances['كاش'];
    const final_vodafone = balances['فودافون كاش'];

    return { 
      total_inc: movement.income, total_exp: movement.expense, net_profit: movement.net,
      balances: { cash: final_cash, vodafone: final_vodafone, instapay: final_instapay }, 
      incomes: movement.incomes, expenses: movement.expenses,
    };
  }, [allTransactions, selectedMonth]);

  const { total_inc, total_exp, net_profit, balances } = calculations;

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
    const packagePayment = txForm.entry_kind === 'income' && txForm.source_type === 'client_package';
    if (packagePayment && !transactionRequestKeyRef.current) transactionRequestKeyRef.current = packagePaymentRequestKey();
    const endpoint = packagePayment ? `/client-packages/${Number(txForm.source_id)}/payments` : '/finance/manual';
    const payload = packagePayment ? {
      amount: String(txForm.amount).trim(), method: txForm.method, reference: '', note: txForm.detail.trim(), payment_date: txForm.date,
      idempotency_key: transactionRequestKeyRef.current,
    } : {
      entry_kind: txForm.entry_kind,
      category: txForm.category,
      client_id: txForm.entry_kind === 'income' && txForm.client_id ? Number(txForm.client_id) : null,
      source_type: txForm.entry_kind === 'income' && txForm.source_type ? txForm.source_type : null,
      source_id: txForm.entry_kind === 'income' && txForm.source_id ? Number(txForm.source_id) : null,
      amount: safeFloat(txForm.amount), method: txForm.method, detail: txForm.detail, date: txForm.date,
      entity: txForm.entry_kind === 'expense' ? txForm.entity : 'الشركة',
      employee_user_id: txForm.entry_kind === 'expense' && txForm.employee_user_id !== 'company' ? Number(txForm.employee_user_id) : null,
    };
    const { error } = await dataClient.request(endpoint, { method: 'POST', body: JSON.stringify(payload) });

    if (!error) {
      transactionRequestKeyRef.current = '';
      setModalState(s => ({...s, addTransaction: false}));
      setTxForm(emptyTransaction());
      fetchData(true);
      fetchReceivables();
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
    setTransferForm({ from_method: 'cash', to_method: 'vodafone_cash', amount: '', date: selectedPeriodDate(), note: '' });
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
    setOwnerAction({ open: true, mode, entry, amount: String(entry.amount || ''), method: normalizePaymentMethod(entry.method), detail: entry.detail || '', date: entry.date || format(new Date(), 'yyyy-MM-dd'), reason: '', confirmed: false, error: '', requiresAllocation: (entry.package_ids || []).length > 1 && entry.source_type === 'payment', allocation, replacementAllocation: { ...allocation } });
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
    closeOwnerAction(); await fetchData(true); fetchReceivables();
  };

  const changeMonth = (offset) => {
    const current = parseISO(`${selectedMonth}-01`);
    const newDate = offset > 0 ? addMonths(current, 1) : subMonths(current, 1);
    setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  const updateFinancePeriod = async action => {
    if (!isOwner || periodBusy) return;
    const message = action === 'close' ? `إقفال حسابات شهر ${selectedMonth}؟ لن يمكن إضافة أو تعديل حركاته إلا بعد إعادة فتحه.` : `إعادة فتح حسابات شهر ${selectedMonth} لإضافة أو تعديل حركات؟`;
    if (!window.confirm(message)) return;
    setPeriodBusy(true); setPeriodError('');
    const { data, error } = await dataClient.request(`/finance/periods/${selectedMonth}/${action}`, { method: 'POST', body: '{}' });
    setPeriodBusy(false);
    if (error) { setPeriodError(error.message || 'تعذر تحديث حالة الشهر المالي.'); return; }
    setFinancePeriod(data);
  };

  const openAdjustWalletModal = (method, currentBalance) => {
    if (!canAdjustWallet) return;
    setAdjustWalletForm({ method, new_balance: '', current_balance: currentBalance });
    setModalState(s => ({...s, adjustWallet: true}));
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>جاري تحميل الحسابات...</div>;

  return (
    <div className="container-fluid p-0 finance-page finance-clear-page">

      {/* Header Area */}
      <ERPPageHero
        icon={ChartNoAxesCombined}
        eyebrow="الحسابات والتدفقات النقدية"
        title="الحسابات"
        description="سجل واضح للحركات المالية، والمحافظ، ومستحقات الشركة."
        actions={<>
          <button onClick={() => window.print()}><Printer aria-hidden="true"/> طباعة</button>
          {isAdmin && <button disabled={!periodOpen} onClick={() => { setTransferForm({ from_method: 'cash', to_method: 'vodafone_cash', amount: '', date: selectedPeriodDate(), note: '' }); setModalState({...modalState, transfer: true}); }}><ArrowLeftRight aria-hidden="true"/> تحويل داخلي</button>}
          {isAdmin && <button className="fc-add-income" disabled={!periodOpen} onClick={event => openTransactionModal('income', event)}><CirclePlus aria-hidden="true"/> إضافة إيراد</button>}
          {isAdmin && <button className="fc-add-expense" disabled={!periodOpen} onClick={event => openTransactionModal('expense', event)}><CirclePlus aria-hidden="true"/> إضافة مصروف</button>}
        </>}
        details={<div className="month-selector" aria-label="الشهر المالي">
            <button type="button" onClick={() => changeMonth(1)} className="finance-month-button" aria-label="عرض الشهر التالي" title="الشهر التالي"><ChevronRight aria-hidden="true"/></button>
            <span className="m-0 px-4 fw-bold" style={{ color: '#2b3674' }}>{selectedMonth}</span>
            <button type="button" onClick={() => changeMonth(-1)} className="finance-month-button" aria-label="عرض الشهر السابق" title="الشهر السابق"><ChevronLeft aria-hidden="true"/></button>
        </div>}
      />
      <section className={`finance-period-bar ${financePeriod?.status === 'closed' ? 'is-closed' : financePeriod?.status === 'open' ? 'is-open' : 'is-loading'}`} aria-live="polite">
        <ShieldCheck aria-hidden="true"/>
        <div><strong>{financePeriod?.status === 'closed' ? `حسابات ${selectedMonth} مقفلة` : financePeriod?.status === 'open' ? `حسابات ${selectedMonth} مفتوحة` : `جارٍ تحميل حسابات ${selectedMonth}`}</strong><span>{financePeriod?.status === 'closed' ? 'الأرقام محفوظة كما أُقفلت. أعد فتح الشهر لإضافة إيراد أو مصروف قديم.' : financePeriod?.status === 'open' ? 'يمكن تسجيل الحركات في هذا الشهر. يوم 1 يبدأ شهر جديد وتبدأ أرصدة محافظه من صفر.' : 'لن تتاح الإضافة أو التعديل حتى نتأكد من حالة الشهر.'}</span></div>
        {isOwner && financePeriod && <button type="button" disabled={periodBusy} onClick={() => updateFinancePeriod(financePeriod.status === 'closed' ? 'reopen' : 'close')}>{periodBusy ? 'جارٍ الحفظ…' : financePeriod.status === 'closed' ? 'إعادة فتح الشهر' : 'إقفال الشهر'}</button>}
      </section>
      {periodError && <div className="finance-load-error" role="alert"><AlertCircle/><span>{periodError}</span><button type="button" onClick={fetchFinancePeriod}>إعادة المحاولة</button></div>}
      {loadError && <div className="finance-load-error" role="alert"><AlertCircle/><span>{loadError}</span><button type="button" onClick={() => fetchData(true)}>إعادة المحاولة</button></div>}

      <FinanceOverview income={total_inc} expense={total_exp} profit={net_profit} month={selectedMonth} receivables={receivables} onReceivables={openReceivables} onRetryReceivables={fetchReceivables}/>
      <FinanceWallets balances={balances} month={selectedMonth} isAdmin={isAdmin} canAdjust={canAdjustWallet} onAdjust={openAdjustWalletModal}/>

      {employeeFilter && <div className="finance-employee-filter" role="status"><UserRound/><div><strong>عرض معاملات {filteredEmployee?.user.full_name || `الموظف #${employeeFilter}`}</strong><span>كل هذه القيود هي نفسها الظاهرة في حساب الموظف بصفحة الحضور والرواتب.</span></div><button type="button" onClick={() => setSearchParams({})}>عرض كل الحسابات</button></div>}
      <FinanceClearLedger entries={allTransactions} month={selectedMonth} employeeId={employeeFilter} isOwner={isOwner} onOwnerAction={openOwnerAction} targetEntryId={targetEntryId}/>
      <FinanceReceivablesDialog open={receivablesOpen} onClose={closeReceivables} returnFocusRef={receivablesTriggerRef} view={receivables} onRetry={fetchReceivables}/>

      {/* --- MODALS --- */}
      
      {/* 1. Transaction Modal */}
      {modalState.addTransaction && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, addTransaction: false})}>
          <div ref={transactionDialogRef} className={`erp-modal-content finance-manual-dialog finance-manual-dialog--${txForm.entry_kind} border-0 shadow-lg p-0`} data-entry-kind={txForm.entry_kind} role="dialog" aria-modal="true" aria-labelledby="finance-manual-title" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4">
              <h5 id="finance-manual-title" className="fw-bold m-0 d-flex align-items-center">{txForm.entry_kind === 'income' ? <ArrowDown className="finance-inline-icon" aria-hidden="true"/> : <ArrowUp className="finance-inline-icon" aria-hidden="true"/>}{txForm.entry_kind === 'income' ? 'إضافة إيراد' : 'إضافة مصروف'}</h5>
              <button type="button" className="finance-dialog-close" aria-label="إغلاق" onClick={() => setModalState(state => ({ ...state, addTransaction: false }))}>×</button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-4" noValidate>
              {txError.length > 0 && <div id="finance-form-errors" ref={transactionErrorRef} className="finance-form-error" role="alert" tabIndex="-1"><AlertCircle/><div><strong>راجع الحقول المطلوبة التالية</strong><ul>{txError.map(error => <li key={`${error.field}-${error.message}`}>{error.field === 'finance-form' ? error.message : <a href={`#${error.field}`} onClick={event => { event.preventDefault(); document.getElementById(error.field)?.focus(); }}>{error.message}</a>}</li>)}</ul></div></div>}
              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="finance-entry-type" className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>نوع العملية</label>
                  <select id="finance-entry-type" data-finance-initial className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.type} onChange={e => setTxForm({...txForm,type:e.target.value,entry_kind:e.target.value==='إيراد'?'income':'expense',category:e.target.value==='إيراد'?'other_income':'general_expense',client_id:'',employee_user_id:'company',source_type:'',source_id:'',entity:'الشركة'})} required>
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
                  <div className="col-md-6 finance-conditional-field"><ClientCombobox id="finance-client" clients={clients} value={txForm.client_id} onChange={clientId => setTxForm({...txForm,client_id:clientId,source_id:txForm.source_type==='client_package'?'':txForm.source_id})} label={`اسم العميل${txForm.category === 'client_revenue' ? '' : ' (اختياري)'}`} required={txForm.category === 'client_revenue'} allowedStatuses={client => client.status !== 'archived'} allowAll={txForm.category !== 'client_revenue'} allValue="" allLabel="إيراد عام بلا عميل" invalid={txErrorFields.has('finance-client')} describedBy={txErrorFields.has('finance-client')?'finance-form-errors':undefined}/></div>
                  <div className="col-md-6 finance-conditional-field"><label htmlFor="finance-relation" className="small fw-bold mb-1">الربط التشغيلي <span>اختياري</span></label><select id="finance-relation" className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.source_type} onChange={e => setTxForm({...txForm,source_type:e.target.value,source_id:''})}><option value="">غير مرتبط بباقة أو خدمة</option><option value="client_package" disabled={!txForm.client_id}>باقة مباعة للعميل</option><option value="service">خدمة</option></select></div>
                  {txForm.source_type && <div className="col-12 finance-conditional-field"><label htmlFor="finance-source" className="small fw-bold mb-1">{txForm.source_type === 'client_package' ? 'الباقة المباعة' : 'الخدمة'} <b>مطلوب</b></label><select id="finance-source" className="form-select border-0 fw-bold" style={{ background: 'var(--erp-bg)' }} value={txForm.source_id} onChange={e => setTxForm({...txForm,source_id:e.target.value})} required aria-invalid={txErrorFields.has('finance-source')||undefined} aria-describedby={txErrorFields.has('finance-source')?'finance-form-errors':undefined}><option value="">اختر {txForm.source_type === 'client_package' ? 'الباقة' : 'الخدمة'}</option>{(txForm.source_type === 'client_package' ? clientPackages : services).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
                  {txForm.source_type === 'client_package' && <div className="col-12"><div className="finance-package-warning"><PackageOpen/><p><strong>ستُسجّل كدفعة فعلية على الباقة.</strong>سيتم تحديث المدفوع والمتبقي والفاتورة وسجل مدفوعات العميل تلقائيًا دون إنشاء قيد مكرر.</p></div></div>}
                </>}
                {txForm.type === 'مصروف' && (
                  <div className="col-12 mt-3 animate__animated animate__fadeIn">
                    <label htmlFor="finance-expense-entity" className="small fw-bold mb-1" style={{ color: 'var(--erp-danger)' }}>دُفع بواسطة (الجهة)</label>
                    <select id="finance-expense-entity" className="form-select border-0 fw-bold" style={{ background: 'rgba(220, 53, 69, 0.1)', color: 'var(--erp-danger)' }} value={txForm.employee_user_id} onChange={e => { const account = employeeAccounts.find(item => String(item.user.id) === e.target.value); setTxForm({...txForm, employee_user_id: e.target.value, entity: account?.user.full_name || 'الشركة'}); }} required>
                      <option value="company">من خزينة الشركة</option>
                      {employeeAccounts.map(account => <option key={account.user.id} value={account.user.id}>{account.user.full_name} (من ماله الخاص)</option>)}
                    </select>
                    {employeeAccountsWarning && <p className="finance-employee-warning" role="status"><AlertCircle />{employeeAccountsWarning}</p>}
                  </div>
                )}
                <div className="col-12 mt-3">
                  <label htmlFor="finance-entry-detail" className="small fw-bold mb-1" style={{ color: 'var(--erp-text-muted)' }}>البيان والتفاصيل</label>
                  <input id="finance-entry-detail" type="text" className="form-control border-0 py-2" style={{ background: 'var(--erp-bg)' }} value={txForm.detail} onChange={e => setTxForm({...txForm, detail: e.target.value})} placeholder="مثال: فاتورة إنترنت، دفعة حجز..." required aria-invalid={txErrorFields.has('finance-entry-detail')||undefined} aria-describedby={txErrorFields.has('finance-entry-detail')?'finance-form-errors':undefined} />
                </div>
              </div>
              <button type="submit" className="btn finance-manual-submit w-100 py-3 rounded-4 fw-bold shadow mt-4">{txForm.entry_kind === 'income' ? 'اعتماد وحفظ الإيراد' : 'اعتماد وحفظ المصروف'}</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Transfer Modal */}
      {modalState.transfer && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, transfer: false})}>
          <div className="erp-modal-content border-0 shadow-lg rounded-5 overflow-hidden p-0" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-0 p-4" style={{ background: '#0dcaf0', color: '#000' }}>
              <h5 className="fw-bold m-0 d-flex align-items-center"><ArrowLeftRight className="finance-inline-icon" aria-hidden="true"/> تحويل رصيد بين المحافظ</h5>
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

      {/* 7. Adjust Wallet Modal (Admin Only) */}
      {modalState.adjustWallet && isAdmin && (
        <div className="erp-modal-overlay" onClick={() => setModalState({...modalState, adjustWallet: false})}>
          <div className="erp-modal-content rounded-5 border-0 shadow-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header bg-dark text-white border-0 p-4 rounded-top-5">
              <h5 className="fw-bold m-0 d-flex align-items-center"><SlidersHorizontal className="finance-inline-icon" aria-hidden="true"/> تسوية إدارية لخزينة ({adjustWalletForm.method})</h5>
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
                <Info className="finance-inline-icon" aria-hidden="true"/> سيتم إنشاء عملية "تسوية إدارية" إما كإيراد أو مصروف لضبط الدفاتر بحيث يصبح الرصيد مساوياً للرقم الجديد.
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


function FinanceOwnerDialog({dialogRef,state,setState,packages,onClose,onSubmit}) {
  const entry=state.entry||{};
  const allocationTotal=Object.values(state.allocation).reduce((sum,value)=>sum+Number(value||0),0);
  const replacementTotal=Object.values(state.replacementAllocation).reduce((sum,value)=>sum+Number(value||0),0);
  const needsAllocation=state.requiresAllocation;const correct=state.mode==='correct';const transfer=['transfer_in','transfer_out'].includes(entry.entry_kind);
  const originalRemaining=Number(entry.amount||0)-allocationTotal;const replacementRemaining=Number(state.amount||0)-replacementTotal;
  return <div className="erp-modal-overlay finance-owner-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><form ref={dialogRef} className="finance-owner-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-owner-title" aria-describedby="finance-owner-description" onSubmit={onSubmit}>
    <button data-owner-initial type="button" className="finance-owner-close" onClick={onClose} aria-label="إغلاق نافذة إجراء المالك"><X/></button><span className="finance-owner-kicker"><ShieldCheck/> إجراء مالك موثق</span><h2 id="finance-owner-title">{transfer?'إلغاء التحويل الداخلي':correct?'تصحيح الحركة':'إلغاء الأثر المالي'}</h2><p id="finance-owner-description">{entry.detail} · {formatEGP(entry.amount)}</p>
    {transfer&&<div className="finance-transfer-impact" role="note"><strong>سيُعكس طرفا التحويل معًا</strong><span>الخزينة المرسلة + الخزينة المستلمة</span><b>صافي الشركة بعد العكس: صفر</b></div>}
    {correct&&<div className="finance-owner-grid"><label>المبلغ الجديد<input type="number" min="0.01" step="0.01" required value={state.amount} onChange={event=>setState({...state,amount:event.target.value})}/></label><label>طريقة الدفع<select required value={state.method} onChange={event=>setState({...state,method:event.target.value})}><option value="">اختر طريقة الدفع</option>{PAYMENT_METHOD_OPTIONS.map(({value,label}) => <option key={value} value={value}>{label}</option>)}</select></label><label>التاريخ<input type="date" required value={state.date} onChange={event=>setState({...state,date:event.target.value})}/></label><label>البيان<input required value={state.detail} onChange={event=>setState({...state,detail:event.target.value})}/></label></div>}
    <section className="finance-impact-strip"><article><span>القيد الأصلي</span><b>{formatEGP(entry.amount)}</b></article><article><span>الخزينة</span><b>{transfer?'عكس الخروج والدخول':correct?`عكس ثم ${formatEGP(state.amount)}`:'عكس كامل'}</b></article><article><span>المصدر</span><b>{entry.source_type==='payment'?'دفعة وحصص وفاتورة':transfer?'تحويل داخلي · طرفان':'قيد يدوي'}</b></article></section>
    {needsAllocation&&<section className="finance-allocation"><h3>توزيع الدفعة القديمة مطلوب</h3><p>إجمالي الدفعة الأصلية: <b>{formatEGP(entry.amount)}</b>. أدخل كل حصة في عمودها؛ لن يخمّن النظام التوزيع.</p><div className={`finance-allocation-head ${correct?'with-replacement':''}`}><span>الباقة</span><b>التوزيع الأصلي</b>{correct&&<b>التوزيع البديل</b>}</div>{Object.keys(state.allocation).map((packageId,index)=>{const pkg=packages.find(item=>Number(item.id)===Number(packageId));const name=pkg?.name||`باقة #${packageId}`;return <div className={`finance-allocation-row ${correct?'with-replacement':''}`} key={packageId}><strong>{name}</strong><label><span>الأصلي</span><input data-allocation-input={index===0?true:undefined} aria-label={`التوزيع الأصلي لـ ${name}`} type="number" min="0" step="0.01" required value={state.allocation[packageId]} onChange={event=>setState({...state,allocation:{...state.allocation,[packageId]:event.target.value}})}/></label>{correct&&<label><span>البديل</span><input aria-label={`التوزيع البديل لـ ${name}`} type="number" min="0" step="0.01" required value={state.replacementAllocation[packageId]} onChange={event=>setState({...state,replacementAllocation:{...state.replacementAllocation,[packageId]:event.target.value}})}/></label>}</div>})}<div className="finance-allocation-totals"><strong className={Math.abs(originalRemaining)<.005?'balanced':'unbalanced'}>الأصلية {formatEGP(allocationTotal)} · المتبقي {formatEGP(originalRemaining)}</strong>{correct&&<strong className={Math.abs(replacementRemaining)<.005?'balanced':'unbalanced'}>البديلة {formatEGP(replacementTotal)} · المتبقي {formatEGP(replacementRemaining)}</strong>}</div></section>}
    {state.error&&<div className="finance-owner-error" role="alert"><AlertCircle/>{state.error}</div>}<label className="finance-owner-reason">{correct?'سبب التصحيح':'ملاحظة داخلية (اختيارية)'}<textarea minLength={correct ? 5 : undefined} required={correct} rows="3" value={state.reason} onChange={event=>setState({...state,reason:event.target.value})} placeholder={correct ? 'اكتب سببًا واضحًا للتصحيح' : 'يمكنك تركها فارغة'}/></label><label className="finance-owner-confirm"><input type="checkbox" checked={state.confirmed} onChange={event=>setState({...state,confirmed:event.target.checked})}/> أفهم أن التاريخ لن يُحذف وسيُنشأ قيد عكسي موثق{transfer?' لطرفي التحويل معًا':''}.</label><button className={correct?'correct':'void'} disabled={!state.confirmed||(correct&&state.reason.trim().length<5)}>{correct?'حفظ كعكس + بديل':transfer?'إلغاء طرفي التحويل':'تأكيد الإلغاء الموثق'}</button>
  </form></div>;
}

export default ERPFinance;
