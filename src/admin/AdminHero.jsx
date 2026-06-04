import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save } from 'lucide-react';

const AdminHero = () => {
  const { siteData, updateSection } = useData();
  const [heroData, setHeroData] = useState(siteData.hero);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setHeroData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      updateSection('hero', heroData);
      setIsSaving(false);
      alert('تم حفظ القسم الرئيسي بنجاح!');
    }, 600);
  };

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>القسم الرئيسي (Hero)</h2>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <Save size={18} />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div className="admin-card glass-panel">
        <h3>النسخة العربية</h3>
        <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
        
        <div className="form-group">
          <label>العنوان الأول الملون</label>
          <input type="text" className="form-control" value={heroData.title1} onChange={e => handleChange('title1', e.target.value)} />
        </div>
        <div className="form-group">
          <label>العنوان الثاني الأبيض</label>
          <input type="text" className="form-control" value={heroData.title2} onChange={e => handleChange('title2', e.target.value)} />
        </div>
        <div className="form-group">
          <label>النص الوصفي الفرعي</label>
          <textarea className="form-control" rows="2" value={heroData.subtitle} onChange={e => handleChange('subtitle', e.target.value)}></textarea>
        </div>
      </div>

      <div className="admin-card glass-panel" style={{marginTop: '30px'}}>
        <h3>النسخة الإنجليزية (English)</h3>
        <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
        
        <div className="form-group">
          <label>العنوان الأول الملون</label>
          <input type="text" className="form-control" dir="ltr" value={heroData.title1En} onChange={e => handleChange('title1En', e.target.value)} />
        </div>
        <div className="form-group">
          <label>العنوان الثاني الأبيض</label>
          <input type="text" className="form-control" dir="ltr" value={heroData.title2En} onChange={e => handleChange('title2En', e.target.value)} />
        </div>
        <div className="form-group">
          <label>النص الوصفي الفرعي</label>
          <textarea className="form-control" rows="2" dir="ltr" value={heroData.subtitleEn} onChange={e => handleChange('subtitleEn', e.target.value)}></textarea>
        </div>
      </div>
    </div>
  );
};

export default AdminHero;
