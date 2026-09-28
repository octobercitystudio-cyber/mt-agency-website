import { useEffect } from 'react';

export default function ContextMenuPolicy() {
  useEffect(() => {
    const preventMenu = event => event.preventDefault();
    document.addEventListener('contextmenu', preventMenu);
    return () => document.removeEventListener('contextmenu', preventMenu);
  }, []);
  return null;
}
