import React, { useState } from 'react';
import { Save, Lock } from 'lucide-react';
import { useData } from '../store/DataContext';
import { supabase } from '../supabaseClient';

const AdminSettings = () => {
  const { siteData, updateSection } = useData();
  const [adminPassword, setAdminPassword] = useState('');
  
  const [footerDescAr, setFooterDescAr] = useState(siteData?.footer?.descAr || 'إم تي إيجنسي متخصصة في الإنتاج الإعلامي والتسويق الرقمي وصناعة محتوى مرئي يخطف الأنظار ويصنع تأثيراً حقيقياً لأعمالك.');
  const [footerDescEn, setFooterDescEn] = useState(siteData?.footer?.descEn || 'MT Agency specializes in media production, digital marketing, and creating visually stunning content that drives real impact for your business.');
  const [footerCopyAr, setFooterCopyAr] = useState(siteData?.footer?.copyrightAr || 'MT Agency. جميع الحقوق محفوظة.');
  const [footerCopyEn, setFooterCopyEn] = useState(siteData?.footer?.copyrightEn || 'MT Agency. All Rights Reserved.');
  
  const [receivingEmail, setReceivingEmail] = useState(siteData?.formSettings?.receivingEmail || 'octobercitystudio@gmail.com');
  
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!adminPassword || adminPassword.length < 6) {
      alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: adminPassword });
    if (error) {
      alert("حدث خطأ أثناء تغيير كلمة المرور: " + error.message);
    } else {
      showSuccess();
      setAdminPassword('');
    }
  };

  const handleSaveFooter = async (e) => {
    e.preventDefault();
    const success = await updateSection('footer', {
      descAr: footerDescAr,
      descEn: footerDescEn,
      copyrightAr: footerCopyAr,
      copyrightEn: footerCopyEn
    });
    if(success) showSuccess();
  };

  const handleSaveForms = async (e) => {
    e.preventDefault();
    const success = await updateSection('formSettings', { receivingEmail });
    if(success) showSuccess();
  };

  const showSuccess = () => {
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 3000);
  };

  return (
    <div className="admin-section">
      <div className="admin-header">
        <div>
          <h2>الإعدادات العامة</h2>
          <p>إدارة إعدادات الموقع وبيانات الدخول للوحة التحكم</p>
        </div>
      </div>

      <div className="admin-card">
        <h3>تغيير كلمة المرور</h3>
        <p style={{color: '#8c8c8c', marginBottom: '20px'}}>يمكنك هنا تغيير كلمة المرور الموحدة الخاصة بك (للدخول للموقع ونظام إدارة الشركة).</p>
        
        <form onSubmit={handleSavePassword} style={{maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>كلمة المرور الجديدة</label>
            <div style={{position: 'relative'}}>
              <Lock size={18} style={{position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c'}} />
              <input
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="admin-input"
                style={{paddingRight: '45px'}}
                dir="ltr"
                required
                minLength={6}
              />
            </div>
          </div>
          
          <button type="submit" className="btn-primary" style={{marginTop: '10px'}}>
            تحديث كلمة المرور
          </button>
        </form>

        {showSavedMsg && (
          <div style={{marginTop: '20px', padding: '15px', background: 'rgba(0, 255, 0, 0.1)', border: '1px solid #00ff00', color: '#00ff00', borderRadius: '8px', textAlign: 'center'}}>
            تم الحفظ بنجاح!
          </div>
        )}
      </div>

      <div className="admin-card mt-4" style={{marginTop: '20px'}}>
        <h3>تعديل معلومات الفوتر (تذييل الموقع)</h3>
        <p style={{color: '#8c8c8c', marginBottom: '20px'}}>يمكنك تعديل الوصف النصي وحقوق النشر التي تظهر في أسفل كل صفحة.</p>
        
        <form onSubmit={handleSaveFooter} style={{maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>الوصف باللغة العربية</label>
            <textarea
              value={footerDescAr}
              onChange={(e) => setFooterDescAr(e.target.value)}
              className="admin-input"
              style={{minHeight: '80px', resize: 'vertical'}}
              required
            />
          </div>
          
          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>الوصف باللغة الإنجليزية</label>
            <textarea
              value={footerDescEn}
              onChange={(e) => setFooterDescEn(e.target.value)}
              className="admin-input"
              style={{minHeight: '80px', resize: 'vertical'}}
              dir="ltr"
              required
            />
          </div>

          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>حقوق النشر (عربي)</label>
            <input
              type="text"
              value={footerCopyAr}
              onChange={(e) => setFooterCopyAr(e.target.value)}
              className="admin-input"
              required
            />
          </div>

          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>حقوق النشر (إنجليزي)</label>
            <input
              type="text"
              value={footerCopyEn}
              onChange={(e) => setFooterCopyEn(e.target.value)}
              className="admin-input"
              dir="ltr"
              required
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{marginTop: '10px', background: 'var(--color-cyan)', color: '#000'}}>
            <Save size={18} style={{marginRight: '8px', display: 'inline-block'}} />
            حفظ إعدادات الفوتر
          </button>
        </form>
      </div>

      <div className="admin-card mt-4" style={{marginTop: '20px'}}>
        <h3>إعدادات استقبال الرسائل</h3>
        <p style={{color: '#8c8c8c', marginBottom: '20px'}}>حدد البريد الإلكتروني الذي ترغب في استلام رسائل نموذج (تواصل معنا) عليه.</p>
        
        <form onSubmit={handleSaveForms} style={{maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>البريد الإلكتروني المستلم</label>
            <input
              type="email"
              value={receivingEmail}
              onChange={(e) => setReceivingEmail(e.target.value)}
              className="admin-input"
              dir="ltr"
              required
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{marginTop: '10px'}}>
            <Save size={18} style={{marginRight: '8px', display: 'inline-block'}} />
            حفظ بريد الاستقبال
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminSettings;
