import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { Lock, User } from 'lucide-react';
import './UnifiedLogin.css';

const UnifiedLogin = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { loginErp } = useData();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const user = await loginErp(identifier, password);
    if (user) {
      navigate(user.role === 'client' ? '/dashboard' : '/erp');
      return;
    }
    setError('بيانات الدخول غير صحيحة أو غير مسجلة لدينا.');
    setLoading(false);
  };

  return (
    <div className="unified-login-container">
      <div className="unified-login-box premium-glass" style={{maxWidth: '400px'}}>
        <div className="brand-logo" style={{textAlign: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem'}}>
          MT <span style={{color: 'var(--color-vibrant-purple)'}}>Agency</span>
        </div>
        
        <div className="login-form-container">
          <form onSubmit={handleLogin}>
            <h3 style={{color: '#fff', marginBottom: '0.5rem', textAlign: 'center'}}>تسجيل الدخول 👋</h3>
            <p style={{color: '#8c8c8c', marginBottom: '2rem', textAlign: 'center'}}>أدخل بياناتك للوصول إلى لوحة التحكم الخاصة بك</p>
            
            <div style={{position: 'relative'}}>
              <User size={18} style={{position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c'}} />
              <input 
                type="text" 
                placeholder="رقم الموبايل أو الإيميل" 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                dir="ltr"
                className="unified-input w-100"
                style={{paddingRight: '45px'}}
              />
            </div>

            <div style={{position: 'relative'}}>
              <Lock size={18} style={{position: 'absolute', right: '15px', top: '15px', color: '#8c8c8c'}} />
              <input
                type="password"
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                required
                className="unified-input w-100"
                style={{paddingRight: '45px'}}
              />
            </div>

            {error && <p className="error-msg">{error}</p>}
            
            <button type="submit" className="btn-modern-primary w-100" disabled={loading} style={{marginTop: '10px'}}>
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>

        <a href="/" className="back-link">العودة للموقع الرئيسي</a>
      </div>
    </div>
  );
};

export default UnifiedLogin;
