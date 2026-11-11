import { Mulberry32 } from './prng';

describe('Mulberry32 PRNG', () => {
  it('produce la misma secuencia para la misma semilla', () => {
    const a = new Mulberry32(42);
    const b = new Mulberry32(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produce secuencias distintas para semillas distintas', () => {
    const a = new Mulberry32(1);
    const b = new Mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('int() genera valores en el rango [min, max]', () => {
    const rng = new Mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const val = rng.int(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
    }
  });

  it('pick() elige elementos del array', () => {
    const rng = new Mulberry32(456);
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('hex() genera cadenas de la longitud correcta', () => {
    const rng = new Mulberry32(789);
    const h = rng.hex(64);
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });
});
