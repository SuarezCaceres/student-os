import { BASE_PORTS, PORT_OFFSET, TEST_PORTS, parseOffset, shiftPorts } from './ports.cjs';

// Los puertos historicos: con E2E_PORT_OFFSET=0 el comportamiento debe ser identico al de siempre.
const ORIGINAL_PORTS = {
  syncPg: 54329,
  googlePg: 54334,
  publicPg: 54335,
  pg: 54340,
  supabase: 54341,
  google: 54342,
  control: 54343,
  api: 3100,
  web: 5293,
  webNoCloud: 5294,
};

describe('puertos de las pruebas (E2E_PORT_OFFSET)', () => {
  it('con offset 0 los puertos son exactamente los historicos', () => {
    expect(BASE_PORTS).toEqual(ORIGINAL_PORTS);
    expect(shiftPorts(BASE_PORTS, 0)).toEqual(ORIGINAL_PORTS);
  });

  it('con offset N suma N a todos los puertos', () => {
    const shifted = shiftPorts(BASE_PORTS, 2000);
    for (const [name, port] of Object.entries(ORIGINAL_PORTS)) {
      expect(shifted[name as keyof typeof shifted]).toBe(port + 2000);
    }
  });

  it('los puertos efectivos de esta ejecucion son la base mas la variable de entorno', () => {
    expect(TEST_PORTS).toEqual(shiftPorts(BASE_PORTS, PORT_OFFSET));
    expect(PORT_OFFSET).toBe(parseOffset(process.env.E2E_PORT_OFFSET));
  });

  it('todos los puertos son distintos entre si', () => {
    const values = Object.values(TEST_PORTS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('acepta vacio o ausente como 0 y enteros como texto', () => {
    expect(parseOffset(undefined)).toBe(0);
    expect(parseOffset('')).toBe(0);
    expect(parseOffset('  ')).toBe(0);
    expect(parseOffset('150')).toBe(150);
    expect(parseOffset(7)).toBe(7);
  });

  it('rechaza valores que no son enteros >= 0', () => {
    for (const bad of ['-1', '1.5', 'abc', '10px', '1e3']) {
      expect(() => parseOffset(bad)).toThrow(/E2E_PORT_OFFSET/);
    }
  });

  it('rechaza un offset que saca algun puerto de rango', () => {
    expect(() => shiftPorts(BASE_PORTS, 65000)).toThrow(/fuera de rango|de rango/);
  });
});
