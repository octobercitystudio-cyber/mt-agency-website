import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { Search, Globe, Save, Image as ImageIcon } from 'lucide-react';

const ERPSEO = () => {
  const { siteData, updateSection } = useData();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('ar'); // 'ar' or 'en'
  const [seoForm, setSeoForm] = useState({
    siteName: "MT Agency",
    siteNameEn: "MT Agency",
    titleAr: "إم تي إيجنسي | نصنع التأثير",
    titleEn: "MT Agency | We Drive Impact",
    descAr: "إم تي إيجنسي متخصصة في الإنتاج الإعلامي، التسويق الرقمي، وصناعة محتوى مرئي يخطف الأنظار.",
    descEn: "MT Agency specializes in media production, digital marketing, and creating eye-catching visual content.",
    keywordsAr: "إنتاج إعلامي, تسويق رقمي, تصوير فيديو",
    keywordsEn: "media production, digital marketing",
    socialImage: ""
  });

  useEffect(() => {
    if (siteData && siteData.seo) {
      setSeoForm(prev => ({ ...prev, ...siteData.seo }));
    }
  }, [siteData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSeoForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await updateSection('seo', seoForm);
    if (success) {
      alert("تم حفظ إعدادات الـ SEO بنجاح!");
    }
    setIsSaving(false);
  };

  return (
    <div className="container-fluid p-0 animate__animated animate__fadeIn pb-5" style={{ background: '#f8f9fc', minHeight: '100vh', padding: '20px' }}>
      <style>{`
        .seo-card { background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); padding: 30px; margin-bottom: 30px; border: 1px solid #f1f5f9; }
        .google-preview { font-family: arial, sans-serif; background: #fff; padding: 20px; border-radius: 10px; border: 1px solid #dfe1e5; max-width: 600px; }
        .google-url { color: #202124; font-size: 14px; margin-bottom: 5px; display: flex; align-items: center; gap: 8px; }
        .google-url span { color: #5f6368; font-size: 12px; }
        .google-title { color: #1a0dab; font-size: 20px; line-height: 1.3; margin: 0 0 3px 0; font-weight: 400; cursor: pointer; }
        .google-title:hover { text-decoration: underline; }
        .google-desc { color: #4d5156; font-size: 14px; line-height: 1.58; word-wrap: break-word; margin: 0; }
        .nav-pills .nav-link { color: #64748b; border-radius: 8px; padding: 10px 20px; font-weight: bold; margin-bottom: 10px; }
        .nav-pills .nav-link.active { background-color: #4318ff; color: white; box-shadow: 0 4px 15px rgba(67,24,255,0.2); }
        .form-label { font-weight: 600; color: #334155; font-size: 0.9rem; }
        .form-control { border-radius: 8px; border: 1px solid #cbd5e1; padding: 12px 15px; }
        .form-control:focus { border-color: #4318ff; box-shadow: 0 0 0 0.25rem rgba(67, 24, 255, 0.1); }
      `}</style>

      <div className="mb-4">
        <h3 className="fw-bold text-dark m-0"><Search className="text-primary me-2 d-inline-block" /> إعدادات تحسين محركات البحث (SEO)</h3>
        <p className="text-muted small mt-1">تحكم في ظهور موقعك على محركات البحث ومنصات التواصل الاجتماعي.</p>
      </div>

      <div className="row">
        <div className="col-lg-8">
          <div className="seo-card">
            <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
              <h5 className="fw-bold m-0" style={{ color: '#1e293b' }}>البيانات الأساسية</h5>
              <div className="nav nav-pills" role="tablist">
                <button type="button" className={`nav-link ${activeTab === 'ar' ? 'active' : ''} ms-2`} onClick={() => setActiveTab('ar')}>العربية</button>
                <button type="button" className={`nav-link ${activeTab === 'en' ? 'active' : ''}`} onClick={() => setActiveTab('en')}>English</button>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="row mb-4">
                <div className="col-md-6 mb-3">
                  <label className="form-label">اسم الموقع {activeTab === 'ar' ? '(بالعربية)' : '(English)'}</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    name={activeTab === 'ar' ? 'siteName' : 'siteNameEn'}
                    value={activeTab === 'ar' ? seoForm.siteName : seoForm.siteNameEn} 
                    onChange={handleInputChange} 
                    dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                    required
                  />
                  <small className="text-muted">يظهر كجزء من عنوان الصفحة في المتصفح.</small>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">العنوان الرئيسي {activeTab === 'ar' ? '(بالعربية)' : '(English)'}</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    name={activeTab === 'ar' ? 'titleAr' : 'titleEn'}
                    value={activeTab === 'ar' ? seoForm.titleAr : seoForm.titleEn} 
                    onChange={handleInputChange}
                    dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                    required
                  />
                  <small className="text-muted">العنوان الجذاب الذي يظهر للمستخدم في نتائج البحث.</small>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">الوصف المُختصر (Meta Description) {activeTab === 'ar' ? '(بالعربية)' : '(English)'}</label>
                <textarea 
                  className="form-control" 
                  rows="3" 
                  name={activeTab === 'ar' ? 'descAr' : 'descEn'}
                  value={activeTab === 'ar' ? seoForm.descAr : seoForm.descEn} 
                  onChange={handleInputChange}
                  dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                  required
                ></textarea>
                <small className={`text-${(activeTab === 'ar' ? seoForm.descAr.length : seoForm.descEn.length) > 160 ? 'danger' : 'muted'}`}>
                  عدد الأحرف: {activeTab === 'ar' ? seoForm.descAr.length : seoForm.descEn.length} / 160 (يُنصح ألا يتجاوز 160 حرفاً لظهور أفضل في جوجل).
                </small>
              </div>

              <div className="mb-4">
                <label className="form-label">الكلمات المفتاحية (Keywords) {activeTab === 'ar' ? '(بالعربية)' : '(English)'}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name={activeTab === 'ar' ? 'keywordsAr' : 'keywordsEn'}
                  value={activeTab === 'ar' ? seoForm.keywordsAr : seoForm.keywordsEn} 
                  onChange={handleInputChange}
                  dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                  placeholder="مثال: تسويق، برمجة، فيديو"
                />
                <small className="text-muted">افصل بين الكلمات بفاصلة (،)</small>
              </div>

              <hr className="my-4" />
              <h5 className="fw-bold mb-3" style={{ color: '#1e293b' }}><ImageIcon size={20} className="me-2 text-primary d-inline-block" /> إعدادات السوشيال ميديا</h5>
              
              <div className="mb-4">
                <label className="form-label">رابط صورة المشاركة (Open Graph Image)</label>
                <input 
                  type="url" 
                  className="form-control" 
                  name="socialImage"
                  value={seoForm.socialImage} 
                  onChange={handleInputChange}
                  placeholder="https://example.com/image.jpg"
                  dir="ltr"
                />
                <small className="text-muted">الصورة التي ستظهر عند مشاركة رابط موقعك على واتساب، فيسبوك، وتويتر.</small>
              </div>

              <button type="submit" className="btn btn-primary px-5 py-2 fw-bold" disabled={isSaving} style={{ background: '#4318ff', border: 'none', borderRadius: '8px' }}>
                {isSaving ? <><i className="fas fa-spinner fa-spin me-2"></i> جاري الحفظ...</> : <><Save size={18} className="me-2 d-inline-block" /> حفظ الإعدادات</>}
              </button>
            </form>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="seo-card position-sticky" style={{ top: '20px' }}>
            <h5 className="fw-bold mb-4" style={{ color: '#1e293b' }}><Globe className="text-success me-2 d-inline-block" /> معاينة جوجل (Live Preview)</h5>
            
            <div className="google-preview mb-4" dir={activeTab === 'ar' ? 'rtl' : 'ltr'}>
              <div className="google-url">
                <div style={{width: '28px', height: '28px', background: '#f1f3f4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Globe size={16} color="#5f6368" />
                </div>
                <div>
                  <div style={{color: '#202124', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px'}}>{activeTab === 'ar' ? seoForm.siteName : seoForm.siteNameEn}</div>
                  <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px', display: 'block'}}>https://multitaskagency.com</span>
                </div>
              </div>
              <h3 className="google-title">{activeTab === 'ar' ? seoForm.titleAr : seoForm.titleEn}</h3>
              <p className="google-desc">{activeTab === 'ar' ? seoForm.descAr : seoForm.descEn}</p>
            </div>

            <div className="alert alert-info border-0 bg-light" style={{ borderRadius: '10px' }}>
              <h6 className="fw-bold text-primary mb-2"><i className="fas fa-info-circle me-1"></i> ملاحظة هامة:</h6>
              <p className="mb-0 text-muted" style={{ fontSize: '0.85rem' }}>محركات البحث مثل جوجل قد تأخذ بضعة أيام أو أسابيع لتحديث بيانات موقعك في نتائج البحث الفعّالة، حتى بعد حفظك للإعدادات هنا.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ERPSEO;
