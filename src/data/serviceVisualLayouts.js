import { EDUCATIONAL_BOOKING_GALLERY } from './educationalBooking.js';

const photo = slug => `/brand/gold/services/${slug}.webp`;
const detailPhoto = slug => `/brand/gold/service-details/${slug}.webp`;

// Presentation only: content and search metadata remain in publicServiceCatalog.
export const serviceVisualLayouts = {
  'studio-content-production': { variant: 'education', heroImage: EDUCATIONAL_BOOKING_GALLERY[0].url, companionImage: EDUCATIONAL_BOOKING_GALLERY[1].url },
  'reels-production': { variant: 'reels', heroImage: photo('reels-production'), companionImage: photo('reels-production') },
  'commercial-video-production': { variant: 'commercial', heroImage: photo('commercial-video-production'), companionImage: photo('commercial-video-production'), decisionImages: ['corporate-video', 'factory-production', 'product-retail'].map(detailPhoto) },
  'podcast-production': { variant: 'podcast', heroImage: photo('podcast-production'), companionImage: photo('podcast-production') },
  'event-coverage': { variant: 'events', heroImage: photo('event-coverage'), companionImage: photo('event-coverage') },
  'social-media-management': { variant: 'social', heroImage: photo('social-media-management'), companionImage: photo('social-media-management') },
  'creative-design-branding': { variant: 'branding', heroImage: photo('creative-design-branding'), companionImage: photo('creative-design-branding') },
  'web-design-development': { variant: 'web', heroImage: photo('web-design-development'), companionImage: photo('web-design-development'), desktopPreview: '/portfolio-previews/qpshoes-device-desktop.jpg', mobilePreview: '/portfolio-previews/qpshoes-device-mobile.jpg', decisionImages: ['company-website', 'online-store', 'landing-page'].map(detailPhoto) },
  'software-development': { variant: 'software', heroImage: photo('software-development'), companionImage: photo('software-development'), desktopPreview: '/brand/gold/software-app/desktop-app.webp', mobilePreview: '/brand/gold/software-app/mobile-app.webp' },
  'ai-video-production': { variant: 'ai', heroImage: photo('ai-video-production'), companionImage: photo('ai-video-production'), deliverableImages: ['ai-storyboard', 'ai-generated-scene', 'ai-editing-review', 'ai-delivery-formats'].map(detailPhoto) },
};
