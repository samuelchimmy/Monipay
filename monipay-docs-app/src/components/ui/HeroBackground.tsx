'use client';

export function HeroBackground() {
  return (
    <div className="absolute inset-0 bg-bg overflow-hidden flex items-start justify-center">
      <div 
        className="absolute inset-x-0 top-0 h-[800px] z-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentcolor 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-brand/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[-10%] left-1/4 -translate-x-1/2 w-[600px] h-[400px] bg-brand-light/10 blur-[100px] rounded-full pointer-events-none" />
    </div>
  );
}
