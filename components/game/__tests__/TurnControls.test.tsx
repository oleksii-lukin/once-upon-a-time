import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, fireEvent } from '@testing-library/react'
import TurnControls from '../TurnControls'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}))

const baseProps = {
  isMyTurn: true,
  canInterrupt: false,
  handSize: 2,
  selectedCardId: 'c1',
  onPlaySelected: vi.fn(),
  onPass: vi.fn(),
  onInterrupt: vi.fn(),
  onWin: vi.fn(),
  gameMode: 'full',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TurnControls', () => {
  it('enables play only with a selected card', () => {
    const { rerender, getByText } = render(<TurnControls {...baseProps} />)
    const playButton = getByText('game.play_card_btn')

    expect(playButton).not.toBeDisabled()
    fireEvent.click(playButton)
    expect(baseProps.onPlaySelected).toHaveBeenCalledTimes(1)

    rerender(<TurnControls {...baseProps} selectedCardId={null} />)
    expect(getByText('game.play_card_btn')).toBeDisabled()
  })

  it('disables play while a card write is pending', () => {
    const { getByText } = render(<TurnControls {...baseProps} isPending />)
    expect(getByText('game.play_card_btn')).toBeDisabled()
  })

  it('renders the solo draw label for the pass action', () => {
    const { getByText } = render(<TurnControls {...baseProps} gameMode="solo" />)

    fireEvent.click(getByText('game.draw_card_btn'))
    expect(baseProps.onPass).toHaveBeenCalledTimes(1)
  })

  it('hides play and offers end-turn in tutorial after the card limit', () => {
    const { queryByText, getByText } = render(
      <TurnControls {...baseProps} gameMode="tutorial" canPlayMoreCards={false} />,
    )

    expect(queryByText('game.play_card_btn')).toBeNull()

    fireEvent.click(getByText('game.end_turn_btn'))
    expect(baseProps.onPass).toHaveBeenCalledTimes(1)
  })

  it('offers exchange instead of pass in tutorial while cards remain', () => {
    const onExchange = vi.fn()
    const { getByText } = render(
      <TurnControls {...baseProps} gameMode="tutorial" onExchange={onExchange} />,
    )

    fireEvent.click(getByText('game.exchange_card_btn'))
    expect(onExchange).toHaveBeenCalledWith('c1')
  })

  it('offers the win button when only the ending card is left', () => {
    const { getByText } = render(
      <TurnControls {...baseProps} handSize={0} selectedCardId="end-1" isEndingSelected />,
    )

    const winButton = getByText('game.play_ending_win_btn')
    expect(winButton).not.toBeDisabled()
    fireEvent.click(winButton)
    expect(baseProps.onWin).toHaveBeenCalledTimes(1)
  })

  it('gates opponent actions behind their flags', () => {
    const { queryByText, getByText, rerender } = render(
      <TurnControls {...baseProps} isMyTurn={false} canObject={false} canInterrupt={false} canChallengeStutter={false} />,
    )

    expect(queryByText('game.object_btn')).toBeNull()
    expect(queryByText('game.interrupt_btn')).toBeNull()
    expect(queryByText('game.challenge_stutter_btn')).toBeNull()

    rerender(
      <TurnControls {...baseProps} isMyTurn={false} canObject canInterrupt canChallengeStutter />,
    )

    fireEvent.click(getByText('game.object_btn'))
    fireEvent.click(getByText('game.interrupt_btn'))
    fireEvent.click(getByText('game.challenge_stutter_btn'))
    expect(baseProps.onInterrupt).toHaveBeenCalledTimes(1)
  })
})
