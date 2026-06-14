import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save, Plus, Trash2 } from 'lucide-react';

const AdminPortfolio = () => {
  const { siteData, updateSection } = useData();
  const defaultCats = [
    { id: 'video', nameAr: 'إنتاج فيديو', nameEn: 'Video' },
    { id: 'design', nameAr: 'تصميم جرافيك', nameEn: 'Design' },
    { id: 'reels', nameAr: 'ريلز & تيك توك', nameEn: 'Reels' },
    { id: 'podcast', nameAr: 'بودكاست', nameEn: 'Podcast' },
    { id: 'web', nameAr: 'برمجة ويب', nameEn: 'Web' }
  ];

  const [portfolio, setPortfolio] = useState(siteData.portfolio || []);
  const [categories, setCategories] = useState(siteData.portfolioCategories || defaultCats);
  const [activeTab, setActiveTab] = useState(categories[0]?.id || 'video');
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (index, field, value) => {
    const updated = [...portfolio];
    updated[index] = { ...updated[index], [field]: value };
    setPortfolio(updated);
  };

  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('youtube.com/embed/')) return url;
    let videoId = '';
    try {
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      } else if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        videoId = urlParams.get('v');
      } else if (url.includes('youtube.com/shorts/')) {
        videoId = url.split('youtube.com/shorts/')[1]?.split('?')[0];
      }
    } catch(e) {}
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  const addItem = () => {
    setPortfolio([...portfolio, { id: Date.now(), title: '', titleEn: '', category: activeTab, imageUrl: '', embedUrl: '' }]);
  };

  const removeItem = (id) => {
    const updated = portfolio.filter(item => item.id !== id);
    setPortfolio(updated);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      updateSection('portfolio', portfolio);
      updateSection('portfolioCategories', categories);
      setIsSaving(false);
      alert('تم حفظ معرض الأعمال بنجاح!');
    }, 600);
  };

  const addCategory = () => {
    const newId = prompt('أدخل معرف التبويب (بالانجليزية وبدون مسافات، مثلا: photography):');
    if (!newId || categories.find(c => c.id === newId)) {
      if (newId) alert('هذا المعرف موجود بالفعل!');
      return;
    }
    const nameAr = prompt('أدخل اسم التبويب بالعربية (مثلا: تصوير فوتوغرافي):');
    const nameEn = prompt('أدخل اسم التبويب بالإنجليزية (مثلا: Photography):');
    if (nameAr && nameEn) {
      setCategories([...categories, { id: newId, nameAr, nameEn }]);
      setActiveTab(newId);
    }
  };

  const removeCategory = (id) => {
    if (confirm('هل أنت متأكد من حذف هذا التبويب؟ لن يتم حذف الأعمال المرتبطة به لكنها لن تظهر في أي تبويب مالم تغير تصنيفها.')) {
      const updated = categories.filter(c => c.id !== id);
      setCategories(updated);
      if (activeTab === id && updated.length > 0) setActiveTab(updated[0].id);
    }
  };

  const editCategory = (id) => {
    const categoryToEdit = categories.find(c => c.id === id);
    if (!categoryToEdit) return;
    
    const newNameAr = prompt('تعديل اسم التبويب بالعربية:', categoryToEdit.nameAr);
    if (newNameAr === null) return;
    
    const newNameEn = prompt('تعديل اسم التبويب بالإنجليزية:', categoryToEdit.nameEn);
    if (newNameEn === null) return;
    
    if (newNameAr && newNameEn) {
      const updated = categories.map(c => 
        c.id === id ? { ...c, nameAr: newNameAr, nameEn: newNameEn } : c
      );
      setCategories(updated);
    }
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

      <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px'}}>
        {categories.map(cat => (
          <div key={cat.id} style={{display: 'flex', alignItems: 'center', background: activeTab === cat.id ? 'var(--color-vibrant-purple)' : 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '5px 15px', cursor: 'pointer'}}>
            <span onClick={() => setActiveTab(cat.id)} style={{marginRight: '10px'}}>{cat.nameAr}</span>
            <button onClick={(e) => { e.stopPropagation(); editCategory(cat.id); }} style={{background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginRight: '5px', fontSize: '0.9rem'}} title="تعديل اسم التبويب">✎</button>
            <button onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }} style={{background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1.2rem'}} title="حذف التبويب">×</button>
          </div>
        ))}
        <button onClick={addCategory} className="btn-primary" style={{padding: '5px 15px', borderRadius: '8px', background: 'var(--color-cyan)', color: '#000'}}>+ إضافة تبويب</button>
      </div>

      <div className="admin-grid">
        {portfolio.map((item, index) => {
          if (item.category !== activeTab) return null;
          return (
          <div key={item.id} className="admin-card glass-panel" style={{position: 'relative'}}>
            <button 
              onClick={() => removeItem(item.id)}
              style={{position: 'absolute', top: '15px', left: '15px', background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff4d4d', padding: '8px', borderRadius: '50%', cursor: 'pointer', zIndex: 10}}
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
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nameAr}</option>
                ))}
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
              <label>رابط فيديو يوتيوب (عادي أو مضمن)</label>
              <input type="text" className="form-control" dir="ltr" placeholder="https://youtu.be/..." value={item.embedUrl || ''} onChange={e => handleChange(index, 'embedUrl', e.target.value)} />
            </div>
            
            {(item.imageUrl || item.embedUrl) && (
              <div style={{marginTop: '15px', borderRadius: '8px', overflow: 'hidden', height: '120px'}}>
                {item.embedUrl ? (
                  <iframe src={getEmbedUrl(item.embedUrl)} width="100%" height="100%" style={{border: 'none', pointerEvents: 'none'}}></iframe>
                ) : (
                  <img src={item.imageUrl} alt="preview" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                )}
              </div>
            )}
          </div>
          );
        })}

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
