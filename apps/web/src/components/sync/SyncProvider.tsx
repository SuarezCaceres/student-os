import React from 'react';
import { SyncGate } from '../auth/SyncGate';

/**
 * Provider de sincronizacion. Monta los dialogos del importador junto a los hijos.
 * El estado vive en un store externo (`useSyncStatus`), asi que no hay contexto que propagar:
 * basta con montarlo una vez (en `main.tsx` o dentro de `App`) para que todo funcione.
 * Sin variables de entorno no renderiza nada extra.
 */
export const SyncProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>
    {children}
    <SyncGate />
  </>
);
