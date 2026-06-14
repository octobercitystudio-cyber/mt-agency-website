import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { X, Gift } from 'lucide-react';
import './OfferPopup.css';

const OfferPopup = () => {
  const { siteData } = useData();
  const [isVisible, setIsVisible] = useState(false);
  const activeOffers = (siteData.offers || []).filter(o => o.is_active !== false);

  useEffect(() => {
    // Only show if there are active offers and user hasn't seen it in this session
    if (activeOffers.length > 0 && !sessionStorage.getItem('offer_popup_seen')) {
      // Small delay to let the site load first
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeOffers.length]);

  const closePopup = () => {
    setIsVisible(false);
    sessionStorage.setItem('offer_popup_seen', 'true');
  };

  if (!isVisible || activeOffers.length === 0) return null;

  return (
    <div className="offer-popup-overlay">
      <div className="offer-popup-content">
        <button className="offer-popup-close" onClick={closePopup}>
          <X size={24} />
        </button>
        
        <div className="offer-popup-header">
          <Gift size={40} className="offer-popup-icon" />
          <h2>عروض حصرية لك!</h2>
        </div>
        
        <div className="offer-popup-body">
          {activeOffers.map((offer, idx) => (
            <div key={offer.id || idx} className="offer-item">
              <div className="offer-discount">{offer.discount}</div>
              <div className="offer-details">
                <h3>{offer.title}</h3>
                <p>{offer.desc}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="offer-popup-footer">
          <a href="#contact" onClick={closePopup} className="btn-primary" style={{width: '100%', textAlign: 'center', display: 'block'}}>
            احصل على العرض الآن
          </a>
        </div>
      </div>
    </div>
  );
};

export default OfferPopup;
