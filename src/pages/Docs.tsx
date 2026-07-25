import { useEffect } from 'react';
import { PageMeta } from '@/components/PageMeta';

export default function Docs() {
  useEffect(() => {
    window.location.href = 'https://docs.monipay.xyz';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <PageMeta
        title="MoniPay Docs"
        description="MoniPay developer documentation."
        path="/docs"
        noIndex
        noIndexFollow
      />
      <p className="text-sm text-foreground/50">
        Redirecting to <a href="https://docs.monipay.xyz" className="underline">docs.monipay.xyz</a>…
      </p>
    </div>
  );
}
