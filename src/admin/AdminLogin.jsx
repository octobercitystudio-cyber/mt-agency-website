import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useData();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (login(username, password)) {
      navigate('/adminmt');
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card} className="glass-panel">
        <h2 style={styles.title}>تسجيل الدخول للإدارة</h2>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="text"
            placeholder="اسم المستخدم"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            dir="ltr"
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            dir="ltr"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" className="btn-primary" style={{width: '100%'}}>
            دخول
          </button>
        </form>
        <a href="/" style={{display: 'block', textAlign: 'center', marginTop: '20px', color: 'var(--color-vibrant-purple)'}}>
          العودة للموقع
        </a>
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'var(--bg-dark)',
    backgroundImage: 'var(--bg-gradient)',
  },
  card: {
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    borderRadius: '16px',
    border: '1px solid rgba(122, 40, 203, 0.3)',
  },
  title: {
    textAlign: 'center',
    color: '#fff',
    marginBottom: '20px',
    fontSize: '1.8rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  input: {
    padding: '12px 15px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.2)',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
  },
  error: {
    color: '#ff4d4d',
    textAlign: 'center',
    fontSize: '0.9rem',
    margin: 0,
  }
};

export default AdminLogin;
