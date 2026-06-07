import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Edit, Trash2, Search, Phone, Wallet, DollarSign, MessageCircle, CalendarPlus, CheckSquare, History, FileText, Camera, Calendar, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ERPClients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false); // For both Deposit and Pay Debt
  
  // History Modals
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyType, setHistoryType] = useState('bookings'); // 'packages' | 'bookings' | 'finance'
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Modal states
  const [isEditing, setIsEditing] = useState(false);
  const [currentClient, setCurrentClient] = useState({ name: '', phone1: '', phone2: '', job: '', color: '#9d4edd', debt: 0, points: 0 });
  const [financeAction, setFinanceAction] = useState('pay_debt'); // 'deposit' | 'pay_debt'
  const [financeAmount, setFinanceAmount] = useState(0);
  const [financeMethod, setFinanceMethod] = useState('كاش');
  const [whatsappMsg, setWhatsappMsg] = useState('');

  // Active Packages Data
  const [activePackages, setActivePackages] = useState([]);
  const [systemServices, setSystemServices] = useState([]);

  // Bulk Edit State
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchClients();
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*');
    if (data) setSystemServices(data);
  };

  useEffect(() => {
    if (selectedClient) {
      fetchActivePackages(selectedClient.name);
    } else {
      setActivePackages([]);
    }
  }, [selectedClient]);

  const fetchActivePackages = async (clientName) => {
    // 1. Fetch all bookings for this client
    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('client_name', clientName);
      
    if (error || !allBookings) {
      setActivePackages([]);
      return;
    }

    // 2. Aggregate data per service (ignoring archived)
    const pkgMap = {};
    
    allBookings.forEach(b => {
      // Ignore archived packages from old history
      if (b.service && b.service.includes('(مؤرشف)')) return;
      
      const sName = b.service;
      if (!pkgMap[sName]) {
        pkgMap[sName] = {
          service: sName,
          used_hours: 0,
          used_reels: 0,
          paid: 0,
          custom_price: -1,
          custom_expiry: '',
          delivery_date: '',
          discount: 0
        };
      }
      
      // Calculate Used Hours (any status except دفعة)
      if (b.status !== 'دفعة') {
        pkgMap[sName].used_hours += (parseFloat(b.actual_hours) || 0);
      }
      
      // Calculate Used Reels (منتهي or مؤرشف status)
      if (b.status === 'منتهي' || b.status === 'مؤرشف' || b.status === 'نشط') {
        pkgMap[sName].used_reels += (parseInt(b.actual_reels) || 0);
      }
      
      // Calculate Paid amount (status === دفعة)
      if (b.status === 'دفعة') {
        pkgMap[sName].paid += (parseFloat(b.payment) || 0);
      }

      // Capture custom expiry or delivery date from the latest row that has it
      if (b.custom_expiry) pkgMap[sName].custom_expiry = b.custom_expiry;
      if (b.delivery_date) pkgMap[sName].delivery_date = b.delivery_date;
      if (parseFloat(b.custom_price) > -1) pkgMap[sName].custom_price = parseFloat(b.custom_price);
    });

    // 3. Match with system services and filter active ones
    const activeList = [];
    
    Object.values(pkgMap).forEach(pkg => {
      const sDef = systemServices.find(s => s.name === pkg.service);
      if (!sDef) return;
      
      const totalHours = parseFloat(sDef.total_hours) || 0;
      const totalReels = parseInt(sDef.total_reels) || 0;
      const price = pkg.custom_price > -1 ? pkg.custom_price : parseFloat(sDef.price) || 0;
      const remainingPaid = price - pkg.paid;
      
      // A package is active if they haven't used all hours/reels OR they still owe money, OR they just booked it
      const hasRemainingHours = totalHours > 0 && pkg.used_hours < totalHours;
      const hasRemainingReels = totalReels > 0 && pkg.used_reels < totalReels;
      const owesMoney = remainingPaid > 0;
      const isJustBooked = pkg.used_hours === 0 && pkg.used_reels === 0;
      
      if (hasRemainingHours || hasRemainingReels || owesMoney || isJustBooked) {
        activeList.push({
          ...pkg,
          total_hours: totalHours,
          total_reels: totalReels,
          price: price
        });
      }
    });

    setActivePackages(activeList);
  };

  const formatHours = (decimalVal) => {
    if (!decimalVal || decimalVal === 0) return "0 س";
    const h = Math.floor(decimalVal);
    const m = Math.round((decimalVal - h) * 60);
    const res = [];
    if (h > 0) res.push(`${h} س`);
    if (m > 0) res.push(`${m} د`);
    return res.join(" و ");
  };

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clients').select('*').order('id', { ascending: false });
    if (!error && data) {
      setClients(data);
      // Refresh selected client if data changes
      if (selectedClient) {
        const updated = data.find(c => c.id === selectedClient.id);
        setSelectedClient(updated || null);
      }
    }
    setLoading(false);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (isEditing) {
      const { error } = await supabase.from('clients').update({ 
          name: currentClient.name, 
          phone1: currentClient.phone1, 
          phone2: currentClient.phone2, 
          job: currentClient.job,
          color: currentClient.color
      }).eq('id', currentClient.id);
      if (!error) fetchClients();
    } else {
      const { error } = await supabase.from('clients').insert([{ 
          name: currentClient.name, 
          phone1: currentClient.phone1, 
          phone2: currentClient.phone2, 
          job: currentClient.job,
          color: currentClient.color,
          points: 0,
          debt: 0
      }]);
      if (!error) fetchClients();
    }
    setIsClientModalOpen(false);
  };

  const deleteClient = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف العميل: ${name} نهائياً؟`)) {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (!error) {
        if (selectedClient?.id === id) setSelectedClient(null);
        fetchClients();
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`هل أنت متأكد من حذف (${selectedIds.length}) عميل نهائياً؟`)) {
      const { error } = await supabase.from('clients').delete().in('id', selectedIds);
      if (!error) {
        setSelectedIds([]);
        setSelectedClient(null);
        fetchClients();
      }
    }
  };

  const handleFinanceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    if (financeAction === 'pay_debt') {
      // Decrease debt
      const newDebt = Math.max(0, (selectedClient.debt || 0) - financeAmount);
      await supabase.from('clients').update({ debt: newDebt }).eq('id', selectedClient.id);
      await supabase.from('finance').insert([{
        type: 'وارد', amount: financeAmount, method: financeMethod, 
        detail: `سداد مديونية من العميل ${selectedClient.name}`, date: new Date().toISOString().split('T')[0], entity: 'الشركة'
      }]);
    } else {
      // Deposit Credit
      const newCredit = (selectedClient.credit || 0) + financeAmount;
      await supabase.from('clients').update({ credit: newCredit }).eq('id', selectedClient.id);
      await supabase.from('finance').insert([{
        type: 'وارد', amount: financeAmount, method: financeMethod, 
        detail: `إيداع رصيد للعميل ${selectedClient.name}`, date: new Date().toISOString().split('T')[0], entity: 'الشركة'
      }]);
    }

    setIsFinanceModalOpen(false);
    setFinanceAmount(0);
    fetchClients();
  };

  const openWhatsApp = () => {
    if (!selectedClient) return;
    const msg = `أهلاً بك أستاذ/ة ${selectedClient.name}،\n\nنود إعلامكم بآخر تحديثات حسابكم لدينا:\nالمديونية: ${selectedClient.debt || 0} ج.م\nالنقاط: ${selectedClient.points || 0}\n\nشكراً لثقتكم بنا.`;
    setWhatsappMsg(msg);
    setIsWhatsAppModalOpen(true);
  };

  const openHistory = async (type) => {
    if (!selectedClient) return;
    setHistoryType(type);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryData([]);

    if (type === 'finance') {
      const { data, error } = await supabase
        .from('finance')
        .select('*')
        .ilike('detail', `%${selectedClient.name}%`)
        .order('id', { ascending: false });
      if (!error && data) setHistoryData(data);
    } else {
      // both packages and bookings are in the 'bookings' table
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('client_name', selectedClient.name)
        .order('id', { ascending: false });
        
      if (!error && data) {
        if (type === 'packages') {
          // Filter out normal bookings, only show packages/services
          // In the original system, packages are identified by category or status
          setHistoryData(data.filter(b => b.status === 'منتهي' || b.status === 'نشط' || b.status === 'مغلق'));
        } else {
          setHistoryData(data);
        }
      }
    }
    setHistoryLoading(false);
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(filteredClients.map(c => c.id));
    else setSelectedIds([]);
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone1 && c.phone1.includes(searchTerm))
  );

  return (
    <div>
      {/* Header */}
      <div className="erp-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserPlus color="var(--erp-primary)" /> قاعدة العملاء (CRM)
          </h2>
          <p>إدارة كاملة للعملاء، متابعة المديونيات، وإرسال التقارير.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedIds.length > 0 && (
            <button className="erp-btn-danger" onClick={handleBulkDelete}>
              <Trash2 size={18} style={{ display: 'inline', marginRight: '5px' }} />
              حذف المحدد ({selectedIds.length})
            </button>
          )}
          <button className="erp-btn-primary" onClick={() => { setIsEditing(false); setCurrentClient({ name: '', phone1: '', phone2: '', job: '', color: '#9d4edd', debt: 0, points: 0 }); setIsClientModalOpen(true); }}>
            <UserPlus size={18} /> عميل جديد
          </button>
        </div>
      </div>

      {/* Split Screen Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px', minHeight: '650px' }}>
        
        {/* RIGHT SIDE (Table) */}
        <div className="erp-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--erp-border)', display: 'flex', gap: '15px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--erp-text-muted)' }} />
              <input 
                type="text" 
                placeholder="ابحث باسم العميل أو رقم الهاتف..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="erp-input"
                style={{ paddingRight: '45px' }}
              />
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>جاري تحميل البيانات...</div>
            ) : (
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--erp-surface)', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '15px', borderBottom: '2px solid var(--erp-border)' }}>
                      <input type="checkbox" checked={selectedIds.length === filteredClients.length && filteredClients.length > 0} onChange={toggleSelectAll} style={{ transform: 'scale(1.2)' }} />
                    </th>
                    <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid var(--erp-border)' }}>العميل</th>
                    <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--erp-border)' }}>التواصل</th>
                    <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--erp-border)' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(client => {
                    const isSelected = selectedClient?.id === client.id;
                    return (
                      <tr key={client.id} 
                        onClick={() => setSelectedClient(client)}
                        style={{ 
                          cursor: 'pointer', 
                          background: isSelected ? 'rgba(157, 78, 221, 0.1)' : 'transparent',
                          borderRight: isSelected ? '4px solid var(--erp-primary)' : '4px solid transparent'
                        }}>
                        <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.includes(client.id)} onChange={() => toggleSelectOne(client.id)} style={{ transform: 'scale(1.2)' }} />
                        </td>
                        <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '35px', height: '35px', borderRadius: '10px', background: client.color || '#9d4edd', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                              {client.name.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 'bold', color: isSelected ? 'var(--erp-primary)' : 'var(--erp-text-main)' }}>{client.name}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)' }}>{client.job || 'لا يوجد وظيفة'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', direction: 'ltr' }}>
                          <div style={{ color: 'var(--erp-text-main)' }}>{client.phone1}</div>
                        </td>
                        <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); setCurrentClient(client); setIsEditing(true); setIsClientModalOpen(true); }} style={{ background: 'transparent', border: 'none', color: '#3498db', cursor: 'pointer', padding: '5px' }}>
                            <Edit size={18} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteClient(client.id, client.name); }} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '5px' }}>
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredClients.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>لا توجد نتائج مطابقة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* LEFT SIDE (Details Sidebar) */}
        <div className="erp-card" style={{ padding: '30px', borderTop: '4px solid var(--erp-primary)' }}>
          {!selectedClient ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5, textAlign: 'center' }}>
              <CheckSquare size={64} style={{ marginBottom: '20px', color: 'var(--erp-text-muted)' }} />
              <h4 style={{ fontWeight: 'bold' }}>تفاصيل العميل</h4>
              <p>اضغط على أي عميل من القائمة لعرض تفاصيله وإدارة حساباته.</p>
            </div>
          ) : (
            <div className="animate__animated animate__fadeInLeft" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ textAlign: 'center', borderBottom: '1px solid var(--erp-border)', paddingBottom: '20px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: selectedClient.color || '#9d4edd', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2.5rem', margin: '0 auto 15px auto', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
                  {selectedClient.name.charAt(0)}
                </div>
                <h3 style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>{selectedClient.name}</h3>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(241, 196, 15, 0.1)', color: '#f1c40f', padding: '8px 15px', borderRadius: '50px', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid rgba(241, 196, 15, 0.3)' }}>
                    ⭐ رصيد النقاط: {selectedClient.points || 0}
                  </span>
                  {(selectedClient.credit > 0) && (
                    <span style={{ background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', padding: '8px 15px', borderRadius: '50px', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
                      💰 رصيد بالشركة: {selectedClient.credit || 0} ج.م
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button 
                  onClick={() => navigate('/erp/bookings')} 
                  style={{ background: 'var(--erp-primary)', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <CalendarPlus size={24} /> حجز جديد
                </button>
                <button 
                  onClick={() => { setFinanceAction('deposit'); setIsFinanceModalOpen(true); }}
                  style={{ background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <Wallet size={24} /> إيداع رصيد
                </button>
                <button 
                  onClick={() => { setFinanceAction('pay_debt'); setIsFinanceModalOpen(true); }}
                  style={{ background: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <DollarSign size={24} /> سداد مديونية
                </button>
                <button 
                  onClick={openWhatsApp}
                  style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <MessageCircle size={24} /> إرسال تقرير
                </button>
              </div>

              {/* Debt Alert */}
              {selectedClient.debt > 0 && (
                <div style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '0.9rem' }}>إجمالي المديونية المتأخرة المستحقة:</span>
                  <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '1.2rem' }}>{selectedClient.debt} ج</span>
                </div>
              )}

              {/* Active Packages Cards */}
              {activePackages.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <Camera size={20} color="var(--erp-primary)" />
                    <h5 style={{ color: 'var(--erp-text-main)', fontWeight: 'bold', margin: 0 }}>باقة التصوير النشطة:</h5>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {activePackages.map((pkg, idx) => {
                      const totalHours = pkg.total_hours;
                      const totalReels = pkg.total_reels;
                      
                      const remHours = Math.max(0, totalHours - pkg.used_hours);
                      const remReels = Math.max(0, totalReels - pkg.used_reels);
                      
                      const remainingPaid = Math.max(0, pkg.price - pkg.paid);
                      
                      return (
                        <div key={idx} style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                          {/* Right Blue Border */}
                          <div style={{ position: 'absolute', top: '15px', right: 0, bottom: '15px', width: '5px', background: '#0d6efd', borderRadius: '10px 0 0 10px' }}></div>
                          
                          <h4 style={{ fontWeight: 'bold', color: '#0d6efd', marginBottom: '20px', textAlign: 'right', marginRight: '15px' }}>{pkg.service.replace(' (مؤرشف)', '')}</h4>
                          
                          {/* Hours / Reels Stats (3 Boxes) */}
                          {totalHours > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                              <div style={{ flex: 1, border: '1px solid var(--erp-border)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginBottom: '5px' }}>المتبقي</div>
                                <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1.2rem', direction: 'rtl' }}>{formatHours(remHours)}</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid var(--erp-border)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginBottom: '5px' }}>المستخدم</div>
                                <div style={{ fontWeight: 'bold', color: '#0d6efd', fontSize: '1.2rem', direction: 'rtl' }}>{formatHours(pkg.used_hours)}</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid var(--erp-border)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginBottom: '5px' }}>الباقة</div>
                                <div style={{ fontWeight: 'bold', color: '#212529', fontSize: '1.2rem', direction: 'rtl' }}>{totalHours} س</div>
                              </div>
                            </div>
                          )}

                          {totalReels > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                              <div style={{ flex: 1, border: '1px solid var(--erp-border)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginBottom: '5px' }}>المتبقي</div>
                                <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1.2rem' }}>{remReels} ريل</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid var(--erp-border)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginBottom: '5px' }}>المستخدم</div>
                                <div style={{ fontWeight: 'bold', color: '#0d6efd', fontSize: '1.2rem' }}>{pkg.used_reels} ريل</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid var(--erp-border)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginBottom: '5px' }}>الباقة</div>
                                <div style={{ fontWeight: 'bold', color: '#212529', fontSize: '1.2rem' }}>{totalReels} ريل</div>
                              </div>
                            </div>
                          )}

                          {/* Expiry Date */}
                          {(pkg.custom_expiry || pkg.delivery_date) && (
                            <div style={{ background: '#f8f9fa', border: '1px solid var(--erp-border)', borderRadius: '8px', padding: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '0.9rem', width: 'fit-content', margin: '0 auto 20px auto' }}>
                              <Calendar size={14} color="#0d6efd" style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                              <strong>انتهاء الصلاحية:</strong> <span style={{ direction: 'ltr', display: 'inline-block' }}>{pkg.custom_expiry || pkg.delivery_date}</span>
                            </div>
                          )}

                          {/* Finance Stats (3 Boxes) */}
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ flex: 1, background: '#f8d7da', borderRadius: '10px', padding: '15px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.85rem', color: '#dc3545', marginBottom: '5px' }}>المتبقي</div>
                              <div style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '1.1rem' }}>{remainingPaid} ج</div>
                            </div>
                            <div style={{ flex: 1, background: '#d1e7dd', borderRadius: '10px', padding: '15px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.85rem', color: '#198754', marginBottom: '5px' }}>المدفوع</div>
                              <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1.1rem' }}>{pkg.paid} ج</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid var(--erp-border)', borderRadius: '10px', padding: '15px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginBottom: '5px' }}>التكلفة</div>
                              <div style={{ fontWeight: 'bold', color: '#212529', fontSize: '1.1rem' }}>{pkg.price} ج</div>
                            </div>
                          </div>

                          {/* Discount Box */}
                          {pkg.discount > 0 && (
                            <div style={{ background: '#f8d7da', borderRadius: '10px', padding: '15px', textAlign: 'center', marginBottom: '20px' }}>
                              <div style={{ fontWeight: 'bold', color: '#5a191f', marginBottom: '5px' }}>
                                <Tag size={16} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                                الخصم المضاف: {pkg.discount} ج.م
                              </div>
                              <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>({pkg.discount_reason})</div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {remainingPaid > 0 && (
                              <button onClick={() => { setFinanceMethod('كاش'); setIsFinanceModalOpen(true); }} style={{ background: '#ffc107', color: '#212529', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                <Wallet size={18} /> سداد المتبقي للباقة 🔔
                              </button>
                            )}
                            
                            <div style={{ display: 'flex', gap: '10px', marginTop: remainingPaid > 0 ? '10px' : '0' }}>
                              <button style={{ flex: 1, background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
                                <Trash2 size={16} /> حذف الباقة
                              </button>
                              <button style={{ flex: 1, background: 'transparent', color: '#212529', border: '1px solid #212529', padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
                                <Edit size={16} /> تعديل إداري
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* History Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: activePackages.length > 0 ? '10px' : '20px' }}>
                <h5 style={{ color: 'var(--erp-text-muted)', fontWeight: 'bold', margin: '0 0 5px 0' }}>السجلات التاريخية</h5>
                <button onClick={() => openHistory('packages')} style={{ background: 'transparent', border: '1px solid var(--erp-border)', color: 'var(--erp-text-main)', padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                  <History color="var(--erp-primary)" /> سجل الخدمات المنتهية
                </button>
                <button onClick={() => openHistory('bookings')} style={{ background: 'transparent', border: '1px solid var(--erp-border)', color: 'var(--erp-text-main)', padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                  <CalendarPlus color="#3498db" /> سجل مواعيد التصوير
                </button>
                <button onClick={() => openHistory('finance')} style={{ background: 'transparent', border: '1px solid var(--erp-border)', color: 'var(--erp-text-main)', padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                  <FileText color="#2ecc71" /> سجل الدفعات النقدية
                </button>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* MODALS */}
      {/* 1. Client Form Modal */}
      {isClientModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsClientModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <UserPlus color="var(--erp-primary)" /> {isEditing ? 'تعديل بيانات العميل' : 'تسجيل عميل جديد'}
            </h3>
            <form onSubmit={handleSaveClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div><label className="erp-label">الاسم بالكامل</label><input type="text" className="erp-input" value={currentClient.name} onChange={e => setCurrentClient({...currentClient, name: e.target.value})} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label className="erp-label">واتساب (أساسي)</label><input type="text" className="erp-input" style={{ borderColor: '#2ecc71' }} value={currentClient.phone1} onChange={e => setCurrentClient({...currentClient, phone1: e.target.value})} required /></div>
                <div><label className="erp-label">رقم ثانٍ (اختياري)</label><input type="text" className="erp-input" value={currentClient.phone2} onChange={e => setCurrentClient({...currentClient, phone2: e.target.value})} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
                <div><label className="erp-label">الوظيفة / ملاحظة</label><input type="text" className="erp-input" value={currentClient.job} onChange={e => setCurrentClient({...currentClient, job: e.target.value})} /></div>
                <div><label className="erp-label">اللون</label><input type="color" className="erp-input" value={currentClient.color} onChange={e => setCurrentClient({...currentClient, color: e.target.value})} style={{ padding: '5px', height: '42px' }} /></div>
              </div>
              <button type="submit" className="erp-btn-primary" style={{ marginTop: '10px', padding: '12px' }}>{isEditing ? 'تحديث البيانات' : 'حفظ العميل'}</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Finance Modal (Deposit / Pay Debt) */}
      {isFinanceModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsFinanceModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '20px', color: financeAction === 'deposit' ? '#3498db' : '#f1c40f' }}>
              {financeAction === 'deposit' ? 'إيداع رصيد مالي بالشركة' : 'سداد دفعة من المديونية'}
            </h3>
            <p style={{ color: 'var(--erp-text-muted)', marginBottom: '20px' }}>العميل: <strong>{selectedClient.name}</strong></p>
            
            <form onSubmit={handleFinanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="erp-label" style={{ textAlign: 'center' }}>المبلغ (ج.م)</label>
                <input type="number" className="erp-input" value={financeAmount} onChange={e => setFinanceAmount(Number(e.target.value))} required min="1" style={{ fontSize: '2rem', textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div>
                <label className="erp-label" style={{ textAlign: 'center' }}>طريقة السداد / الخزينة</label>
                <select className="erp-input" value={financeMethod} onChange={e => setFinanceMethod(e.target.value)} style={{ textAlign: 'center' }}>
                  <option value="كاش">كاش</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="انستاباي">إنستاباي</option>
                </select>
              </div>
              <button type="submit" className="erp-btn-primary" style={{ background: financeAction === 'deposit' ? '#3498db' : '#f1c40f', color: '#000', padding: '12px' }}>
                تأكيد العملية
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. WhatsApp Modal */}
      {isWhatsAppModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsWhatsAppModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: '#2ecc71' }}>
              <MessageCircle color="#2ecc71" /> معاينة التقرير (واتساب)
            </h3>
            <textarea className="erp-input" rows="8" value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)} style={{ resize: 'none', lineHeight: '1.6' }}></textarea>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { navigator.clipboard.writeText(whatsappMsg); alert('تم النسخ!'); }} className="erp-btn-primary" style={{ flex: 1, background: 'transparent', border: '1px solid var(--erp-border)', color: 'var(--erp-text-main)' }}>نسخ النص</button>
              <button onClick={() => window.open(`https://wa.me/2${selectedClient.phone1}?text=${encodeURIComponent(whatsappMsg)}`, '_blank')} className="erp-btn-primary" style={{ flex: 2, background: '#2ecc71', color: '#000' }}>إرسال عبر واتساب الآن</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. History Modal */}
      {isHistoryModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--erp-primary)' }}>
              {historyType === 'packages' ? 'سجل الخدمات والباقات' : historyType === 'bookings' ? 'سجل مواعيد التصوير' : 'سجل الدفعات والمعاملات المالية'} 
              {' '} - {selectedClient.name}
            </h3>
            
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>جاري تحميل السجلات...</div>
              ) : historyData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>لا توجد سجلات مطابقة لهذا العميل. (تأكد من تشغيل ملف SQL في Supabase)</div>
              ) : (
                <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--erp-surface)', zIndex: 10 }}>
                    <tr>
                      {historyType === 'finance' ? (
                        <>
                          <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid var(--erp-border)' }}>التاريخ</th>
                          <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid var(--erp-border)' }}>البيان</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--erp-border)' }}>المبلغ</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--erp-border)' }}>الطريقة</th>
                        </>
                      ) : (
                        <>
                          <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid var(--erp-border)' }}>التاريخ</th>
                          <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid var(--erp-border)' }}>الخدمة</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--erp-border)' }}>الحالة</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid var(--erp-border)' }}>المبلغ/المدفوع</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(row => (
                      <tr key={row.id}>
                        {historyType === 'finance' ? (
                          <>
                            <td style={{ padding: '12px', borderBottom: '1px solid var(--erp-border)', direction: 'ltr', textAlign: 'right' }}>{row.date}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid var(--erp-border)' }}>{row.detail}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', fontWeight: 'bold', color: row.type === 'وارد' ? '#2ecc71' : '#e74c3c' }}>{row.amount} ج</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center' }}>{row.method}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '12px', borderBottom: '1px solid var(--erp-border)', direction: 'ltr', textAlign: 'right' }}>{row.date}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid var(--erp-border)' }}>{row.service}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center' }}>
                              <span style={{ padding: '4px 8px', borderRadius: '4px', background: row.status === 'منتهي' ? '#e74c3c20' : '#3498db20', color: row.status === 'منتهي' ? '#e74c3c' : '#3498db', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                {row.status || 'مؤكد'}
                              </span>
                            </td>
                            <td style={{ padding: '12px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', fontWeight: 'bold' }}>{row.payment || 0} ج</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <button className="erp-btn-primary" onClick={() => setIsHistoryModalOpen(false)} style={{ marginTop: '20px', padding: '12px' }}>
              إغلاق
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ERPClients;
