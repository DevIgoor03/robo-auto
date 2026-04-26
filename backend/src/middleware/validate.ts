import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((e: any) => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ error: 'Dados inválidos', errors });
      return;
    }
    req[source] = result.data;
    next();
  };
}
