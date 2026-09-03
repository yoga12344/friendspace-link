import { z } from 'zod'
import type { Resolver, FieldValues } from 'react-hook-form'

export function zodResolver<TFieldValues extends FieldValues = FieldValues>(
  schema: z.ZodType<any, any, any>
): Resolver<TFieldValues> {
  return async (values) => {
    const result = await schema.safeParseAsync(values)
    if (result.success) {
      return { values: result.data, errors: {} }
    }

    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root'
      if (!errors[path]) {
        errors[path] = {
          type: issue.code,
          message: issue.message,
        }
      }
    }

    return { values: {} as TFieldValues, errors: errors as any }
  }
}
