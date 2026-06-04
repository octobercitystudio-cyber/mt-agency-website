import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save } from 'lucide-react';

const AdminAbout = () => {
  const { siteData, updateSection } = useData();
  const [aboutData, setAboutData] = useState(siteData.about);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setAboutData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      updateSection('about', aboutData);
      setIsSaving(false);
      alert('تم حفظ قسم "من نحن" بنجاح!');
    }, 600);
  };

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>إدارة "من نحن" والإحصائيات</h2>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <Save size={18} />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div className="admin-grid">
        <div className="admin-card glass-panel">
          <h3>النص التعريفي</h3>
          <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
          
          <div className="form-group">
            <label>نبذة عن الشركة (عربي)</label>
            <textarea className="form-control" rows="5" value={aboutData.p1} onChange={e => handleChange('p1', e.target.value)}></textarea>
          </div>
          <div className="form-group">
            <label>نبذة عن الشركة (إنجليزي)</label>
            <textarea className="form-control" rows="5" dir="ltr" value={aboutData.p1En} onChange={e => handleChange('p1En', e.target.value)}></textarea>
          </div>
        </div>

        <div className="admin-card glass-panel">
          <h3>الإحصائيات والأرقام</h3>
          <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
          
          <div className="form-group">
            <label>سنوات الخبرة (Years Experience)</label>
            <input type="text" className="form-control" dir="ltr" value={aboutData.yearsOfExperience} onChange={e => handleChange('yearsOfExperience', e.target.value)} />
          </div>
          <div className="form-group">
            <label>المشاريع الناجحة (Successful Projects)</label>
            <input type="text" className="form-control" dir="ltr" value={aboutData.successfulProjects} onChange={e => handleChange('successfulProjects', e.target.value)} />
          </div>
          <div className="form-group">
            <label>الخبراء والمبدعين (Experts)</label>
            <input type="text" className="form-control" dir="ltr" value={aboutData.expertsCount} onChange={e => handleChange('expertsCount', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAbout;
