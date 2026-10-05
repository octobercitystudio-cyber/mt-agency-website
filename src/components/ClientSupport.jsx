import { MessageCircle, Phone } from 'lucide-react';
import './ClientSupport.css';

export default function ClientSupport() {
  return <section className="mta-client-support" aria-label="دعم عملاء MTA" dir="rtl">
    <div className="mta-client-support-copy">
      <h2>الدعم الفني — نحن معك</h2>
      <p>في حال وجود أي مشكلة في التسجيل على الموقع أو تسجيل الدخول أو تحميل تطبيق MTA أو تثبيته أو استخدامه، يُرجى التواصل مع الدعم الفني عبر الاتصال أو واتساب.</p>
    </div>
    <div className="mta-client-support-contact">
      <a className="mta-client-support-phone" href="tel:+201094084424" aria-label="اتصل بالدعم على 01094084424"><Phone aria-hidden="true"/><span>اتصل بنا <bdi dir="ltr">01094084424</bdi></span></a>
      <a className="mta-client-support-whatsapp" href="https://wa.me/201094084424" target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true"/><span>واتساب الدعم <bdi dir="ltr">01094084424</bdi></span></a>
    </div>
  </section>;
}
