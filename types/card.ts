import { z } from 'zod'

export const LayoutElementSchema = z.object({
  top: z.number().min(0).max(100),
  left: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
  preserveRatio: z.boolean().optional().default(false),
})

export type LayoutElement = z.infer<typeof LayoutElementSchema>

export const CardLayoutSchema = z.object({
  name: LayoutElementSchema,
  image: LayoutElementSchema,
  icon: LayoutElementSchema,
})

export type CardLayout = z.infer<typeof CardLayoutSchema>

export const defaultCardLayout: CardLayout = {
  name: { top: 7, left: 12, width: 76, height: 12, preserveRatio: false },
  image: { top: 30, left: 14, width: 72, height: 55, preserveRatio: false },
  icon: { top: 3.5, left: 3.5, width: 12, height: 12, preserveRatio: false },
}

export function parseCardLayout(data: any): CardLayout {
  const result = CardLayoutSchema.safeParse(data)
  return result.success ? result.data : defaultCardLayout
}
