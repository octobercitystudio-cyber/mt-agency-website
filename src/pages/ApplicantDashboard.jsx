import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import ClientIntakeRequests from '../components/IntakeRequests';
export default function ApplicantDashboard() {
  const { currentUser, logout, refreshSession } = useData(); const navigate = useNavigate();
  return <main className="applicant-page" dir="rtl"><header className="applicant-topbar"><a href="/" aria-label="الموقع الرئيسي"><img src="/logo.webp" alt="Multi Task Agency"/></a><button onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={17}/> تسجيل الخروج</button></header><div className="applicant-content"><section className="applicant-welcome"><h1>أهلًا، {currentUser?.full_name}</h1><p>تم التحقق من بريدك وإرسال طلبك. يمكنك متابعة كل مرحلة هنا؛ تُفعَّل خدمات حسابك بعد موافقة الإدارة على تسجيلك.</p></section><ClientIntakeRequests onRefreshSession={refreshSession}/></div></main>;
}
