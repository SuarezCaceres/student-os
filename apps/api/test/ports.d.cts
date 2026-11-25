export type PortName = 'syncPg' | 'googlePg' | 'publicPg' | 'pg' | 'supabase' | 'google' | 'control' | 'api' | 'web' | 'webNoCloud';
export type PortMap = Readonly<Record<PortName, number>>;

export const BASE_PORTS: PortMap;
export const PORT_OFFSET: number;
export const TEST_PORTS: PortMap;
export function parseOffset(raw: string | number | undefined | null): number;
export function shiftPorts(base: PortMap, offset: number): PortMap;
