import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save, Plus, Trash2 } from 'lucide-react';

const AdminPortfolio = () => {
  const { siteData, updateSection } = useData();
  const [portfolio, setPortfolio] = useState(siteData.portfolio);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (index, field, value) => {
    const updated = [...portfolio];
    updated[index] = { ...updated[index], [field]: value };
    setPortfolio(updated);
  };

  const addItem = () => {
    setPortfolio([...portfolio, { id: Date.now(), title: '', titleEn: '', category: 'video', imageUrl: '', embedUrl: '' }]);
  };

  const removeItem = (index) => {
    const updated = portfolio.filter((_, i) => i !== index);
    setPortfolio(updated);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      updateSection('portfolio', portfolio);
      setIsSaving(false);
      alert('تم حفظ معرض الأعمال بنجاح!');
    }, 600);
  };

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>إدارة معرض الأعمال</h2>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <Save size={18} />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div className="admin-grid">
        {portfolio.map((item, index) => (
          <div key={item.id} className="admin-card glass-panel" style={{position: 'relative'}}>
            <button 
              onClick={() => removeItem(index)}
              style={{position: 'absolute', top: '15px', left: '15px', background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff4d4d', padding: '8px', borderRadius: '50%', cursor: 'pointer'}}
              title="حذف العمل"
            >
              <Trash2 size={16} />
            </button>

            <div className="form-group">
              <label>التصنيف</label>
              <select 
                className="form-control" 
                value={item.category} 
                onChange={(e) => handleChange(index, 'category', e.target.value)}
                style={{backgroundColor: 'rgba(0,0,0,0.5)'}}
              >
                <option value="video">فيديو</option>
                <option value="design">تصميم</option>
                <option value="reels">ريلز</option>
                <option value="podcast">بودكاست</option>
              </select>
            </div>

            <div className="form-group">
              <label>عنوان العمل (عربي)</label>
              <input type="text" className="form-control" value={item.title} onChange={e => handleChange(index, 'title', e.target.value)} />
            </div>

            <div className="form-group">
              <label>عنوان العمل (إنجليزي)</label>
              <input type="text" className="form-control" dir="ltr" value={item.titleEn} onChange={e => handleChange(index, 'titleEn', e.target.value)} />
            </div>

            <div className="form-group">
              <label>رابط الصورة (إن وجد)</label>
              <input type="text" className="form-control" dir="ltr" placeholder="https://..." value={item.imageUrl || ''} onChange={e => handleChange(index, 'imageUrl', e.target.value)} />
            </div>

            <div className="form-group">
              <label>رابط فيديو يوتيوب المضمن (Embed URL)</label>
              <input type="text" className="form-control" dir="ltr" placeholder="https://www.youtube.com/embed/..." value={item.embedUrl || ''} onChange={e => handleChange(index, 'embedUrl', e.target.value)} />
            </div>
            
            {(item.imageUrl || item.embedUrl) && (
              <div style={{marginTop: '15px', borderRadius: '8px', overflow: 'hidden', height: '120px'}}>
                {item.embedUrl ? (
                  <iframe src={item.embedUrl} width="100%" height="100%" style={{border: 'none', pointerEvents: 'none'}}></iframe>
                ) : (
                  <img src={item.imageUrl} alt="preview" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                )}
              </div>
            )}
          </div>
        ))}

        <div 
          className="admin-card glass-panel" 
          style={{display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: '300px', borderStyle: 'dashed'}}
          onClick={addItem}
        >
          <div style={{textAlign: 'center', color: 'var(--color-silver)'}}>
            <Plus size={40} style={{marginBottom: '10px'}} />
            <h3>إضافة عمل جديد</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortfolio;
