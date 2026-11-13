// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LegalLinks, PRIVACY_URL, TERMS_URL } from './LegalLinks';

describe('LegalLinks', () => {
  afterEach(cleanup);

  it('enlaza a las dos paginas legales estaticas', () => {
    render(<LegalLinks />);
    expect(screen.getByRole('navigation', { name: 'Información legal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Política de privacidad' }).getAttribute('href')).toBe('/legal/privacidad.html');
    expect(screen.getByRole('link', { name: 'Términos de uso' }).getAttribute('href')).toBe('/legal/terminos.html');
    expect(PRIVACY_URL).toBe('/legal/privacidad.html');
    expect(TERMS_URL).toBe('/legal/terminos.html');
  });
});
