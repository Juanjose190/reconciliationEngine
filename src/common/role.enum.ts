export enum Role {
  /** Administra usuarios y configuración de su tenant. */
  ADMIN = 'ADMIN',
  /** Registra movimientos y opera la reconciliación. */
  OPERATOR = 'OPERATOR',
  /** Solo lectura: consulta historial y reportes. */
  AUDITOR = 'AUDITOR',
}

export const ALL_ROLES = Object.values(Role) as string[];
