'use client';

import React, { createContext, useContext, useState } from 'react';

interface FooterContextType {
  updated: string | undefined;
  setUpdated: (updated: string | undefined) => void;
}

const FooterContext = createContext<FooterContextType | undefined>(undefined);

export function FooterProvider({ children }: { children: React.ReactNode }) {
  const [updated, setUpdated] = useState<string | undefined>(undefined);

  return (
    <FooterContext.Provider value={{ updated, setUpdated }}>
      {children}
    </FooterContext.Provider>
  );
}

export function useFooter() {
  const context = useContext(FooterContext);
  if (!context) {
    throw new Error('useFooter must be used within a FooterProvider');
  }
  return context;
}
