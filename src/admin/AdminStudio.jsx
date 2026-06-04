import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save, Image as ImageIcon } from 'lucide-react';

const AdminStudio = () => {
  const { siteData, updateSection } = useData();
  const [studios, setStudios] = useState(siteData.studio);
  const [isSaving, setIsSaving] = useState(false);

  // keys are october, lebanon, newCairo
  const studioKeys = Object.keys(studios);

  const handleImageChange = (studioKey, imageIndex, field, value) => {
    const updated = { ...studios };
    updated[studioKey][imageIndex] = { ...updated[studioKey][imageIndex], [field]: value };
    setStudios(updated);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      updateSection('studio', studios);
      setIsSaving(false);
      alert('تم حفظ بيانات الاستوديوهات بنجاح!');
    }, 600);
  };

  const getStudioName = (key) => {
    switch(key) {
      case 'october': return 'استديو أكتوبر';
      case 'lebanon': return 'استديو ميدان لبنان';
      case 'newCairo': return 'استديو القاهرة الجديدة';
      default: return key;
    }
  };

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>إدارة صور الاستوديوهات</h2>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <Save size={18} />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '30px'}}>
        {studioKeys.map((key) => (
          <div key={key} className="admin-card glass-panel">
            <h3>{getStudioName(key)}</h3>
            <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
            
            <div className="admin-grid" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))'}}>
              {studios[key].map((img, index) => (
                <div key={img.id} style={{background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px'}}>
                  <div style={{height: '120px', borderRadius: '8px', overflow: 'hidden', marginBottom: '15px'}}>
                    <img src={img.url} alt={img.alt} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  </div>
                  
                  <div className="form-group">
                    <label>رابط الصورة (URL)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      dir="ltr" 
                      value={img.url} 
                      onChange={(e) => handleImageChange(key, index, 'url', e.target.value)} 
                    />
                  </div>
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label>وصف الصورة (Alt Text)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      dir="ltr" 
                      value={img.alt} 
                      onChange={(e) => handleImageChange(key, index, 'alt', e.target.value)} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminStudio;
