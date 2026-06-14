import React from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Contact.css';

const Contact = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const contactData = siteData.contact;
  const receivingEmail = siteData.formSettings?.receivingEmail || contactData.email || 'octobercitystudio@gmail.com';

  return (
    <>
      <section id="contact" className="contact-section">
        <div className="container">
          
          {/* Top Info Section */}
          <div className="contact-header text-center">
            <h2 className="section-title">
              {t('contact.title1')} <span className="text-gradient">{t('contact.title2')}</span>
            </h2>
            <p className="contact-desc" style={{maxWidth: '600px', margin: '0 auto 30px', color: 'var(--color-silver)'}}>
              {t('contact.description')}
            </p>
            
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

      {/* Floating WhatsApp Button */}
      <a 
        href={`https://wa.me/${contactData.phone.replace(/[^0-9]/g, '')}`} 
        className="whatsapp-float"
        target="_blank" 
        rel="noopener noreferrer"
        aria-label="Contact on WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.102.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 1.856.001 3.598.723 4.907 2.034 1.31 1.311 2.031 3.054 2.03 4.908-.001 3.825-3.113 6.938-6.937 6.938z" />
        </svg>
      </a>
    </>
  );
};

export default Contact;
