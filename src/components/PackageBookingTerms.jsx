import { PACKAGE_BOOKING_TERMS } from '../lib/packageBookingTerms';
import './PackageBookingTerms.css';

export default function PackageBookingTerms() {
  return <section className="package-booking-terms" aria-labelledby="package-booking-terms-title">
    <header>
      <span className="package-booking-terms-eyebrow">قبل تأكيد حجزك</span>
      <h3 id="package-booking-terms-title">{PACKAGE_BOOKING_TERMS.title}</h3>
      <p>{PACKAGE_BOOKING_TERMS.intro}</p>
    </header>
    <ol className="package-booking-terms-sections">
      {PACKAGE_BOOKING_TERMS.sections.map((section, index) => <li key={section.title}>
        <h4><span aria-hidden="true">{index + 1}</span>{section.title}</h4>
        {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      </li>)}
    </ol>
    <footer>{PACKAGE_BOOKING_TERMS.closing.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</footer>
  </section>;
}
