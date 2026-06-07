import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Edit, Trash2, Search, Phone } from 'lucide-react';
import '../admin/AdminLayout.css';

const ERPClients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState({ name: '', phone1: '', phone2: '', job: '', color: '#9d4edd' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('id', { ascending: false });
      
    if (!error && data) {
      setClients(data);
    }
    setLoading(false);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (isEditing) {
      const { error } = await supabase
        .from('clients')
        .update({ 
          name: currentClient.name, 
          phone1: currentClient.phone1, 
          phone2: currentClient.phone2, 
          job: currentClient.job,
          color: currentClient.color
        })
        .eq('id', currentClient.id);
      
      if (!error) fetchClients();
    } else {
      const { error } = await supabase
        .from('clients')
        .insert([{ 
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
    setIsModalOpen(false);
  };

  const openEditModal = (client) => {
    setCurrentClient(client);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setCurrentClient({ name: '', phone1: '', phone2: '', job: '', color: '#9d4edd' });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const deleteClient = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العميل؟')) {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (!error) fetchClients();
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone1.includes(searchTerm)
  );

  return (
    <div className="admin-section">
      <div className="admin-header">
        <div>
          <h2>إدارة العملاء</h2>
          <p>قاعدة بيانات العملاء المشتركين والمعلمين.</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <UserPlus size={18} /> إضافة عميل جديد
        </button>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c' }} />
            <input 
              type="text" 
              placeholder="ابحث عن عميل بالاسم أو رقم الهاتف..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-input"
              style={{ paddingRight: '45px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8c8c8c' }}>جاري تحميل العملاء...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '15px', textAlign: 'right' }}>الاسم</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>الوظيفة</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>الهاتف الأساسي</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>الهاتف البديل</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>المديونية</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '15px', height: '15px', borderRadius: '50%', background: client.color || '#9d4edd' }}></div>
                        {client.name}
                      </div>
                    </td>
                    <td style={{ padding: '15px', color: '#c0c0c0' }}>{client.job || '-'}</td>
                    <td style={{ padding: '15px' }} dir="ltr" align="right">{client.phone1}</td>
                    <td style={{ padding: '15px', color: '#c0c0c0' }} dir="ltr" align="right">{client.phone2 || '-'}</td>
                    <td style={{ padding: '15px', textAlign: 'center', color: client.debt > 0 ? '#ff4d4d' : '#00ff00' }}>
                      {client.debt} ج.م
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button onClick={() => openEditModal(client)} style={{ background: 'transparent', border: 'none', color: '#3498db', cursor: 'pointer', marginLeft: '10px' }}>
                        <Edit size={18} />
                      </button>
                      <button onClick={() => deleteClient(client.id)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#8c8c8c' }}>لا يوجد عملاء مطابقين للبحث.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="admin-card" style={{ width: '90%', maxWidth: '500px', background: 'var(--bg-dark)' }}>
            <h3 style={{ marginBottom: '20px' }}>{isEditing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
            <form onSubmit={handleSaveClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>اسم العميل</label>
                <input type="text" className="admin-input" value={currentClient.name} onChange={e => setCurrentClient({...currentClient, name: e.target.value})} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>الوظيفة / التخصص</label>
                <input type="text" className="admin-input" value={currentClient.job} onChange={e => setCurrentClient({...currentClient, job: e.target.value})} placeholder="مثال: مدرس فيزياء" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>الهاتف الأساسي</label>
                  <input type="tel" className="admin-input" value={currentClient.phone1} onChange={e => setCurrentClient({...currentClient, phone1: e.target.value})} dir="ltr" required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>الهاتف البديل (اختياري)</label>
                  <input type="tel" className="admin-input" value={currentClient.phone2} onChange={e => setCurrentClient({...currentClient, phone2: e.target.value})} dir="ltr" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>اللون المميز (للتقويم)</label>
                <input type="color" value={currentClient.color} onChange={e => setCurrentClient({...currentClient, color: e.target.value})} style={{ width: '100%', height: '40px', borderRadius: '8px', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{isEditing ? 'حفظ التعديلات' : 'إضافة العميل'}</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary" style={{ flex: 1 }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ERPClients;
