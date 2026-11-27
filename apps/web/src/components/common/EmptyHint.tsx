import React from 'react';
import { Compass } from 'lucide-react';

export interface EmptyHintAction {
  label: string;
  onClick: () => void;
}

interface EmptyHintProps {
  /** Titulo corto opcional (p. ej. «Tu espacio esta listo»). */
  title?: string;
  /** Texto de la guia: que hacer primero. */
  children: React.ReactNode;
  /** Atajos opcionales para hacer ese primer paso con un clic. */
  actions?: EmptyHintAction[];
  className?: string;
}

/**
 * Guia de un modulo vacio (spec 010, C5). Misma presentacion y tono en toda la app: dice que hacer primero y, si se
 * quiere, ofrece los atajos. Es un `note` (informacion, no una alerta).
 */
export const EmptyHint: React.FC<EmptyHintProps> = ({ title, children, actions, className = '' }) => (
  <div
    role="note"
    className={`flex items-start gap-3 rounded-[14px] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-4 ${className}`}
  >
    <Compass className="mt-0.5 h-5 w-5 shrink-0 text-[var(--action)]" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      {title && <p className="text-[15px] font-semibold text-[var(--ink)]">{title}</p>}
      <div className={`text-[14px] text-[var(--muted)] ${title ? 'mt-1' : ''}`}>{children}</div>
      {actions && actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick} className="t-btn t-btn-secondary min-h-[44px]">
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);
