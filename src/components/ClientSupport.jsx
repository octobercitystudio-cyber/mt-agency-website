import { MessageCircle, Phone } from 'lucide-react';
import './ClientSupport.css';

export default function ClientSupport() {
  return <section className="mta-client-support" aria-label="دعم عملاء MTA" dir="rtl">
    <div className="mta-client-support-copy">
      <h2>محتاج مساعدة؟ نحن معك</h2>
      <p>للمساعدة في التسجيل أو تحميل تطبيق MTA أو تثبيته أو استخدام حسابك، تواصل مع فريق الدعم.</p>
    </div>
    <div className="mta-client-support-contact">
      <a className="mta-client-support-phone" href="tel:+201094084424" aria-label="اتصل بالدعم على 01094084424"><Phone aria-hidden="true"/><span>اتصل بنا <bdi dir="ltr">01094084424</bdi></span></a>
      <a className="mta-client-support-whatsapp" href="https://wa.me/201094084424" target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true"/>تواصل عبر واتساب</a>
    </div>
  </section>;
}
