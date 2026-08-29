import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import { Link } from 'react-router-dom';
import './Contact.css';

const Contact = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const contactData = siteData.contact;
  const receivingEmail = siteData.formSettings?.receivingEmail || contactData.email || 'info@multitaskagency.com';

  return (
      <section id="contact" className="contact-section">
        <div className="container">
          
          {/* Top Info Section */}
          <div className="contact-header text-center">
            <h2 className="section-title">
              {t('contact.title1')} <span className="text-gradient">{t('contact.title2')}</span>
            </h2>
            <p className="contact-desc">
              {t('contact.description')}
            </p>
            <Link className="public-preview-link" to="/contact">{isEnglish ? 'Open the full contact page' : 'افتح صفحة التواصل الكاملة'}</Link>
            
            <div className="contact-details-row">
              <div className="contact-item">
                <span className="icon">📍</span>
                <p>{isEnglish ? contactData.addressEn : contactData.address}</p>
              </div>
              <div className="contact-item">
                <span className="icon">📞</span>
                <div style={{display: 'flex', flexDirection: 'column'}}>
                  <p dir="ltr">{contactData.phone}</p>
                  {contactData.phone2 && (
                    <p dir="ltr">{contactData.phone2}</p>
                  )}
                </div>
              </div>
              <div className="contact-item">
                <span className="icon">✉️</span>
                <p dir="ltr">{contactData.email}</p>
              </div>
            </div>
          </div>

          {/* Form and Map Side by Side Grid */}
          <div className="contact-grid">
            
            <div className="contact-form glass-panel">
              <h3 style={{marginBottom: '20px', color: 'var(--color-light-silver)'}}>{isEnglish ? 'Send us a Message' : 'أرسل لنا رسالة'}</h3>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const name = formData.get('Name');
                  const email = formData.get('Email');
                  const message = formData.get('Message');
                  const body = `Name: ${name}%0D%0AEmail: ${email}%0D%0AMessage: ${message}`;
                  window.location.href = `mailto:${receivingEmail}?subject=Contact Form Submission&body=${body}`;
                }}
              >
                <div className="form-group">
                  <input type="text" name="Name" placeholder={t('contact.form.name')} required />
                </div>
                <div className="form-group">
                  <input type="email" name="Email" placeholder={t('contact.form.email')} required />
                </div>
                <div className="form-group">
                  <textarea name="Message" rows="5" placeholder={t('contact.form.message')} required></textarea>
                </div>
                <button type="submit" className="btn-primary w-100">{t('contact.form.submit')}</button>
              </form>
            </div>
            
            <div className="contact-map glass-panel" style={{padding: '0', overflow: 'hidden'}}>
              <iframe 
                src="https://maps.google.com/maps?q=Multi%20Task%20Studio&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%" 
                height="100%" 
                style={{ border: 0, minHeight: '400px' }} 
                allowFullScreen="" 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title="MT Agency Location"
              ></iframe>
            </div>
            
          </div>
        </div>
      </section>
  );
};

export default Contact;
