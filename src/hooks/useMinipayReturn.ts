import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Detects whether the user is currently in a MiniPay app context.
 * Checks referrer, sessionStorage, and localStorage for minipay signals.
 */
export function isMinipayContext(): boolean {
  if (typeof window === 'undefined') return false;

  // Check referrer
  try {
    const referrer = document.referrer;
    if (referrer && referrer.includes('/minipay')) return true;
  } catch { /* */ }

  // Check sessionStorage for minipay landing flag
  try {
    const landing = sessionStorage.getItem('minipay_show_landing');
    if (landing !== null) return true;
  } catch { /* */ }

  // Check localStorage for minipay mode
  try {
    const mode = localStorage.getItem('minipay_mode');
    if (mode !== null) return true;
  } catch { /* */ }

  // Check if current path is /minipay or a subpath
  try {
    if (window.location.pathname.startsWith('/minipay')) return true;
  } catch { /* */ }

  return false;
}

/**
 * Hook that returns a navigate-back function aware of MiniPay context.
 * When in minipay context, navigates to /minipay instead of /.
 */
export function useMinipayReturn() {
  const navigate = useNavigate();
  const [isMinipay, setIsMinipay] = useState(false);

  useEffect(() => {
    setIsMinipay(isMinipayContext());
  }, []);

  const goBack = useCallback(() => {
    navigate(isMinipay ? '/minipay' : '/');
  }, [navigate, isMinipay]);

  return { isMinipay, goBack };
}
