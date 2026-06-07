import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { supabase } from '../supabaseClient';
import { Shield, User } from 'lucide-react';
import './UnifiedLogin.css';

const UnifiedLogin = () => {
  const [loginType, setLoginType] = useState('teacher'); // 'teacher' or 'admin'
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useData();
  const navigate = useNavigate();

  const handleTeacherLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .or(`phone1.eq.${phone},phone2.eq.${phone}`)
        .single();

      if (clientError || !clientData) {
        setError('رقم الهاتف غير مسجل لدينا. يرجى التأكد من الرقم.');
        setLoading(false);
        return;
      }

      localStorage.setItem('mt_client_phone', phone);
      navigate('/dashboard');
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم.');
    }
    setLoading(false);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (login(username, password)) {
      navigate('/adminmt');
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="unified-login-container">
      <div className="unified-login-box premium-glass">
        <div className="brand-logo" style={{textAlign: 'center', fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem'}}>
          MT <span style={{color: 'var(--color-vibrant-purple)'}}>Agency</span>
        </div>
        
        <div className="login-tabs">
          <button 
            className={`login-tab ${loginType === 'teacher' ? 'active' : ''}`}
            onClick={() => { setLoginType('teacher'); setError(''); }}
          >
            <User size={18} /> دخول المعلمين
          </button>
          <button 
            className={`login-tab ${loginType === 'admin' ? 'active' : ''}`}
            onClick={() => { setLoginType('admin'); setError(''); }}
          >
            <Shield size={18} /> دخول الإدارة
          </button>
        </div>

        <div className="login-form-container">
          {loginType === 'teacher' ? (
            <form onSubmit={handleTeacherLogin}>
              <h3 style={{color: '#fff', marginBottom: '0.5rem', textAlign: 'center'}}>بوابة المعلمين 🎓</h3>
              <p style={{color: '#8c8c8c', marginBottom: '2rem', textAlign: 'center'}}>أدخل رقم الهاتف للوصول للوحة التحكم الخاصة بك لمتابعة باقتك ومواعيدك</p>
              
              <input 
                type="tel" 
                placeholder="رقم الهاتف المسجل..." 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                dir="ltr"
                className="unified-input"
              />
              {error && <p className="error-msg">{error}</p>}
              <button type="submit" className="btn-modern-primary w-100" disabled={loading}>
                {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin}>
              <h3 style={{color: '#fff', marginBottom: '0.5rem', textAlign: 'center'}}>بوابة الإدارة ⚙️</h3>
              <p style={{color: '#8c8c8c', marginBottom: '2rem', textAlign: 'center'}}>أدخل بيانات الاعتماد للوصول إلى لوحة تحكم الموقع الشاملة</p>
              
              <input
                type="text"
                placeholder="اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                dir="ltr"
                className="unified-input"
              />
              <input
                type="password"
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                className="unified-input"
              />
              {error && <p className="error-msg">{error}</p>}
              <button type="submit" className="btn-modern-primary w-100">
                دخول الإدارة
              </button>
            </form>
          )}
        </div>

        <a href="/" className="back-link">العودة للموقع الرئيسي</a>
      </div>
    </div>
  );
};

export default UnifiedLogin;
