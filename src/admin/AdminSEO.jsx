import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { Save } from 'lucide-react';

const AdminSEO = () => {
  const { siteData, updateSection } = useData();
  
  // Default structure to prevent undefined errors
  const defaultSeo = {
    global: { siteName: '', siteNameEn: '', defaultImage: '' },
    home: { titleAr: '', titleEn: '', descAr: '', descEn: '', keywordsAr: '', keywordsEn: '' },
    about: { titleAr: '', titleEn: '', descAr: '', descEn: '', keywordsAr: '', keywordsEn: '' },
    services: { titleAr: '', titleEn: '', descAr: '', descEn: '', keywordsAr: '', keywordsEn: '' },
    portfolio: { titleAr: '', titleEn: '', descAr: '', descEn: '', keywordsAr: '', keywordsEn: '' },
    studio: { titleAr: '', titleEn: '', descAr: '', descEn: '', keywordsAr: '', keywordsEn: '' }
  };

  const [seoData, setSeoData] = useState(() => {
    const existingSeo = siteData?.seo || {};
    return {
      global: { ...defaultSeo.global, ...(existingSeo.global || {}) },
      home: { ...defaultSeo.home, ...(existingSeo.home || {}) },
      about: { ...defaultSeo.about, ...(existingSeo.about || {}) },
      services: { ...defaultSeo.services, ...(existingSeo.services || {}) },
      portfolio: { ...defaultSeo.portfolio, ...(existingSeo.portfolio || {}) },
      studio: { ...defaultSeo.studio, ...(existingSeo.studio || {}) }
    };
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'global', 'home', 'about', 'services', 'portfolio', 'studio'

  useEffect(() => {
    if (siteData && siteData.seo) {
      setSeoData(prev => {
        const existingSeo = siteData.seo;
        return {
          global: { ...prev.global, ...(existingSeo.global || {}) },
          home: { ...prev.home, ...(existingSeo.home || {}) },
          about: { ...prev.about, ...(existingSeo.about || {}) },
          services: { ...prev.services, ...(existingSeo.services || {}) },
          portfolio: { ...prev.portfolio, ...(existingSeo.portfolio || {}) },
          studio: { ...prev.studio, ...(existingSeo.studio || {}) }
        };
      });
    }
  }, [siteData]);

  const handleChange = (section, field, value) => {
    setSeoData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateSection('seo', seoData);
    setIsSaving(false);
    if (success) {
      alert('تم حفظ إعدادات الـ SEO بنجاح!');
    }
  };

  const sections = [
    { id: 'global', name: 'البيانات العامة' },
    { id: 'home', name: 'الرئيسية (Home)' },
    { id: 'about', name: 'من نحن (About)' },
    { id: 'services', name: 'الخدمات (Services)' },
    { id: 'portfolio', name: 'الأعمال (Portfolio)' },
    { id: 'studio', name: 'الاستوديو (Studio)' }
  ];

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px'}}>
        <h2>إعدادات تحسين محركات البحث (SEO)</h2>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <Save size={18} />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div style={{display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap'}}>
        {sections.map(sec => (
          <button 
            key={sec.id} 
            onClick={() => setActiveTab(sec.id)}
            style={{
              background: activeTab === sec.id ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
              border: activeTab === sec.id ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.1)',
              padding: '10px 20px',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: activeTab === sec.id ? 'bold' : 'normal',
              transition: 'all 0.3s ease'
            }}
          >
            {sec.name}
          </button>
        ))}
      </div>

      {activeTab === 'global' && (
        <div className="admin-card glass-panel animate__animated animate__fadeIn">
          <h3>الإعدادات العامة (تطبق على الموقع بالكامل)</h3>
          <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
          
          <div className="form-group">
            <label>اسم الموقع (يظهر بجانب العنوان)</label>
            <input type="text" className="form-control" value={seoData.global.siteName} onChange={e => handleChange('global', 'siteName', e.target.value)} />
          </div>
          <div className="form-group">
            <label>اسم الموقع (باللغة الإنجليزية)</label>
            <input type="text" className="form-control" dir="ltr" value={seoData.global.siteNameEn} onChange={e => handleChange('global', 'siteNameEn', e.target.value)} />
          </div>
          <div className="form-group">
            <label>صورة المشاركة الافتراضية (Open Graph Image)</label>
            <input type="url" className="form-control" dir="ltr" placeholder="https://example.com/logo.png" value={seoData.global.defaultImage} onChange={e => handleChange('global', 'defaultImage', e.target.value)} />
            <small style={{color: 'rgba(255,255,255,0.6)', marginTop: '5px', display: 'block'}}>هذه هي الصورة التي ستظهر عند مشاركة الرابط على السوشيال ميديا.</small>
          </div>
        </div>
      )}

      {activeTab !== 'global' && (
        <div className="animate__animated animate__fadeIn">
          <div className="admin-card glass-panel">
            <h3>النسخة العربية ({sections.find(s => s.id === activeTab).name})</h3>
            <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
            
            <div className="form-group">
              <label>العنوان (Title)</label>
              <input type="text" className="form-control" value={seoData[activeTab].titleAr} onChange={e => handleChange(activeTab, 'titleAr', e.target.value)} />
              <small style={{color: 'rgba(255,255,255,0.6)', marginTop: '5px', display: 'block'}}>مثال: إم تي إيجنسي | من نحن</small>
            </div>
            <div className="form-group">
              <label>الوصف المُختصر (Meta Description)</label>
              <textarea className="form-control" rows="3" value={seoData[activeTab].descAr} onChange={e => handleChange(activeTab, 'descAr', e.target.value)}></textarea>
              <small style={{color: 'rgba(255,255,255,0.6)', marginTop: '5px', display: 'block'}}>يُنصح بألا يتجاوز 160 حرفاً.</small>
            </div>
            <div className="form-group">
              <label>الكلمات المفتاحية (Keywords)</label>
              <input type="text" className="form-control" placeholder="مثال: تسويق، انتاج مرئي، تصميم" value={seoData[activeTab].keywordsAr} onChange={e => handleChange(activeTab, 'keywordsAr', e.target.value)} />
            </div>
          </div>

          <div className="admin-card glass-panel" style={{marginTop: '30px'}}>
            <h3>النسخة الإنجليزية (English)</h3>
            <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
            
            <div className="form-group">
              <label>Title</label>
              <input type="text" className="form-control" dir="ltr" value={seoData[activeTab].titleEn} onChange={e => handleChange(activeTab, 'titleEn', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" rows="3" dir="ltr" value={seoData[activeTab].descEn} onChange={e => handleChange(activeTab, 'descEn', e.target.value)}></textarea>
            </div>
            <div className="form-group">
              <label>Keywords</label>
              <input type="text" className="form-control" dir="ltr" value={seoData[activeTab].keywordsEn} onChange={e => handleChange(activeTab, 'keywordsEn', e.target.value)} />
            </div>
          </div>

          <div className="admin-card glass-panel" style={{marginTop: '30px'}}>
            <h3>معاينة جوجل (Google Live Preview)</h3>
            <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
            <p style={{color: 'rgba(255,255,255,0.6)', fontSize: '14px'}}>هكذا سيظهر موقعك في نتائج بحث جوجل عند البحث عن هذا القسم.</p>
            
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '20px'}}>
              {/* Arabic Preview */}
              <div style={{flex: '1', minWidth: '300px', background: 'rgba(32, 33, 36, 0.6)', padding: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)'}} dir="rtl">
                <span style={{color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '10px', display: 'block'}}>النسخة العربية</span>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                  <div style={{width: '28px', height: '28px', background: '#303134', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <span style={{color: '#bdc1c6', fontSize: '14px'}}>M</span>
                  </div>
                  <div>
                    <div style={{color: '#dadce0', fontSize: '14px'}}>{seoData.global.siteName || 'MT Agency'}</div>
                    <span style={{color: '#bdc1c6', fontSize: '12px'}}>https://multitaskagency.com</span>
                  </div>
                </div>
                <h3 style={{color: '#8ab4f8', fontSize: '20px', margin: '0 0 5px 0', fontWeight: '400'}}>{seoData[activeTab].titleAr || 'عنوان الصفحة'}</h3>
                <p style={{color: '#bdc1c6', fontSize: '14px', margin: '0', lineHeight: '1.6'}}>{seoData[activeTab].descAr || 'الوصف المختصر للصفحة سيظهر هنا.'}</p>
              </div>

              {/* English Preview */}
              <div style={{flex: '1', minWidth: '300px', background: 'rgba(32, 33, 36, 0.6)', padding: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)'}} dir="ltr">
                <span style={{color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '10px', display: 'block'}}>English Version</span>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                  <div style={{width: '28px', height: '28px', background: '#303134', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <span style={{color: '#bdc1c6', fontSize: '14px'}}>M</span>
                  </div>
                  <div>
                    <div style={{color: '#dadce0', fontSize: '14px'}}>{seoData.global.siteNameEn || 'MT Agency'}</div>
                    <span style={{color: '#bdc1c6', fontSize: '12px'}}>https://multitaskagency.com</span>
                  </div>
                </div>
                <h3 style={{color: '#8ab4f8', fontSize: '20px', margin: '0 0 5px 0', fontWeight: '400'}}>{seoData[activeTab].titleEn || 'Page Title'}</h3>
                <p style={{color: '#bdc1c6', fontSize: '14px', margin: '0', lineHeight: '1.6'}}>{seoData[activeTab].descEn || 'The meta description will appear here.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSEO;
