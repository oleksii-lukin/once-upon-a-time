import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, fireEvent } from '@testing-library/react'
import PlayerHand from '../PlayerHand'
import { type HandCardData } from '@/utils/gameUtils'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : ''} alt={alt} {...rest} />
  ),
}))

function makeCard(id: string, name: string, category = 'setting'): HandCardData {
  return {
    id,
    name,
    category,
    type: category === 'ending' ? 'ending' : 'story',
    hand_id: `hand-${id}`,
    position: 0,
  } as unknown as HandCardData
}

const storyCard = makeCard('card-story', 'Story Card')
const endingCard = makeCard('card-ending', 'Ending Card', 'ending')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlayerHand', () => {
  it('renders card names', () => {
    const { getByText } = render(
      <PlayerHand cards={[storyCard, endingCard]} onSelectCard={vi.fn()} selectedCardId={null} isMyTurn />,
    )

    expect(getByText('Story Card')).toBeInTheDocument()
    expect(getByText('Ending Card')).toBeInTheDocument()
  })

  it('selects a card on click when it is my turn', () => {
    const onSelectCard = vi.fn()
    const { getByText } = render(
      <PlayerHand cards={[storyCard]} onSelectCard={onSelectCard} selectedCardId={null} isMyTurn />,
    )

    fireEvent.click(getByText('Story Card'))
    expect(onSelectCard).toHaveBeenCalledWith(storyCard)
  })

  it('ignores clicks when it is not my turn', () => {
    const onSelectCard = vi.fn()
    const { getByText } = render(
      <PlayerHand cards={[storyCard]} onSelectCard={onSelectCard} selectedCardId={null} isMyTurn={false} />,
    )

    fireEvent.click(getByText('Story Card'))
    expect(onSelectCard).not.toHaveBeenCalled()
  })

  it('sorts ending cards after story cards regardless of input order', () => {
    const { container } = render(
      <PlayerHand cards={[endingCard, storyCard]} onSelectCard={vi.fn()} selectedCardId={null} isMyTurn />,
    )

    const html = container.innerHTML
    expect(html.indexOf('Story Card')).toBeLessThan(html.indexOf('Ending Card'))
  })
})
