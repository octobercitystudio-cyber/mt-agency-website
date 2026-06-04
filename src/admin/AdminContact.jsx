import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save } from 'lucide-react';

const AdminContact = () => {
  const { siteData, updateSection } = useData();
  const [contactData, setContactData] = useState(siteData.contact);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setContactData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      updateSection('contact', contactData);
      setIsSaving(false);
      alert('تم حفظ بيانات التواصل بنجاح!');
    }, 600);
  };

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>إدارة بيانات التواصل</h2>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <Save size={18} />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div className="admin-grid">
        <div className="admin-card glass-panel">
          <h3>معلومات الاتصال الأساسية</h3>
          <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
          
          <div className="form-group">
            <label>رقم الهاتف / الواتساب</label>
            <input type="text" className="form-control" dir="ltr" value={contactData.phone} onChange={e => handleChange('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني (Email)</label>
            <input type="email" className="form-control" dir="ltr" value={contactData.email} onChange={e => handleChange('email', e.target.value)} />
          </div>
        </div>

        <div className="admin-card glass-panel">
          <h3>العنوان</h3>
          <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
          
          <div className="form-group">
            <label>العنوان (عربي)</label>
            <input type="text" className="form-control" value={contactData.address} onChange={e => handleChange('address', e.target.value)} />
          </div>
          <div className="form-group">
            <label>العنوان (إنجليزي)</label>
            <input type="text" className="form-control" dir="ltr" value={contactData.addressEn} onChange={e => handleChange('addressEn', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminContact;
