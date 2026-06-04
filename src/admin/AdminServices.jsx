import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save, Plus, Trash2 } from 'lucide-react';

const AdminServices = () => {
  const { siteData, updateSection } = useData();
  const [services, setServices] = useState(siteData.services);
  const [isSaving, setIsSaving] = useState(false);

  const handleServiceChange = (index, field, value) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  };

  const addService = () => {
    setServices([...services, { title: '', titleEn: '', desc: '', descEn: '', icon: '✨' }]);
  };

  const removeService = (index) => {
    const updated = services.filter((_, i) => i !== index);
    setServices(updated);
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API call delay
    setTimeout(() => {
      updateSection('services', services);
      setIsSaving(false);
      alert('تم حفظ التعديلات بنجاح!');
    }, 600);
  };

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>إدارة الخدمات</h2>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <Save size={18} />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div className="admin-grid">
        {services.map((service, index) => (
          <div key={index} className="admin-card glass-panel" style={{position: 'relative'}}>
            <button 
              onClick={() => removeService(index)}
              style={{position: 'absolute', top: '15px', left: '15px', background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff4d4d', padding: '8px', borderRadius: '50%', cursor: 'pointer'}}
              title="حذف الخدمة"
            >
              <Trash2 size={16} />
            </button>
            
            <div className="form-group">
              <label>الأيقونة (Emoji)</label>
              <input 
                type="text" 
                className="form-control" 
                value={service.icon} 
                onChange={(e) => handleServiceChange(index, 'icon', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>العنوان (عربي)</label>
              <input 
                type="text" 
                className="form-control" 
                value={service.title} 
                onChange={(e) => handleServiceChange(index, 'title', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>الوصف (عربي)</label>
              <textarea 
                className="form-control" 
                rows="2"
                value={service.desc} 
                onChange={(e) => handleServiceChange(index, 'desc', e.target.value)}
              ></textarea>
            </div>

            <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '20px 0'}} />

            <div className="form-group">
              <label>العنوان (إنجليزي)</label>
              <input 
                type="text" 
                className="form-control" 
                dir="ltr"
                value={service.titleEn} 
                onChange={(e) => handleServiceChange(index, 'titleEn', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>الوصف (إنجليزي)</label>
              <textarea 
                className="form-control" 
                rows="2"
                dir="ltr"
                value={service.descEn} 
                onChange={(e) => handleServiceChange(index, 'descEn', e.target.value)}
              ></textarea>
            </div>
          </div>
        ))}

        <div 
          className="admin-card glass-panel" 
          style={{display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: '300px', borderStyle: 'dashed'}}
          onClick={addService}
        >
          <div style={{textAlign: 'center', color: 'var(--color-silver)'}}>
            <Plus size={40} style={{marginBottom: '10px'}} />
            <h3>إضافة خدمة جديدة</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminServices;
