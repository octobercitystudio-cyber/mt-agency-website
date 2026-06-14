import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save, Lock, User } from 'lucide-react';

const AdminSettings = () => {
  const { siteData, updateSection } = useData();
  const [username, setUsername] = useState(siteData?.adminCredentials?.username || '');
  const [password, setPassword] = useState(siteData?.adminCredentials?.password || '');
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    updateSection('adminCredentials', { username, password });
    
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
        <button className="btn-primary" onClick={handleSave}>
          <Save size={18} />
          حفظ التغييرات
        </button>
      </div>

      <div className="admin-card">
        <h3>تغيير بيانات الدخول لتعديل الموقع</h3>
        <p style={{color: '#8c8c8c', marginBottom: '20px'}}>يمكنك هنا تغيير اسم المستخدم وكلمة المرور الخاصة بلوحة تحكم الموقع فقط (الموجودة على الرابط /adminmt).</p>
        
        <form onSubmit={handleSave} style={{maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>اسم المستخدم الجديد</label>
            <div style={{position: 'relative'}}>
              <User size={18} style={{position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c'}} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="admin-input"
                style={{paddingRight: '45px'}}
                dir="ltr"
                required
              />
            </div>
          </div>
          
          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>كلمة المرور الجديدة</label>
            <div style={{position: 'relative'}}>
              <Lock size={18} style={{position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c'}} />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-input"
                style={{paddingRight: '45px'}}
                dir="ltr"
                required
              />
            </div>
          </div>
          
          <button type="submit" className="btn-primary" style={{marginTop: '10px'}}>
            تحديث بيانات الدخول
          </button>
        </form>

        {showSavedMsg && (
          <div style={{marginTop: '20px', padding: '15px', background: 'rgba(0, 255, 0, 0.1)', border: '1px solid #00ff00', color: '#00ff00', borderRadius: '8px', textAlign: 'center'}}>
            تم حفظ بيانات الدخول بنجاح! يرجى استخدامها في المرة القادمة.
          </div>
        )}
      </div>

      <div className="admin-card mt-4" style={{marginTop: '20px'}}>
        <h3>بيانات الدخول لإدارة الشركة (ERP)</h3>
        <p style={{color: '#8c8c8c', marginBottom: '10px'}}>تستخدم هذه البيانات للدخول إلى نظام الإدارة (العملاء، المواعيد، الحسابات) من خلال صفحة /login.</p>
        <div style={{background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)'}}>
          <div style={{marginBottom: '10px'}}><strong style={{color: 'var(--color-vibrant-purple)'}}>اسم المستخدم:</strong> <span dir="ltr">octobercitystudio@gmail.com</span></div>
          <div><strong style={{color: 'var(--color-vibrant-purple)'}}>كلمة المرور:</strong> <span dir="ltr">Octcitystd@2019</span></div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
