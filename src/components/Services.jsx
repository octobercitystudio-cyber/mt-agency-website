import React from 'react';
import './Services.css';

const servicesData = [
  { id: 1, title: 'التصوير الاحترافي', icon: '📸', desc: 'نوثق لحظاتك بأعلى جودة' },
  { id: 2, title: 'تغطية الفعاليات', icon: '🎪', desc: 'ننقل الحدث بتفاصيله المبهرة' },
  { id: 3, title: 'البودكاست', icon: '🎙️', desc: 'إنتاج صوتي ومرئي بمقاييس عالمية' },
  { id: 4, title: 'فيديو الذكاء الاصطناعي', icon: '🤖', desc: 'نبتكر المستقبل بأحدث التقنيات' },
  { id: 5, title: 'التصميم الإبداعي', icon: '🎨', desc: 'نحول الأفكار إلى تحف فنية' },
  { id: 6, title: 'إدارة السوشيال ميديا', icon: '📱', desc: 'نبني تواجدك الرقمي ونزيد تأثيرك' },
  { id: 7, title: 'تطوير الويب', icon: '💻', desc: 'مواقع مستقبلية تعكس هويتك' }
];

const Services = () => {
  return (
    <section id="services" className="services-section">
      <div className="container">
        <h2 className="section-title">خدماتنا <span className="text-gradient">المتكاملة</span></h2>
        <div className="services-grid">
          {servicesData.map((service) => (
            <div key={service.id} className="service-card glass-panel">
              <div className="service-icon-wrapper">
                <div className="service-icon">{service.icon}</div>
              </div>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-desc">{service.desc}</p>
              <div className="card-glow"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
