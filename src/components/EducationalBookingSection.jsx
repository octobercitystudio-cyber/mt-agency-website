import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Download, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  EDUCATIONAL_BOOKING_COPY,
  EDUCATIONAL_BOOKING_GALLERY,
  EDUCATIONAL_BOOKING_SERVICE,
  EDUCATIONAL_BOOKING_TARGET,
} from '../data/educationalBooking';
import { localizePublicPath } from '../lib/publicRoutes';
import { CLIENT_APP_DOWNLOAD_URL } from '../data/clientApp';
import './EducationalBookingSection.css';

export default function EducationalBookingSection() {
  const { i18n } = useTranslation();
  const locale = String(i18n.language).startsWith('en') ? 'en' : 'ar';
  const copy = EDUCATIONAL_BOOKING_COPY[locale];
  const [selectedImage, setSelectedImage] = useState(0);
  const [requestedImages, setRequestedImages] = useState([0]);
  const [failedImages, setFailedImages] = useState({});
  const studioImage = EDUCATIONAL_BOOKING_GALLERY[selectedImage];
  const DirectionArrow = locale === 'en' ? ArrowRight : ArrowLeft;

  return <section id="educational-filming" className="educational-booking" aria-labelledby="educational-booking-title">
    <div className="container educational-booking__layout">
      <div className="educational-booking__content">
        <p className="educational-booking__eyebrow"><BookOpen aria-hidden="true" />{copy.eyebrow}</p>
        <h2 id="educational-booking-title">{copy.title}</h2>
        <p className="educational-booking__description">{copy.description}</p>
        <ol className="educational-booking__steps" aria-label={copy.stepsLabel}>
          {copy.steps.map((step, index) => <li key={step}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong></li>)}
        </ol>
        <Link className="educational-booking__action" to={EDUCATIONAL_BOOKING_TARGET}><CalendarDays aria-hidden="true" /><span>{copy.action}</span><DirectionArrow aria-hidden="true" /></Link>
        <p className="educational-booking__note">{copy.note}</p>
        <Link className="educational-booking__details" to={localizePublicPath(EDUCATIONAL_BOOKING_SERVICE, locale)}>{copy.details}<DirectionArrow aria-hidden="true" /></Link>
        <aside className="educational-booking__app" aria-labelledby="educational-booking-app-title">
          <p className="educational-booking__app-label"><Smartphone aria-hidden="true" /><span>{copy.appLabel}</span></p>
          <h3 id="educational-booking-app-title">{copy.appTitle}</h3>
          <p className="educational-booking__app-description">{copy.appDescription}</p>
          <a className="educational-booking__app-download" href={CLIENT_APP_DOWNLOAD_URL} download><Download aria-hidden="true" /><span>{copy.appAction}</span></a>
          <p className="educational-booking__app-note">{copy.appNote}</p>
        </aside>
      </div>
      <figure className="educational-booking__studio">
        <div className="educational-booking__stage" id="educational-studio-photo">
          {EDUCATIONAL_BOOKING_GALLERY.map((photo, index) => requestedImages.includes(index) && <img
            key={photo.id}
            src={photo.url}
            alt={locale === 'en' ? photo.altEn : photo.alt}
            width="1600" height="900" loading="lazy" decoding="async"
            className={index === selectedImage ? 'is-selected' : ''}
            aria-hidden={index !== selectedImage}
            onError={() => setFailedImages((current) => ({ ...current, [photo.id]: true }))}
          />)}
          {failedImages[studioImage.id] && <p className="educational-booking__image-error">{locale === 'en' ? 'This photo could not be loaded. Please select another view.' : 'تعذّر تحميل الصورة. يمكنك اختيار لقطة أخرى.'}</p>}
          <span className="educational-booking__frame-label" aria-hidden="true">MTA · STUDIO</span>
        </div>
        <figcaption>
          <div><span>{copy.imageLabel}</span><strong>{copy.imageCaption}</strong></div>
          <span className="educational-booking__image-count" dir="ltr" aria-hidden="true">{String(selectedImage + 1).padStart(2, '0')} <span>/ 03</span></span>
        </figcaption>
        <div className="educational-booking__thumbnails" role="group" aria-label={locale === 'en' ? 'Choose a studio photo' : 'اختر صورة من الاستديو'}>
          {EDUCATIONAL_BOOKING_GALLERY.map((photo, index) => <button
            key={photo.id} type="button" aria-pressed={index === selectedImage}
            aria-controls="educational-studio-photo" onClick={() => { setRequestedImages(current => current.includes(index) ? current : [...current, index]); setSelectedImage(index); }}
          >
            <img src={photo.thumbnail} alt="" width="320" height="180" loading="lazy" decoding="async" />
            <span>{locale === 'en' ? photo.labelEn : photo.label}</span>
          </button>)}
        </div>
        <span className="sr-only" aria-live="polite" aria-atomic="true">{locale === 'en' ? studioImage.altEn : studioImage.alt}</span>
      </figure>
    </div>
  </section>;
}
