import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ReferenceForm } from '@/components/job-application/ReferenceForm';
import { CompanyProvider } from '@/contexts/CompanyContext';

export default function Reference() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get('token');

  useEffect(() => {
    const title = 'Job Reference | Provide Reference';
    const desc = 'Secure reference submission for job applicants.';
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);

    const canonicalHref = `${window.location.origin}/reference`;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalHref);
  }, [location.search]);

  return (
    <CompanyProvider>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Provide a Job Reference</h1>
        </header>
        <main>
          {token ? (
            <ReferenceForm token={token} />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Your secure reference link is missing or invalid. Please use the link provided in your email.
              </p>
            </div>
          )}
        </main>
      </div>
    </CompanyProvider>
  );
}
