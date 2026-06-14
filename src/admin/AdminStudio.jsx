import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save, Image as ImageIcon } from 'lucide-react';

const AdminStudio = () => {
  const { siteData, updateSection } = useData();
  const defaultCats = [
    { id: 'october', nameAr: 'استديو أكتوبر', nameEn: 'October Studio' },
    { id: 'lebanon', nameAr: 'استديو ميدان لبنان', nameEn: 'Lebanon Square Studio' },
    { id: 'newCairo', nameAr: 'استديو القاهرة الجديدة', nameEn: 'New Cairo Studio' }
  ];

  const [studios, setStudios] = useState(siteData.studio || { october: [], lebanon: [], newCairo: [] });
  const [categories, setCategories] = useState(siteData.studioCategories || defaultCats);
  const [activeTab, setActiveTab] = useState(categories[0]?.id || 'october');
  const [isSaving, setIsSaving] = useState(false);

  const handleImageChange = (imageIndex, field, value) => {
    const updated = { ...studios };
    updated[activeTab][imageIndex] = { ...updated[activeTab][imageIndex], [field]: value };
    setStudios(updated);
  };

  const addImage = () => {
    const updated = { ...studios };
    if (!updated[activeTab]) updated[activeTab] = [];
    updated[activeTab].push({ id: Date.now(), url: '', alt: '' });
    setStudios(updated);
  };

  const removeImage = (imageIndex) => {
    const updated = { ...studios };
    updated[activeTab] = updated[activeTab].filter((_, i) => i !== imageIndex);
    setStudios(updated);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      updateSection('studio', studios);
      updateSection('studioCategories', categories);
      setIsSaving(false);
      alert('تم حفظ بيانات الاستوديوهات بنجاح!');
    }, 600);
  };

  const addCategory = () => {
    const newId = prompt('أدخل معرف الاستديو (بالانجليزية وبدون مسافات، مثلا: maadi):');
    if (!newId || categories.find(c => c.id === newId)) {
      if (newId) alert('هذا المعرف موجود بالفعل!');
      return;
    }
    const nameAr = prompt('أدخل اسم الاستديو بالعربية (مثلا: استديو المعادي):');
    const nameEn = prompt('أدخل اسم الاستديو بالإنجليزية (مثلا: Maadi Studio):');
    if (nameAr && nameEn) {
      setCategories([...categories, { id: newId, nameAr, nameEn }]);
      const updatedStudios = { ...studios, [newId]: [] };
      setStudios(updatedStudios);
      setActiveTab(newId);
    }
  };

  const editCategory = (id) => {
    const categoryToEdit = categories.find(c => c.id === id);
    if (!categoryToEdit) return;
    
    const newNameAr = prompt('تعديل اسم الاستديو بالعربية:', categoryToEdit.nameAr);
    if (newNameAr === null) return;
    
    const newNameEn = prompt('تعديل اسم الاستديو بالإنجليزية:', categoryToEdit.nameEn);
    if (newNameEn === null) return;
    
    if (newNameAr && newNameEn) {
      const updated = categories.map(c => 
        c.id === id ? { ...c, nameAr: newNameAr, nameEn: newNameEn } : c
      );
      setCategories(updated);
    }
  };

  const removeCategory = (id) => {
    if (confirm('هل أنت متأكد من حذف هذا الاستديو وجميع صوره نهائياً؟')) {
      const updatedCats = categories.filter(c => c.id !== id);
      setCategories(updatedCats);
      const updatedStudios = { ...studios };
      delete updatedStudios[id];
      setStudios(updatedStudios);
      if (activeTab === id && updatedCats.length > 0) setActiveTab(updatedCats[0].id);
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

      <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px'}}>
        {categories.map(cat => (
          <div key={cat.id} style={{display: 'flex', alignItems: 'center', background: activeTab === cat.id ? 'var(--color-vibrant-purple)' : 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '5px 15px', cursor: 'pointer'}}>
            <span onClick={() => setActiveTab(cat.id)} style={{marginRight: '10px'}}>{cat.nameAr}</span>
            <button onClick={(e) => { e.stopPropagation(); editCategory(cat.id); }} style={{background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginRight: '5px', fontSize: '0.9rem'}} title="تعديل الاسم">✎</button>
            <button onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }} style={{background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1.2rem'}} title="حذف الاستديو">×</button>
          </div>
        ))}
        <button onClick={addCategory} className="btn-primary" style={{padding: '5px 15px', borderRadius: '8px', background: 'var(--color-cyan)', color: '#fff'}}>+ إضافة استديو</button>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '30px'}}>
        {activeTab && studios[activeTab] && (
          <div className="admin-card glass-panel">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
              <h3>{categories.find(c => c.id === activeTab)?.nameAr || activeTab}</h3>
              <button className="btn-primary" onClick={addImage} style={{padding: '5px 15px', fontSize: '0.9rem'}}>+ إضافة صورة</button>
            </div>
            <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
            
            <div className="admin-grid" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))'}}>
              {studios[activeTab].map((img, index) => (
                <div key={img.id || index} style={{background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', position: 'relative'}}>
                  <button 
                    onClick={() => removeImage(index)}
                    style={{position: 'absolute', top: '20px', left: '20px', background: 'rgba(255,0,0,0.8)', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', zIndex: 10}}
                    title="حذف الصورة"
                  >
                    حذف
                  </button>
                  <div style={{height: '120px', borderRadius: '8px', overflow: 'hidden', marginBottom: '15px'}}>
                    <img src={img.url || 'https://via.placeholder.com/800x600?text=No+Image'} alt={img.alt} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  </div>
                  
                  <div className="form-group">
                    <label>رابط الصورة (URL)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      dir="ltr" 
                      value={img.url} 
                      onChange={(e) => handleImageChange(index, 'url', e.target.value)} 
                    />
                  </div>
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label>وصف الصورة (Alt Text)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      dir="ltr" 
                      value={img.alt} 
                      onChange={(e) => handleImageChange(index, 'alt', e.target.value)} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStudio;
