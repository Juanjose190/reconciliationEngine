/**
 * Mulberry32: PRNG simple, determinista, rápido.
 * No tiene calidad criptográfica; solo garantiza reproducibilidad con la misma semilla.
 */
export class Mulberry32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Elige un elemento aleatorio de un array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Genera un hash hexadecimal de longitud dada. */
  hex(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(this.next() * 16).toString(16);
    }
    return result;
  }
}
