import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Save, Lock, User } from 'lucide-react';

const AdminSettings = () => {
  const { siteData, updateSection } = useData();
  const [username, setUsername] = useState(siteData?.adminCredentials?.username || '');
  const [password, setPassword] = useState(siteData?.adminCredentials?.password || '');
  const [erpUsername, setErpUsername] = useState(siteData?.erpCredentials?.username || 'octobercitystudio@gmail.com');
  const [erpPassword, setErpPassword] = useState(siteData?.erpCredentials?.password || 'Octcitystd@2019');
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const handleSaveAdmin = (e) => {
    e.preventDefault();
    updateSection('adminCredentials', { username, password });
    showSuccess();
  };

  const handleSaveErp = (e) => {
    e.preventDefault();
    updateSection('erpCredentials', { username: erpUsername, password: erpPassword });
    showSuccess();
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
        <button className="btn-primary" onClick={handleSaveAdmin}>
          <Save size={18} />
          حفظ التغييرات
        </button>
      </div>

      <div className="admin-card">
        <h3>تغيير بيانات الدخول لتعديل الموقع</h3>
        <p style={{color: '#8c8c8c', marginBottom: '20px'}}>يمكنك هنا تغيير اسم المستخدم وكلمة المرور الخاصة بلوحة تحكم الموقع فقط (الموجودة على الرابط /adminmt).</p>
        
        <form onSubmit={handleSaveAdmin} style={{maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
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
        <h3>تغيير بيانات الدخول لبرنامج الشركة (ERP)</h3>
        <p style={{color: '#8c8c8c', marginBottom: '20px'}}>تستخدم هذه البيانات للدخول إلى نظام الإدارة (العملاء، المواعيد، الحسابات) من خلال صفحة /login.</p>
        
        <form onSubmit={handleSaveErp} style={{maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>اسم المستخدم لنظام الشركة</label>
            <div style={{position: 'relative'}}>
              <User size={18} style={{position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c'}} />
              <input
                type="text"
                value={erpUsername}
                onChange={(e) => setErpUsername(e.target.value)}
                className="admin-input"
                style={{paddingRight: '45px'}}
                dir="ltr"
                required
              />
            </div>
          </div>
          
          <div>
            <label style={{display: 'block', marginBottom: '8px', color: '#fff'}}>كلمة المرور لنظام الشركة</label>
            <div style={{position: 'relative'}}>
              <Lock size={18} style={{position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c'}} />
              <input
                type="text"
                value={erpPassword}
                onChange={(e) => setErpPassword(e.target.value)}
                className="admin-input"
                style={{paddingRight: '45px'}}
                dir="ltr"
                required
              />
            </div>
          </div>
          
          <button type="submit" className="btn-primary" style={{marginTop: '10px', background: 'var(--color-vibrant-purple)'}}>
            تحديث بيانات نظام الشركة
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminSettings;
