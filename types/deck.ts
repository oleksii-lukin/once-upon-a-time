import { Database } from '@/supabase/types'
import { CardLayout } from './card'

export type Deck = Database['public']['Tables']['decks']['Row'] & {
  bg_image_url?: string | null
  card_back_image_url?: string | null
  category_images?: Record<string, string> | null
  card_layout?: CardLayout | null
}
