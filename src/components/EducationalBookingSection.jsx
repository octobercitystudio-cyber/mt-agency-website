import { ArrowLeft, ArrowRight, BookOpen, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  EDUCATIONAL_BOOKING_COPY,
  EDUCATIONAL_BOOKING_IMAGE,
  EDUCATIONAL_BOOKING_SERVICE,
  EDUCATIONAL_BOOKING_TARGET,
} from '../data/educationalBooking';
import { localizePublicPath } from '../lib/publicRoutes';
import './EducationalBookingSection.css';

export default function EducationalBookingSection() {
  const { i18n } = useTranslation();
  const locale = String(i18n.language).startsWith('en') ? 'en' : 'ar';
  const copy = EDUCATIONAL_BOOKING_COPY[locale];
  const studioImage = EDUCATIONAL_BOOKING_IMAGE;
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
      </div>
      <figure className="educational-booking__studio">
        <img src={studioImage.url} alt={locale === 'en' ? studioImage.altEn : studioImage.alt} width="1190" height="852" loading="lazy" decoding="async" />
        <figcaption><span>{copy.imageLabel}</span><strong>{copy.imageCaption}</strong></figcaption>
      </figure>
    </div>
  </section>;
}
