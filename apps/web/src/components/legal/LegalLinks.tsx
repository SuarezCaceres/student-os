import React from 'react';

export const PRIVACY_URL = '/legal/privacidad.html';
export const TERMS_URL = '/legal/terminos.html';

interface LegalLinksProps {
  className?: string;
  /** `inline`: en una fila (pie de página). `stacked`: uno debajo de otro. */
  layout?: 'inline' | 'stacked';
}

/**
 * Enlaces a la política de privacidad y a los términos para el pie de página. Son páginas estáticas
 * (`public/legal`), así que se abren como documentos normales, sin pasar por el enrutado de la app.
 */
export const LegalLinks: React.FC<LegalLinksProps> = ({ className = '', layout = 'inline' }) => {
  const linkClass =
    'inline-flex min-h-[44px] items-center text-sm text-[var(--muted)] underline underline-offset-4 transition-colors hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]';
  return (
    <nav aria-label="Información legal" className={className}>
      <ul className={`flex ${layout === 'inline' ? 'flex-wrap items-center gap-x-5' : 'flex-col'}`}>
        <li>
          <a href={PRIVACY_URL} className={linkClass}>
            Política de privacidad
          </a>
        </li>
        <li>
          <a href={TERMS_URL} className={linkClass}>
            Términos de uso
          </a>
        </li>
      </ul>
    </nav>
  );
};
