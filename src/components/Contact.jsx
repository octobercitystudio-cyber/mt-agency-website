import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { companyPhoneTel, normalizeCompanyPhone } from '../lib/companyContact';
import { localizePublicPath } from '../lib/publicRoutes';
import { buildContactEmailUrl } from '../lib/contactEmail';
import './Contact.css';

const Contact = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  const formId = useId();
  const copy = isEnglish ? {
    title: 'Tell us about your project',
    intro: 'Share what you need and the details you have in mind.',
    required: 'All fields are required',
    name: 'Full name', namePlaceholder: 'Your first and last name',
    email: 'Email address', emailPlaceholder: 'name@example.com',
    message: 'Project or inquiry details',
    messagePlaceholder: 'Tell us about the service you need, your project and your preferred timeline.',
    submit: 'Prepare email',
    note: 'Your email app will open so you can send your message.',
    map: 'Our studio location',
  } : {
    title: 'تواصل بشأن مشروعك',
    intro: 'شاركنا الخدمة التي تحتاجها والتفاصيل التي تود مناقشتها.',
    required: 'جميع الحقول مطلوبة',
    name: 'الاسم الكامل', namePlaceholder: 'اكتب اسمك الأول واسم العائلة',
    email: 'البريد الإلكتروني', emailPlaceholder: 'name@example.com',
    message: 'تفاصيل المشروع أو الاستفسار',
    messagePlaceholder: 'وضّح الخدمة المطلوبة، وفكرة مشروعك، والموعد المناسب للتنفيذ.',
    submit: 'تجهيز الرسالة بالبريد',
    note: 'سيفتح تطبيق البريد لديك لإرسال الرسالة.',
    map: 'موقع الاستديو',
  };
  
  const contactData = siteData.contact;
  const receivingEmail = siteData.formSettings?.receivingEmail || contactData.email || 'info@multitaskagency.com';
  const primaryPhone = normalizeCompanyPhone(contactData.phone);
  const secondaryPhone = normalizeCompanyPhone(contactData.phone2);

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
            <Link className="public-preview-link" to={localizePublicPath('/contact', isEnglish ? 'en' : 'ar')}>{isEnglish ? 'Contact details' : 'بيانات التواصل'}</Link>
            
            <div className="contact-details-row">
              <div className="contact-item">
                <span className="icon"><MapPin aria-hidden="true"/></span>
                <p>{isEnglish ? contactData.addressEn : contactData.address}</p>
              </div>
              <div className="contact-item">
                <span className="icon"><Phone aria-hidden="true"/></span>
                <div style={{display: 'flex', flexDirection: 'column'}}>
                  {primaryPhone && <a href={`tel:${companyPhoneTel(contactData.phone)}`} aria-label={`${isEnglish ? 'Call' : 'اتصل على'} ${primaryPhone}`}><p dir="ltr">{primaryPhone}</p></a>}
                  {secondaryPhone && (
                    <a href={`tel:${companyPhoneTel(contactData.phone2)}`} aria-label={`${isEnglish ? 'Call' : 'اتصل على'} ${secondaryPhone}`}><p dir="ltr">{secondaryPhone}</p></a>
                  )}
                </div>
              </div>
              <div className="contact-item">
                <span className="icon"><Mail aria-hidden="true"/></span>
                <p dir="ltr">{contactData.email}</p>
              </div>
            </div>
          </div>

          {/* Form and Map Side by Side Grid */}
          <div className="contact-grid">
            
            <div className="contact-form contact-inquiry glass-panel">
              <header className="contact-inquiry__heading">
                <h3 id={`${formId}-title`}>{copy.title}</h3>
                <p>{copy.intro}</p>
              </header>
              <p className="contact-inquiry__required" id={`${formId}-required`}>{copy.required}</p>
              <form
                aria-labelledby={`${formId}-title`}
                aria-describedby={`${formId}-required ${formId}-note`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  window.location.href = buildContactEmailUrl({
                    receivingEmail,
                    name: formData.get('Name'),
                    email: formData.get('Email'),
                    message: formData.get('Message'),
                    isEnglish,
                  });
                }}
              >
                <div className="form-group">
                  <label htmlFor={`${formId}-name`}>{copy.name}</label>
                  <input id={`${formId}-name`} type="text" name="Name" autoComplete="name" placeholder={copy.namePlaceholder} required />
                </div>
                <div className="form-group">
                  <label htmlFor={`${formId}-email`}>{copy.email}</label>
                  <input id={`${formId}-email`} type="email" name="Email" autoComplete="email" dir="ltr" placeholder={copy.emailPlaceholder} required />
                </div>
                <div className="form-group contact-inquiry__message">
                  <label htmlFor={`${formId}-message`}>{copy.message}</label>
                  <textarea id={`${formId}-message`} name="Message" rows="5" placeholder={copy.messagePlaceholder} required></textarea>
                </div>
                <div className="contact-inquiry__actions">
                  <button type="submit" className="btn-primary w-100">{copy.submit}<Mail aria-hidden="true"/></button>
                  <p id={`${formId}-note`}>{copy.note}</p>
                </div>
              </form>
            </div>
            
            <div className="contact-map contact-location glass-panel">
              <header className="contact-location__heading"><MapPin aria-hidden="true"/><h3>{copy.map}</h3></header>
              <iframe 
                src="https://maps.google.com/maps?q=Multi%20Task%20Studio&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%" 
                allowFullScreen="" 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title={isEnglish ? 'Multi Task Agency studio location' : 'موقع استديو Multi Task Agency'}
              ></iframe>
            </div>
            
          </div>
        </div>
      </section>
  );
};

export default Contact;
