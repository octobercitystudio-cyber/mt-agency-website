import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Edit, Trash2, Search, Phone, Wallet, DollarSign, MessageCircle, CalendarPlus, CheckSquare, History, FileText, Camera, Calendar, Tag, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ERPAddBookingModal from './ERPAddBookingModal';

const ERPClients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isAddBookingModalOpen, setIsAddBookingModalOpen] = useState(false);
  const [bookingClientName, setBookingClientName] = useState('');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  
  // History Modals
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyType, setHistoryType] = useState('bookings');
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Modal states
  const [isEditing, setIsEditing] = useState(false);
  const [currentClient, setCurrentClient] = useState({ name: '', phone1: '', phone2: '', job: '', color: '#4318ff', debt: 0, points: 0 });
  const [financeAction, setFinanceAction] = useState('pay_debt');
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
    const { data: allBookings, error } = await supabase.from('bookings').select('*').eq('client_name', clientName);
    if (error || !allBookings) { setActivePackages([]); return; }

    const pkgMap = {};
    allBookings.forEach(b => {
      if (b.service && b.service.includes('(مؤرشف)')) return;
      const sName = b.service;
      if (!pkgMap[sName]) {
        pkgMap[sName] = { service: sName, used_hours: 0, used_reels: 0, paid: 0, custom_price: -1, custom_expiry: '', delivery_date: '', discount: 0 };
      }
      if (b.status !== 'دفعة') pkgMap[sName].used_hours += (parseFloat(b.actual_hours) || 0);
      if (['منتهي', 'مؤرشف', 'نشط'].includes(b.status)) pkgMap[sName].used_reels += (parseInt(b.actual_reels) || 0);
      if (b.status === 'دفعة') pkgMap[sName].paid += (parseFloat(b.payment) || 0);

      if (b.custom_expiry) pkgMap[sName].custom_expiry = b.custom_expiry;
      if (b.delivery_date) pkgMap[sName].delivery_date = b.delivery_date;
      if (parseFloat(b.custom_price) > -1) pkgMap[sName].custom_price = parseFloat(b.custom_price);
    });

    const activeList = [];
    Object.values(pkgMap).forEach(pkg => {
      const sDef = systemServices.find(s => s.name === pkg.service);
      let totalHours = 0, totalReels = 0, price = pkg.custom_price > -1 ? pkg.custom_price : 0;
      
      if (sDef) {
        totalHours = parseFloat(sDef.total_hours) || 0;
        totalReels = parseInt(sDef.total_reels) || 0;
        if (price === 0) price = parseFloat(sDef.price) || 0;
      } else {
        const name = pkg.service || '';
        const hoursMatch = name.match(/(\d+)\s*ساعة/);
        if (hoursMatch) totalHours = parseInt(hoursMatch[1]);
        const reelsMatch = name.match(/(\d+)\s*فيديو/);
        if (reelsMatch) totalReels = parseInt(reelsMatch[1]);
      }
      
      const remainingPaid = price - pkg.paid;
      const hasRemainingHours = totalHours > 0 && pkg.used_hours < totalHours;
      const hasRemainingReels = totalReels > 0 && pkg.used_reels < totalReels;
      const owesMoney = remainingPaid > 0;
      const isJustBooked = pkg.used_hours === 0 && pkg.used_reels === 0;
      
      if (hasRemainingHours || hasRemainingReels || owesMoney || isJustBooked) {
        activeList.push({ ...pkg, total_hours: totalHours, total_reels: totalReels, price: price });
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
          name: currentClient.name, phone1: currentClient.phone1, phone2: currentClient.phone2, 
          job: currentClient.job, color: currentClient.color
      }).eq('id', currentClient.id);
      if (!error) fetchClients();
    } else {
      const { error } = await supabase.from('clients').insert([{ 
          name: currentClient.name, phone1: currentClient.phone1, phone2: currentClient.phone2, 
          job: currentClient.job, color: currentClient.color, points: 0, debt: 0
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
      const newDebt = Math.max(0, (selectedClient.debt || 0) - financeAmount);
      await supabase.from('clients').update({ debt: newDebt }).eq('id', selectedClient.id);
      await supabase.from('finance').insert([{ type: 'وارد', amount: financeAmount, method: financeMethod, detail: `سداد مديونية من العميل ${selectedClient.name}`, date: new Date().toISOString().split('T')[0], entity: 'الشركة' }]);
    } else {
      const newCredit = (selectedClient.credit || 0) + financeAmount;
      await supabase.from('clients').update({ credit: newCredit }).eq('id', selectedClient.id);
      await supabase.from('finance').insert([{ type: 'وارد', amount: financeAmount, method: financeMethod, detail: `إيداع رصيد للعميل ${selectedClient.name}`, date: new Date().toISOString().split('T')[0], entity: 'الشركة' }]);
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
      // Fetch from finance where detail contains client name
      const { data, error } = await supabase.from('finance').select('*').ilike('detail', `%${selectedClient.name}%`).order('id', { ascending: false });
      
      // Also fetch from bookings where status is 'دفعة' or payment > 0
      const { data: bData, error: bError } = await supabase.from('bookings').select('*').eq('client_name', selectedClient.name).gt('payment', 0).order('id', { ascending: false });
      
      let allFinance = [];
      if (!error && data) allFinance = [...data];
      
      if (!bError && bData) {
        // Map bookings payments to look like finance records
        const mappedBookings = bData.map(b => ({
          id: 'b_' + b.id,
          date: b.date,
          detail: b.notes || 'دفعة حجز: ' + (b.service || ''),
          amount: b.payment,
          method: 'غير محدد',
          type: 'إيراد'
        }));
        // Merge and sort
        allFinance = [...allFinance, ...mappedBookings].sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      setHistoryData(allFinance);
    } else {
      const { data, error } = await supabase.from('bookings').select('*').eq('client_name', selectedClient.name).order('id', { ascending: false });
      if (!error && data) {
        if (type === 'packages') {
          // Group by service to build package summary cards
          const packagesMap = {};
          data.forEach(b => {
            if (!b.service) return;
            const cleanName = b.service.replace('(مؤرشف)', '').trim();
            if (!packagesMap[cleanName]) {
              packagesMap[cleanName] = {
                id: b.id,
                serviceName: cleanName,
                date: b.date,
                custom_price: b.custom_price > 0 ? b.custom_price : 0,
                discount: b.discount || 0,
                discount_reason: b.discount_reason || '',
                total_paid: 0,
                is_archived: b.service.includes('مؤرشف') || b.status === 'مؤرشف'
              };
            }
            // Capture creation attributes
            if (b.custom_price > 0) {
              if (new Date(b.date) < new Date(packagesMap[cleanName].date)) {
                packagesMap[cleanName].date = b.date;
              }
              if (b.custom_price > packagesMap[cleanName].custom_price) {
                packagesMap[cleanName].custom_price = b.custom_price;
                packagesMap[cleanName].discount = b.discount || 0;
                packagesMap[cleanName].discount_reason = b.discount_reason || '';
              }
            }
            packagesMap[cleanName].total_paid += Number(b.payment || 0);
            if (b.service.includes('مؤرشف') || b.status === 'مؤرشف') {
               packagesMap[cleanName].is_archived = true;
            }
          });
          
          const packagesList = Object.values(packagesMap).filter(p => p.custom_price > 0);
          packagesList.sort((a, b) => new Date(b.date) - new Date(a.date));
          setHistoryData(packagesList);
        } else {
          // Photography appointments are bookings with actual_hours > 0 or start_time/end_time
          setHistoryData(data.filter(b => b.actual_hours > 0 || (b.start_time && b.start_time !== '')));
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
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontWeight: 'bold', color: 'var(--erp-text-main)' }}>
            <UserPlus color="#4318ff" /> قاعدة العملاء
          </h2>
        </div>
        
        <div style={{ flex: '1', maxWidth: '350px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)', color: '#a3aed1' }} />
          <input 
            type="text" 
            placeholder="ابحث باسم العميل..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '10px 45px 10px 15px', borderRadius: '50rem', border: 'none', 
              boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', fontWeight: 'bold', color: '#4318ff', outline: 'none' 
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedIds.length > 0 && (
            <button onClick={handleBulkDelete} style={{ background: '#dc3545', color: 'var(--erp-surface)', padding: '10px 20px', borderRadius: '50rem', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
              <Trash2 size={18} /> حذف المحدد ({selectedIds.length}) نهائياً
            </button>
          )}
          <button onClick={() => { setIsEditing(false); setCurrentClient({ name: '', phone1: '', phone2: '', job: '', color: '#4318ff', debt: 0, points: 0 }); setIsClientModalOpen(true); }} style={{ background: '#0d6efd', color: 'var(--erp-surface)', padding: '10px 20px', borderRadius: '50rem', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
            <UserPlus size={18} /> عميل جديد
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '25px', minHeight: '680px' }}>
        
        {/* Table Section */}
        <div style={{ background: 'var(--erp-surface)', borderRadius: '1rem', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--erp-bg)', zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '15px 25px', borderBottom: '1px solid #dee2e6', width: '40px' }}>
                    <input type="checkbox" checked={selectedIds.length === filteredClients.length && filteredClients.length > 0} onChange={toggleSelectAll} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} />
                  </th>
                  <th style={{ padding: '15px', borderBottom: '1px solid #dee2e6', color: 'var(--erp-text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>العميل</th>
                  <th style={{ padding: '15px', borderBottom: '1px solid #dee2e6', color: 'var(--erp-text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>التواصل</th>
                  <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', color: 'var(--erp-text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => {
                  const isSelected = selectedClient?.id === client.id;
                  return (
                    <tr key={client.id} 
                      onClick={() => setSelectedClient(client)}
                      style={{ 
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: isSelected ? 'rgba(67, 24, 255, 0.15)' : 'transparent',
                        borderRight: isSelected ? '4px solid #4318ff' : '4px solid transparent',
                        boxShadow: isSelected ? 'inset 0 0 15px rgba(67, 24, 255, 0.05)' : 'none'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--erp-bg)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '15px 25px', borderBottom: '1px solid #dee2e6' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(client.id)} onChange={() => toggleSelectOne(client.id)} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: client.color || '#4318ff', color: 'var(--erp-surface)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '800', fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(67, 24, 255, 0.2)' }}>
                            {client.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', fontSize: '1.05rem' }}>{client.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--erp-text-muted)', marginTop: '2px' }}>{client.job || 'لا يوجد وظيفة مسجلة'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
                          <div style={{ direction: 'ltr', textAlign: 'right' }}>
                            <div style={{ fontWeight: 'bold', color: '#4318ff', fontSize: '0.9rem' }}>{client.phone1}</div>
                            {client.phone2 && <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)' }}>{client.phone2}</div>}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setBookingClientName(client.name); setIsAddBookingModalOpen(true); }} style={{ background: 'rgba(67, 24, 255, 0.1)', color: '#4318ff', border: '1px solid rgba(67, 24, 255, 0.2)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            <CalendarPlus size={16} /> حجز / إضافة
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setCurrentClient(client); setIsEditing(true); setIsClientModalOpen(true); }} style={{ background: 'rgba(13, 110, 253, 0.1)', color: '#0d6efd', border: 'none', width: '35px', height: '35px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: '0.2s' }}>
                            <Edit size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteClient(client.id, client.name); }} style={{ background: 'rgba(220, 53, 69, 0.1)', color: '#dc3545', border: 'none', width: '35px', height: '35px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: '0.2s' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Section */}
        <div style={{ background: 'var(--erp-surface)', borderRadius: '1rem', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', borderTop: '4px solid #0d6efd', padding: '30px', overflowY: 'auto', maxHeight: '750px' }}>
          {!selectedClient ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <CheckSquare size={60} color="#cbd5e1" style={{ marginBottom: '15px' }} />
              <h5 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)' }}>تفاصيل العميل</h5>
              <p style={{ color: 'var(--erp-text-muted)', fontSize: '0.9rem' }}>اضغط على أي عميل من القائمة لعرض تفاصيله.</p>
            </div>
          ) : (
            <div style={{ animation: 'fadeInLeft 0.5s ease-out' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px solid #dee2e6', paddingBottom: '25px', marginBottom: '25px' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: selectedClient.color || '#4318ff', color: 'var(--erp-surface)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '800', fontSize: '2rem', margin: '0 auto 15px auto', boxShadow: '0 4px 10px rgba(67, 24, 255, 0.2)' }}>
                  {selectedClient.name.charAt(0)}
                </div>
                <h4 style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', margin: '0 0 15px 0' }}>{selectedClient.name}</h4>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#ffc107', border: '1px solid #ffecb5', padding: '8px 16px', borderRadius: '50px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
                    ⭐ رصيد النقاط: <span style={{ color: '#dc3545' }}>{selectedClient.points || 0}</span>
                  </span>
                  {(selectedClient.credit > 0) && (
                    <span style={{ background: 'rgba(25, 135, 84, 0.15)', color: '#198754', border: '1px solid #badbcc', padding: '8px 16px', borderRadius: '50px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
                      💰 رصيد بالشركة: {selectedClient.credit || 0} ج.م
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '10px', background: 'var(--erp-bg)', padding: '10px', borderRadius: '1rem', border: '1px solid #dee2e6', overflowX: 'auto', marginTop: '20px' }}>
                  <button onClick={() => navigate('/erp/bookings')} style={{ background: '#0d6efd', color: 'var(--erp-surface)', padding: '10px 5px', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>
                    <CalendarPlus size={20} /> <span style={{ fontSize: '0.8rem' }}>حجز جديد</span>
                  </button>
                  <button onClick={() => { setFinanceAction('deposit'); setIsFinanceModalOpen(true); }} style={{ background: '#0dcaf0', color: '#000', color: 'var(--erp-text-main)', padding: '10px 5px', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>
                    <Wallet size={20} /> <span style={{ fontSize: '0.8rem' }}>إيداع رصيد</span>
                  </button>
                  <button onClick={() => { setFinanceAction('pay_debt'); setIsFinanceModalOpen(true); }} style={{ background: '#ffc107', color: '#000', color: 'var(--erp-text-main)', padding: '10px 5px', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>
                    <DollarSign size={20} /> <span style={{ fontSize: '0.8rem' }}>سداد مديونية</span>
                  </button>
                  <button onClick={openWhatsApp} style={{ background: '#198754', color: '#fff', color: 'var(--erp-surface)', padding: '10px 5px', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>
                    <MessageCircle size={20} /> <span style={{ fontSize: '0.8rem' }}>إرسال تقرير</span>
                  </button>
                </div>
                
                <button onClick={() => navigate('/erp/bookings')} style={{ width: '100%', background: '#dc3545', color: 'var(--erp-surface)', padding: '1.5rem', borderRadius: '1rem', fontWeight: 'bold', fontSize: '1.5rem', border: '3px solid #ffcccc', boxShadow: '0 0.5rem 1rem rgba(0,0,0,.15)', marginTop: '15px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', animation: 'pulse 2s infinite' }}>
                  <Play fill="currentColor" /> ابدأ التصوير الآن
                </button>
              </div>

              {selectedClient.debt > 0 && (
                <div style={{ background: 'rgba(220, 53, 69, 0.15)', border: '1px solid #f5c2c7', padding: '15px', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                  <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '0.9rem' }}>إجمالي المديونية المتأخرة المستحقة:</span>
                  <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>{selectedClient.debt} ج</span>
                </div>
              )}

              {/* Active Packages */}
              {activePackages.length > 0 && (
                <div>
                  <h5 style={{ color: 'var(--erp-text-main)', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Camera color="#4318ff" size={20} /> باقة التصوير النشطة:
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {activePackages.map((pkg, idx) => {
                      const totalHours = pkg.total_hours;
                      const totalReels = pkg.total_reels;
                      const remHours = Math.max(0, totalHours - pkg.used_hours);
                      const remReels = Math.max(0, totalReels - pkg.used_reels);
                      const remainingPaid = Math.max(0, pkg.price - pkg.paid);
                      
                      return (
                        <div key={idx} style={{ background: 'var(--erp-surface)', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '20px', position: 'relative', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.05)' }}>
                          <div style={{ position: 'absolute', top: '15px', right: 0, bottom: '15px', width: '4px', background: '#0d6efd', borderRadius: '10px 0 0 10px' }}></div>
                          <h5 style={{ fontWeight: 'bold', color: '#0d6efd', marginBottom: '20px', textAlign: 'right', marginRight: '15px' }}>{pkg.service.replace(' (مؤرشف)', '')}</h5>
                          
                          {/* Stats 3 Boxes */}
                          {totalHours > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>المتبقي</div>
                                <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1.1rem', direction: 'rtl' }}>{formatHours(remHours)}</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>المستخدم</div>
                                <div style={{ fontWeight: 'bold', color: '#0d6efd', fontSize: '1.1rem', direction: 'rtl' }}>{formatHours(pkg.used_hours)}</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>الباقة</div>
                                <div style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', fontSize: '1.1rem', direction: 'rtl' }}>{totalHours} س</div>
                              </div>
                            </div>
                          )}

                          {totalReels > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>المتبقي</div>
                                <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1.1rem' }}>{remReels} ريل</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>المستخدم</div>
                                <div style={{ fontWeight: 'bold', color: '#0d6efd', fontSize: '1.1rem' }}>{pkg.used_reels} ريل</div>
                              </div>
                              <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '12px', padding: '10px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>الباقة</div>
                                <div style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', fontSize: '1.1rem' }}>{totalReels} ريل</div>
                              </div>
                            </div>
                          )}

                          {/* Finance 3 Boxes */}
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ flex: 1, background: 'rgba(220, 53, 69, 0.15)', borderRadius: '10px', padding: '12px 5px', textAlign: 'center', border: '1px solid #f5c2c7' }}>
                              <div style={{ fontSize: '0.8rem', color: '#dc3545', marginBottom: '2px', fontWeight: 'bold' }}>المتبقي</div>
                              <div style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '1rem' }}>{remainingPaid} ج</div>
                            </div>
                            <div style={{ flex: 1, background: 'rgba(25, 135, 84, 0.15)', borderRadius: '10px', padding: '12px 5px', textAlign: 'center', border: '1px solid #badbcc' }}>
                              <div style={{ fontSize: '0.8rem', color: '#198754', marginBottom: '2px', fontWeight: 'bold' }}>المدفوع</div>
                              <div style={{ fontWeight: 'bold', color: '#198754', fontSize: '1rem' }}>{pkg.paid} ج</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '10px', padding: '12px 5px', textAlign: 'center', background: 'var(--erp-bg)' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--erp-text-muted)', marginBottom: '2px', fontWeight: 'bold' }}>التكلفة</div>
                              <div style={{ fontWeight: 'bold', color: 'var(--erp-text-main)', fontSize: '1rem' }}>{pkg.price} ج</div>
                            </div>
                          </div>

                          {pkg.discount > 0 && (
                            <div style={{ background: 'rgba(220, 53, 69, 0.15)', borderRadius: '10px', padding: '10px', textAlign: 'center', marginBottom: '15px', border: '1px solid #f5c2c7' }}>
                              <div style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '0.9rem' }}><Tag size={14} style={{ verticalAlign: 'middle', marginLeft: '5px' }} />الخصم: {pkg.discount} ج.م</div>
                            </div>
                          )}

                          {remainingPaid > 0 && (
                            <button onClick={() => { setFinanceMethod('كاش'); setIsFinanceModalOpen(true); }} style={{ width: '100%', background: '#ffc107', color: '#000', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
                              <Wallet size={18} /> سداد المتبقي
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* History Section */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                <button onClick={() => openHistory('packages')} style={{ flex: 1, background: 'transparent', border: '1px solid #dee2e6', padding: '15px', borderRadius: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }}>
                  <History size={24} color="#6c757d" /> <span style={{ color: 'var(--erp-text-main)', fontSize: '0.85rem', textAlign: 'center' }}>سجل الباقات والخدمات المنتهية</span>
                </button>
                <button onClick={() => openHistory('bookings')} style={{ flex: 1, background: 'transparent', border: '1px solid #dee2e6', padding: '15px', borderRadius: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }}>
                  <CalendarPlus size={24} color="#0d6efd" /> <span style={{ color: 'var(--erp-text-main)', fontSize: '0.85rem' }}>مواعيد التصوير</span>
                </button>
                <button onClick={() => openHistory('finance')} style={{ flex: 1, background: 'transparent', border: '1px solid #dee2e6', padding: '15px', borderRadius: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }}>
                  <FileText size={24} color="#198754" /> <span style={{ color: 'var(--erp-text-main)', fontSize: '0.85rem' }}>الدفعات النقدية</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      {/* 1. Client Modal */}
      {isClientModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsClientModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{  maxWidth: '500px', borderRadius: '1.5rem', padding: '30px', border: 'none', boxShadow: '0 1rem 3rem rgba(0,0,0,.175)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px', color: 'var(--erp-text-main)', fontWeight: 'bold' }}>
              <UserPlus color="#ffc107" /> {isEditing ? 'تعديل بيانات العميل' : 'تسجيل عميل جديد'}
            </h4>
            <form onSubmit={handleSaveClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>الاسم بالكامل</label><input type="text" style={{ width: '100%', padding: '12px', borderRadius: '0.5rem', border: 'none', background: 'var(--erp-bg)', fontWeight: 'bold' }} value={currentClient.name} onChange={e => setCurrentClient({...currentClient, name: e.target.value})} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>واتساب (أساسي)</label><input type="text" style={{ width: '100%', padding: '12px', borderRadius: '0.5rem', border: 'none', background: 'rgba(25, 135, 84, 0.15)', color: '#198754', fontWeight: 'bold' }} value={currentClient.phone1} onChange={e => setCurrentClient({...currentClient, phone1: e.target.value})} required /></div>
                <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>رقم ثانٍ (اختياري)</label><input type="text" style={{ width: '100%', padding: '12px', borderRadius: '0.5rem', border: 'none', background: 'var(--erp-bg)' }} value={currentClient.phone2} onChange={e => setCurrentClient({...currentClient, phone2: e.target.value})} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
                <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>الوظيفة / ملاحظة</label><input type="text" style={{ width: '100%', padding: '12px', borderRadius: '0.5rem', border: 'none', background: 'var(--erp-bg)' }} value={currentClient.job} onChange={e => setCurrentClient({...currentClient, job: e.target.value})} /></div>
                <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>اللون</label><input type="color" style={{ width: '100%', padding: '5px', borderRadius: '0.5rem', border: 'none', height: '45px', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }} value={currentClient.color} onChange={e => setCurrentClient({...currentClient, color: e.target.value})} /></div>
              </div>
              <button type="submit" style={{ width: '100%', padding: '15px', borderRadius: '1rem', border: 'none', background: isEditing ? 'var(--erp-text-main)' : '#0d6efd', color: 'var(--erp-surface)', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '15px', boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)' }}>{isEditing ? 'تحديث البيانات' : 'حفظ العميل'}</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Finance Modal */}
      {isFinanceModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsFinanceModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{  maxWidth: '450px', borderRadius: '1.5rem', padding: '0', border: 'none', overflow: 'hidden' }}>
            <div style={{ background: financeAction === 'deposit' ? '#0dcaf0' : '#ffc107', padding: '25px', textAlign: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 'bold', color: 'var(--erp-text-main)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                <Wallet /> {financeAction === 'deposit' ? 'إيداع رصيد مالي للعميل بالشركة' : 'سداد دفعة من المديونية'}
              </h4>
            </div>
            <div style={{ padding: '30px', textAlign: 'center' }}>
              <form onSubmit={handleFinanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>المبلغ (ج.م)</label>
                  <input type="number" value={financeAmount} onChange={e => setFinanceAmount(Number(e.target.value))} required min="1" style={{ width: '100%', padding: '15px', borderRadius: '1rem', border: 'none', background: financeAction === 'deposit' ? 'rgba(13, 202, 240, 0.15)' : 'rgba(25, 135, 84, 0.15)', color: financeAction === 'deposit' ? '#0dcaf0' : '#198754', fontSize: '2rem', textAlign: 'center', fontWeight: 'bold' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' }}>طريقة السداد / الخزينة</label>
                  <select value={financeMethod} onChange={e => setFinanceMethod(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '1rem', border: 'none', background: 'var(--erp-bg)', fontWeight: 'bold' }}>
                    <option value="كاش">كاش</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="انستاباي">إنستاباي</option>
                  </select>
                </div>
                <button type="submit" style={{ width: '100%', padding: '15px', borderRadius: '1rem', border: 'none', background: financeAction === 'deposit' ? '#0dcaf0' : '#ffc107', color: 'var(--erp-text-main)', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '10px', boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)' }}>تأكيد العملية</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. WhatsApp Modal */}
      {isWhatsAppModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsWhatsAppModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{  maxWidth: '600px', borderRadius: '1.5rem', padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#198754', color: '#fff', padding: '25px', color: 'var(--erp-surface)' }}>
              <h4 style={{ margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageCircle /> معاينة وإرسال التقرير
              </h4>
            </div>
            <div style={{ padding: '30px', background: 'var(--erp-bg)' }}>
              <textarea style={{ width: '100%', padding: '20px', borderRadius: '1rem', border: 'none', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', resize: 'none', minHeight: '200px', fontWeight: 'bold', color: 'var(--erp-text-main)', lineHeight: '1.6' }} value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)}></textarea>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => { navigator.clipboard.writeText(whatsappMsg); alert('تم النسخ!'); }} style={{ flex: 1, padding: '12px', borderRadius: '50rem', border: '1px solid #dee2e6', background: 'var(--erp-surface)', color: 'var(--erp-text-main)', fontWeight: 'bold', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>نسخ النص</button>
                <button onClick={() => window.open(`https://wa.me/2${selectedClient.phone1}?text=${encodeURIComponent(whatsappMsg)}`, '_blank')} style={{ flex: 1, padding: '12px', borderRadius: '50rem', border: 'none', background: '#198754', color: '#fff', color: 'var(--erp-surface)', fontWeight: 'bold', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)', cursor: 'pointer' }}>إرسال عبر واتساب الآن</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. History Modal */}
      {isHistoryModalOpen && selectedClient && (
        <div className="erp-modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="erp-modal-content" onClick={e => e.stopPropagation()} style={{  maxWidth: '800px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderRadius: '1.5rem', padding: '30px' }}>
            <h4 style={{ marginBottom: '25px', color: 'var(--erp-text-main)', fontWeight: 'bold' }}>
              {historyType === 'packages' ? 'سجل الباقات والخدمات المنتهية' : historyType === 'bookings' ? 'سجل مواعيد التصوير' : 'سجل الدفعات والمعاملات المالية'} 
              {' '} - {selectedClient.name}
            </h4>
            
            <div style={{ overflowY: 'auto', flex: 1, border: historyType === 'packages' ? 'none' : '1px solid #dee2e6', borderRadius: '1rem' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>جاري تحميل السجلات...</div>
              ) : historyData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--erp-text-muted)' }}>لا توجد سجلات.</div>
              ) : historyType === 'packages' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '5px' }}>
                  {historyData.map(pkg => {
                    const price = pkg.custom_price;
                    const discount = pkg.discount;
                    const paid = pkg.total_paid;
                    const remaining = price - discount - paid;
                    const isArchived = pkg.is_archived;
                    
                    const dateObj = new Date(pkg.date);
                    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                    const dayName = days[dateObj.getDay()];
                    const formattedDate = `${dayName} ${dateObj.getDate().toString().padStart(2, '0')}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getFullYear()}`;

                    return (
                      <div key={pkg.id} style={{ background: 'var(--erp-bg)', border: '1px solid #dee2e6', borderRadius: '1rem', padding: '20px', boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexDirection: 'row-reverse' }}>
                          <h5 style={{ margin: 0, fontWeight: 'bold', color: 'var(--erp-text-main)' }}>{pkg.serviceName}</h5>
                          <span style={{ padding: '5px 15px', borderRadius: '50rem', background: isArchived ? '#6c757d' : '#198754', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            {isArchived ? 'مؤرشفة (منتهية)' : 'نشطة'}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right', marginBottom: '15px', color: 'var(--erp-text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          <Calendar size={16} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                          تاريخ الاشتراك: {formattedDate}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center', marginBottom: '15px', direction: 'rtl' }}>
                          <div style={{ border: '1px solid #dee2e6', borderRadius: '0.5rem', padding: '10px', fontWeight: 'bold', color: 'var(--erp-text-main)', background: 'var(--erp-surface)' }}>
                            السعر: {price}
                          </div>
                          <div style={{ border: '1px solid #dee2e6', borderRadius: '0.5rem', padding: '10px', fontWeight: 'bold', color: '#198754', background: 'var(--erp-surface)' }}>
                            المدفوع: {paid}
                          </div>
                          <div style={{ border: '1px solid #dee2e6', borderRadius: '0.5rem', padding: '10px', fontWeight: 'bold', color: remaining > 0 ? '#dc3545' : '#198754', background: 'var(--erp-surface)' }}>
                            المتبقي: {remaining}
                          </div>
                        </div>
                        {discount > 0 && (
                          <div style={{ background: 'rgba(220, 53, 69, 0.15)', color: '#dc3545', borderRadius: '0.5rem', padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>
                            <Tag size={18} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                            خصم: {discount} ج.م
                            {pkg.discount_reason && <div style={{ fontSize: '0.85rem', marginTop: '5px', fontWeight: 'normal' }}>({pkg.discount_reason})</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--erp-bg)', zIndex: 10 }}>
                    <tr>
                      {historyType === 'finance' ? (
                        <>
                          <th style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>التاريخ</th>
                          <th style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>البيان</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>المبلغ</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>الطريقة</th>
                        </>
                      ) : (
                        <>
                          <th style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>التاريخ</th>
                          <th style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>الخدمة</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>ساعات</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>ريلز</th>
                          <th style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>البيان</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>الحالة</th>
                          <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid var(--erp-border)' }}>المدفوع</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(row => (
                      <tr key={row.id}>
                        {historyType === 'finance' ? (
                          <>
                            <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', direction: 'ltr', textAlign: 'right' }}>{row.date}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>{row.detail}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: row.type === 'وارد' ? '#198754' : '#dc3545' }}>{row.amount} ج</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>{row.method}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', direction: 'ltr', textAlign: 'right' }}>{row.date}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)' }}>{row.service}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', fontWeight: 'bold' }}>{row.actual_hours > 0 ? row.actual_hours : '-'}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center', fontWeight: 'bold' }}>{row.actual_reels > 0 ? row.actual_reels : '-'}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', fontSize: '0.85rem', color: 'var(--erp-text-muted)' }}>{row.notes}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid var(--erp-border)', textAlign: 'center' }}>
                              <span style={{ padding: '6px 12px', borderRadius: '0.5rem', background: row.status === 'منتهي' ? 'rgba(220, 53, 69, 0.15)' : 'rgba(13, 202, 240, 0.15)', color: row.status === 'منتهي' ? '#dc3545' : '#0dcaf0', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                {row.status || 'مؤكد'}
                              </span>
                            </td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold' }}>{row.payment || 0} ج</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <button onClick={() => setIsHistoryModalOpen(false)} style={{ width: '100%', marginTop: '20px', padding: '15px', borderRadius: '1rem', border: 'none', background: 'var(--erp-border)', color: 'var(--erp-text-main)', fontWeight: 'bold', cursor: 'pointer' }}>
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* New Add Booking Modal from ERPClients */}
      <ERPAddBookingModal 
        isOpen={isAddBookingModalOpen} 
        onClose={() => setIsAddBookingModalOpen(false)} 
        prefilledClientName={bookingClientName} 
      />

    </div>
  );
};

export default ERPClients;
