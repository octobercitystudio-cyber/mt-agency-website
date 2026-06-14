import { useEffect } from 'react';

const useExternalScripts = () => {
  useEffect(() => {
    // Array of scripts and styles to inject
    const resources = [
      { type: 'style', href: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css', id: 'bootstrap-css' },
      { type: 'style', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', id: 'fa-css' },
      { type: 'style', href: 'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css', id: 'animate-css' },
      { type: 'style', href: 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css', id: 'cropper-css' },
      { type: 'script', src: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js', id: 'bootstrap-js' }
    ];

    resources.forEach((res) => {
      if (document.getElementById(res.id)) return; // Already injected

      if (res.type === 'style') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = res.href;
        link.id = res.id;
        document.head.appendChild(link);
      } else if (res.type === 'script') {
        const script = document.createElement('script');
        script.src = res.src;
        script.id = res.id;
        script.async = true;
        document.body.appendChild(script);
      }
    });

  }, []);
};

export default useExternalScripts;
