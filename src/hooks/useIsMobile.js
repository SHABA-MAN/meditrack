import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the viewport is mobile (< 768px)
 * @returns {boolean} true if mobile, false otherwise
 */
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if window is defined (for SSR compatibility)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    
    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Create listener function
    const handleChange = (e) => {
      setIsMobile(e.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isMobile;
};
