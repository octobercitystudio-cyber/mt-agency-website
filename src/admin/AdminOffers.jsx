import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Plus, Trash2, Edit2, Save, X, Tag } from 'lucide-react';
import './AdminLayout.css';

const AdminOffers = () => {
  const { siteData, updateSection } = useData();
  const [offers, setOffers] = useState(siteData.offers || []);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOffer, setCurrentOffer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleGlobalSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      updateSection('offers', offers);
      setIsSaving(false);
      alert('تم حفظ بيانات العروض بنجاح!');
    }, 600);
  };

  const toggleStatus = (id) => {
    const updated = offers.map(o => o.id === id ? { ...o, is_active: !o.is_active } : o);
    setOffers(updated);
    updateSection('offers', updated);
  };

  const handleSave = (e) => {
    e.preventDefault();
    let updatedOffers;
    if (currentOffer.id) {
      updatedOffers = offers.map(o => o.id === currentOffer.id ? currentOffer : o);
    } else {
      updatedOffers = [...offers, { ...currentOffer, id: Date.now(), is_active: true }];
    }
    setOffers(updatedOffers);
    updateSection('offers', updatedOffers);
    setIsEditing(false);
    setCurrentOffer(null);
  };

  const handleDelete = (id) => {
    if(window.confirm('هل أنت متأكد من حذف هذا العرض؟')) {
      const updated = offers.filter(o => o.id !== id);
      setOffers(updated);
      updateSection('offers', updated);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-header">
        <div>
          <h2><Tag /> إدارة العروض</h2>
          <p>أضف وتحكم في العروض الخاصة التي تظهر للمعلمين في لوحة التحكم.</p>
        </div>
        <div style={{display: 'flex', gap: '15px'}}>
          <button className="admin-btn" style={{background: 'var(--color-cyan)', color: '#000'}} onClick={() => { setCurrentOffer({ title: '', desc: '', discount: '', is_active: true }); setIsEditing(true); }}>
            <Plus size={20} /> إضافة عرض جديد
          </button>
          <button className="admin-btn primary" onClick={handleGlobalSave} disabled={isSaving}>
            <Save size={20} /> {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>عنوان العرض</th>
                <th>نسبة الخصم</th>
                <th>الوصف</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {offers.map(offer => (
                <tr key={offer.id}>
                  <td><strong>{offer.title}</strong></td>
                  <td><span className="discount-badge" style={{ background: 'rgba(157, 78, 221, 0.2)', color: '#c678ff', padding: '4px 10px', borderRadius: '12px' }}>{offer.discount}</span></td>
                  <td>{offer.desc}</td>
                  <td>
                    <span style={{color: offer.is_active ? '#00ff00' : '#ff4d4d'}}>
                      {offer.is_active ? 'نشط' : 'متوقف'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons" style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                      <button 
                        className="icon-btn" 
                        style={{background: offer.is_active ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,0,0.2)', color: offer.is_active ? '#ff4d4d' : '#00ff00', border: `1px solid ${offer.is_active ? '#ff4d4d' : '#00ff00'}`, padding: '5px 10px', borderRadius: '5px', fontSize: '0.85rem'}}
                        onClick={() => toggleStatus(offer.id)}
                      >
                        {offer.is_active ? 'إلغاء التفعيل' : 'تفعيل'}
                      </button>
                      <button className="icon-btn edit" onClick={() => { setCurrentOffer(offer); setIsEditing(true); }} title="تعديل"><Edit2 size={18} /></button>
                      <button className="icon-btn delete" onClick={() => handleDelete(offer.id)} title="حذف"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {offers.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>لا توجد عروض مضافة حالياً.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isEditing && currentOffer && (
        <div className="admin-modal">
          <div className="admin-modal-content">
            <div className="modal-header">
              <h3>{currentOffer.id ? 'تعديل عرض' : 'إضافة عرض جديد'}</h3>
              <button className="close-btn" onClick={() => { setIsEditing(false); setCurrentOffer(null); }}><X /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>عنوان العرض:</label>
                <input type="text" required value={currentOffer.title} onChange={e => setCurrentOffer({...currentOffer, title: e.target.value})} placeholder="مثال: خصم 20% على باقة 50 ساعة" />
              </div>
              <div className="form-group">
                <label>نسبة الخصم (للعرض البصري):</label>
                <input type="text" required value={currentOffer.discount} onChange={e => setCurrentOffer({...currentOffer, discount: e.target.value})} placeholder="مثال: 20%" />
              </div>
              <div className="form-group">
                <label>تفاصيل العرض:</label>
                <textarea required rows="4" value={currentOffer.desc} onChange={e => setCurrentOffer({...currentOffer, desc: e.target.value})} placeholder="اكتب تفاصيل وشروط العرض هنا..." />
              </div>
              <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" checked={currentOffer.is_active !== false} onChange={e => setCurrentOffer({...currentOffer, is_active: e.target.checked})} id="isActive" style={{ width: 'auto' }} />
                <label htmlFor="isActive" style={{ margin: 0 }}>تفعيل العرض (يظهر للعملاء)</label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="admin-btn primary"><Save size={20} /> حفظ العرض</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOffers;
