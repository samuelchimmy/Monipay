'use client';

import { useEffect } from 'react';
import { useFooter } from './FooterContext';

export function FooterUpdater({ updated }: { updated?: string }) {
  const { setUpdated } = useFooter();

  useEffect(() => {
    setUpdated(updated);
    return () => {
      setUpdated(undefined);
    };
  }, [updated, setUpdated]);

  return null;
}
