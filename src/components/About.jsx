import React from 'react';
import './About.css';

const About = () => {
  return (
    <section id="about" className="about-section">
      <div className="container">
        <div className="about-content glass-panel">
          <h2 className="section-title">من <span className="text-gradient">نحن</span></h2>
          <div className="about-text">
            <p>
              في <strong>MT Agency</strong>، نحن أكثر من مجرد وكالة رقمية؛ نحن شركاؤك في صناعة التأثير والنجاح. 
              على مدار أكثر من 15 عاماً من الخبرة، تخصصنا في تحويل الرؤى والأفكار إلى واقع رقمي ملموس يلامس الجمهور ويحقق الأهداف.
            </p>
            <p>
              نقدم مجموعة متكاملة من الخدمات التي تشمل التصوير الاحترافي، الإنتاج المرئي، تغطية الفعاليات، 
              إنتاج البودكاست بمعايير عالمية، وحلول الذكاء الاصطناعي المبتكرة، بالإضافة إلى تصميم المواقع وإدارة التواجد الرقمي بشكل شامل.
            </p>
            <p>
              مهمتنا هي أن نكون القوة الدافعة خلف كل محتوى عظيم، برؤية مستقبلية تواكب أحدث التقنيات وأعلى معايير الجودة.
            </p>
          </div>
          <div className="about-stats">
            <div className="stat-item">
              <h3>+15</h3>
              <span>سنوات خبرة</span>
            </div>
            <div className="stat-item">
              <h3>+500</h3>
              <span>مشروع ناجح</span>
            </div>
            <div className="stat-item">
              <h3>+50</h3>
              <span>خبير ومبدع</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
