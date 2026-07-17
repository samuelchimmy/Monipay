'use client';

import React from 'react';

interface GrainientProps {
  colors?: [string, string, string];
}

export const Grainient: React.FC<GrainientProps> = ({ 
  colors = ['#0052FF', '#7EB6FF', '#001A4D'] 
}) => {
  return (
    <div 
      className="absolute inset-0 opacity-30"
      style={{
        background: `radial-gradient(ellipse at 30% 20%, ${colors[0]}20 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, ${colors[1]}15 0%, transparent 50%)`,
      }}
    />
  );
};
