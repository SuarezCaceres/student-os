import React from 'react';

/**
 * Provider de sincronizacion. Ya no monta dialogos (el importador de primer inicio se retiro, spec 009): solo renderiza
 * los hijos. Se conserva para no tocar `main.tsx`. El estado vive en un store externo (`useSyncStatus`).
 */
export const SyncProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
