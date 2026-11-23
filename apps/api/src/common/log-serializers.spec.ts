import { serializeRequest, stripQuery } from './log-serializers';

describe('log-serializers', () => {
  it('recorta la query string (code y state de OAuth no llegan a los logs)', () => {
    expect(stripQuery('/google/callback?code=4/0AbC&state=abc.def&scope=x')).toBe('/google/callback');
  });

  it('deja intactas las URLs sin query y tolera valores raros', () => {
    expect(stripQuery('/health')).toBe('/health');
    expect(stripQuery('')).toBe('');
    expect(stripQuery(undefined)).toBe('');
  });

  it('serializeRequest no incluye cabeceras ni la query', () => {
    const out = serializeRequest({
      id: 7,
      method: 'GET',
      url: '/google/callback?code=SECRET&state=SECRET2',
      remoteAddress: '1.2.3.4',
      headers: { authorization: 'Bearer SECRET' },
    } as never);
    expect(out).toEqual({ id: 7, method: 'GET', url: '/google/callback', remoteAddress: '1.2.3.4' });
    expect(JSON.stringify(out)).not.toMatch(/SECRET/);
  });
});
