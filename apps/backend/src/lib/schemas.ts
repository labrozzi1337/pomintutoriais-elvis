import { z } from "zod";

export const uuidSchema = z.uuid();

/** Valida um parâmetro UUID antes que ele alcance banco, fila ou filesystem. */
export function validarUuid(value: string): string {
  return uuidSchema.parse(value);
}
