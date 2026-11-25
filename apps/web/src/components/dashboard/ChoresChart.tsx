import React, { useId } from 'react';
import { Star } from 'lucide-react';
import { CHART_WEEKS, MIN_CHART_DAYS, type WeekdayStats } from '../../utils/chores';

export interface ChoresChartProps {
  /** Promedios por día de la semana (`useChores().stats`), de lunes a domingo. */
  stats: WeekdayStats;
}

// Medidas del SVG en unidades del viewBox (≈ px en móvil; en pantallas anchas se escala).
const WIDTH = 300;
const HEIGHT = 170;
const PAD_X = 8;
const TOP = 24; // espacio para el valor sobre la barra más alta
const BOTTOM = 28; // espacio para la etiqueta del día
const BAR_WIDTH = 24;

const formatAverage = (value: number): string => value.toLocaleString('es', { maximumFractionDigits: 1 });

/**
 * Gráfica semanal de quehaceres (spec 012, C12-C13): barras SVG de lunes a domingo con el promedio de completados de
 * las últimas 8 semanas. Sin librerías; colores solo por tokens CSS (claro y oscuro) y descripción textual accesible.
 * Con pocos días muestra un estado vacío, nunca una gráfica en ceros.
 */
export const ChoresChart: React.FC<ChoresChartProps> = ({ stats }) => {
  const id = useId();
  const { averages, bestDay, countedDays, hasEnoughData } = stats;

  const header = (
    <>
      <h4 className="text-[15px] font-medium text-[var(--ink)]">Tu semana</h4>
      <p className="text-[13px] text-[var(--muted)] mt-0.5">
        Promedio de quehaceres completados por día en las últimas {CHART_WEEKS} semanas. Los días difíciles no cuentan.
      </p>
    </>
  );

  if (!hasEnoughData) {
    return (
      <div data-testid="chores-chart">
        {header}
        <div className="mt-3 rounded-[12px] bg-[var(--surface-2)] p-4" data-testid="chores-chart-empty">
          <p className="text-[15px] font-medium text-[var(--ink)]">Aún no hay suficientes días para mostrar tu semana.</p>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            Llevas {countedDays} de {MIN_CHART_DAYS} días con registro. Sigue marcando tus quehaceres y aquí verás en qué día de
            la semana haces más.
          </p>
        </div>
      </div>
    );
  }

  const maxAverage = Math.max(1, ...averages.map((entry) => entry.average));
  const scaleMax = Math.ceil(maxAverage);
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const slot = (WIDTH - PAD_X * 2) / averages.length;
  const baseline = HEIGHT - BOTTOM;

  const description =
    averages
      .map((entry) => `${entry.day} ${entry.samples === 0 ? 'sin datos' : formatAverage(entry.average)}`)
      .join(', ') + (bestDay ? `. Tu mejor día es ${bestDay}.` : '.');

  return (
    <div data-testid="chores-chart">
      {header}
      <svg
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[460px] h-auto mt-3"
      >
        <title id={`${id}-title`}>Promedio de quehaceres completados por día de la semana</title>
        <desc id={`${id}-desc`}>{description}</desc>

        <line x1={PAD_X} x2={WIDTH - PAD_X} y1={baseline} y2={baseline} stroke="var(--line-strong)" strokeWidth={1} />

        {averages.map((entry, index) => {
          const isBest = entry.day === bestDay;
          const hasData = entry.samples > 0;
          const barHeight = hasData ? Math.max(2, (entry.average / scaleMax) * plotHeight) : 0;
          const centerX = PAD_X + slot * index + slot / 2;
          return (
            <g key={entry.day} data-testid={`chores-bar-${entry.day}`} data-best={isBest ? 'true' : undefined}>
              {hasData && (
                <rect
                  x={centerX - BAR_WIDTH / 2}
                  y={baseline - barHeight}
                  width={BAR_WIDTH}
                  height={barHeight}
                  rx={5}
                  fill={isBest ? 'var(--action)' : 'var(--muted)'}
                  fillOpacity={isBest ? 1 : 0.7}
                />
              )}
              <text
                aria-hidden="true"
                x={centerX}
                y={hasData ? baseline - barHeight - 6 : baseline - 6}
                textAnchor="middle"
                fontSize={12}
                fontWeight={isBest ? 700 : 500}
                fill={isBest ? 'var(--action)' : 'var(--muted)'}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {hasData ? formatAverage(entry.average) : '–'}
              </text>
              <text
                aria-hidden="true"
                x={centerX}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={12}
                fontWeight={isBest ? 700 : 400}
                fill={isBest ? 'var(--ink)' : 'var(--muted)'}
              >
                {entry.day.slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="flex items-center gap-1.5 text-[15px] font-medium text-[var(--ink)] mt-2" data-testid="chores-best-day">
        {bestDay ? (
          <>
            <Star className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
            <span>Tu mejor día: {bestDay}</span>
          </>
        ) : (
          <span className="text-[var(--muted)] font-normal text-[13px]">
            Todavía no hay un día destacado: marca algún quehacer y lo verás aquí.
          </span>
        )}
      </p>
    </div>
  );
};
