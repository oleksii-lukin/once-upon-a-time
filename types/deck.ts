import { Database } from '@/supabase/types'
import { CardLayout } from './card'

export type Deck = Database['public']['Tables']['decks']['Row'] & {
  category_images?: Record<string, string> | null
  card_layout?: CardLayout | null
}
