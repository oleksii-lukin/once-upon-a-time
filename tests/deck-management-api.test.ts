import { describe, it, expect, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as decksHandler } from '@/app/api/image-editor/decks/route'
import { GET as deckDetailsHandler } from '@/app/api/image-editor/decks/[deckName]/route'
import { GET as deckCardsHandler } from '@/app/api/image-editor/decks/[deckName]/cards/route'

// Store original environment for cleanup
const originalEnv = process.env

afterAll(() => {
  process.env = originalEnv
})

describe('Deck Management API Endpoints', () => {
  describe('List Decks Endpoint (/api/image-editor/decks)', () => {
    it('should list available decks from specs/decks/', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/decks')

      const response = await decksHandler(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify response structure
      expect(data).toHaveProperty('decks')
      expect(data).toHaveProperty('total')
      expect(data).toHaveProperty('decksPath')
      expect(data).toHaveProperty('summary')

      // Verify decks array
      expect(Array.isArray(data.decks)).toBe(true)
      expect(data.total).toBe(data.decks.length)

      // Verify summary structure
      expect(data.summary).toHaveProperty('totalDecks')
      expect(data.summary).toHaveProperty('totalCards')
      expect(data.summary).toHaveProperty('totalDeckImages')
      expect(data.summary).toHaveProperty('allCategories')

      // If we have decks, verify their structure
      if (data.decks.length > 0) {
        const deck = data.decks[0]
        expect(deck).toHaveProperty('name')
        expect(deck).toHaveProperty('path')
        expect(deck).toHaveProperty('cardCount')
        expect(deck).toHaveProperty('categories')
        expect(deck).toHaveProperty('deckImages')
        expect(deck).toHaveProperty('lastModified')

        expect(typeof deck.name).toBe('string')
        expect(typeof deck.path).toBe('string')
        expect(typeof deck.cardCount).toBe('number')
        expect(Array.isArray(deck.categories)).toBe(true)
        expect(typeof deck.deckImages).toBe('number')
        expect(typeof deck.lastModified).toBe('string')
      }
    })

    it('should return valid deck paths', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/decks')

      const response = await decksHandler(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.decksPath).toBeTruthy()
      expect(data.decksPath).toContain('specs/decks')
    })

    it('should handle empty decks directory gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/decks')

      const response = await decksHandler(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Should return empty array if no decks exist
      expect(Array.isArray(data.decks)).toBe(true)
      expect(data.total).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Deck Details Endpoint (/api/image-editor/decks/:deckName)', () => {
    it('should return deck details for valid deck', async () => {
      // First get list of available decks
      const listRequest = new NextRequest('http://localhost:3000/api/image-editor/decks')
      const listResponse = await decksHandler(listRequest)
      const listData = await listResponse.json()

      if (listData.decks.length === 0) {
        // Skip test if no decks available
        return
      }

      const deckName = listData.decks[0].name
      const request = new NextRequest(`http://localhost:3000/api/image-editor/decks/${deckName}`)
      const context = {
        params: Promise.resolve({ deckName }),
      }

      const response = await deckDetailsHandler(request, context)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify response structure
      expect(data).toHaveProperty('deck')
      expect(data).toHaveProperty('cards')
      expect(data).toHaveProperty('deckImages')
      expect(data).toHaveProperty('summary')

      // Verify deck structure
      expect(data.deck).toHaveProperty('name')
      expect(data.deck).toHaveProperty('path')
      expect(data.deck).toHaveProperty('cardCount')
      expect(data.deck).toHaveProperty('categories')
      expect(data.deck).toHaveProperty('deckImages')
      expect(data.deck).toHaveProperty('lastModified')

      // Verify cards array
      expect(Array.isArray(data.cards)).toBe(true)
      expect(Array.isArray(data.deckImages)).toBe(true)

      // Verify summary
      expect(data.summary).toHaveProperty('totalCards')
      expect(data.summary).toHaveProperty('categories')
      expect(data.summary).toHaveProperty('totalDeckImages')
      expect(data.summary).toHaveProperty('totalCardImages')

      expect(data.deck.name).toBe(deckName)
    })

    it('should return 400 for missing deck name', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/decks/')
      const context = {
        params: Promise.resolve({ deckName: '' }),
      }

      const response = await deckDetailsHandler(request, context)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Deck name is required')
    })

    it('should return 404 for non-existent deck', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/decks/nonexistent-deck')
      const context = {
        params: Promise.resolve({ deckName: 'nonexistent-deck' }),
      }

      const response = await deckDetailsHandler(request, context)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('Deck not found')
    })
  })

  describe('Deck Cards Endpoint (/api/image-editor/decks/:deckName/cards)', () => {
    it('should return cards for valid deck', async () => {
      // First get list of available decks
      const listRequest = new NextRequest('http://localhost:3000/api/image-editor/decks')
      const listResponse = await decksHandler(listRequest)
      const listData = await listResponse.json()

      if (listData.decks.length === 0) {
        // Skip test if no decks available
        return
      }

      const deckName = listData.decks[0].name
      const request = new NextRequest(`http://localhost:3000/api/image-editor/decks/${deckName}/cards`)
      const context = {
        params: Promise.resolve({ deckName }),
      }

      const response = await deckCardsHandler(request, context)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify response structure
      expect(data).toHaveProperty('deckName')
      expect(data).toHaveProperty('cards')
      expect(data).toHaveProperty('cardsByCategory')
      expect(data).toHaveProperty('categories')
      expect(data).toHaveProperty('summary')

      expect(data.deckName).toBe(deckName)
      expect(Array.isArray(data.cards)).toBe(true)
      expect(Array.isArray(data.categories)).toBe(true)
      expect(typeof data.cardsByCategory).toBe('object')

      // Verify summary
      expect(data.summary).toHaveProperty('totalCards')
      expect(data.summary).toHaveProperty('categoryCounts')
      expect(data.summary).toHaveProperty('totalImages')

      // If we have cards, verify their structure
      if (data.cards.length > 0) {
        const card = data.cards[0]
        expect(card).toHaveProperty('name')
        expect(card).toHaveProperty('category')
        expect(card).toHaveProperty('path')
        expect(card).toHaveProperty('images')
        expect(card).toHaveProperty('metadata')
        expect(card).toHaveProperty('lastModified')

        expect(typeof card.name).toBe('string')
        expect(typeof card.category).toBe('string')
        expect(typeof card.path).toBe('string')
        expect(Array.isArray(card.images)).toBe(true)
        expect(typeof card.metadata).toBe('object')
        expect(typeof card.lastModified).toBe('string')
      }
    })

    it('should filter cards by category when specified', async () => {
      // First get list of available decks
      const listRequest = new NextRequest('http://localhost:3000/api/image-editor/decks')
      const listResponse = await decksHandler(listRequest)
      const listData = await listResponse.json()

      if (listData.decks.length === 0) {
        // Skip test if no decks available
        return
      }

      const deckName = listData.decks[0].name

      // Get all cards first to find a category
      const allCardsRequest = new NextRequest(`http://localhost:3000/api/image-editor/decks/${deckName}/cards`)
      const allCardsContext = {
        params: Promise.resolve({ deckName }),
      }
      const allCardsResponse = await deckCardsHandler(allCardsRequest, allCardsContext)
      const allCardsData = await allCardsResponse.json()

      if (allCardsData.categories.length === 0) {
        // Skip test if no categories available
        return
      }

      const category = allCardsData.categories[0]
      const request = new NextRequest(`http://localhost:3000/api/image-editor/decks/${deckName}/cards?category=${category}`)
      const context = {
        params: Promise.resolve({ deckName }),
      }

      const response = await deckCardsHandler(request, context)

      expect(response.status).toBe(200)
      const data = await response.json()

      // All returned cards should be from the specified category
      data.cards.forEach((card: any) => {
        expect(card.category).toBe(category)
      })
    })

    it('should return 400 for missing deck name', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/decks//cards')
      const context = {
        params: Promise.resolve({ deckName: '' }),
      }

      const response = await deckCardsHandler(request, context)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Deck name is required')
    })

    it('should return 404 for non-existent deck', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-editor/decks/nonexistent-deck/cards')
      const context = {
        params: Promise.resolve({ deckName: 'nonexistent-deck' }),
      }

      const response = await deckCardsHandler(request, context)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('Deck not found')
    })
  })

  describe('Environment Protection for Deck Management', () => {
    it('should block deck listing when feature is disabled', async () => {
      // Temporarily disable the feature
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false'

      const request = new NextRequest('http://localhost:3000/api/image-editor/decks')

      const response = await decksHandler(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Local image editor is disabled. Set ENABLE_LOCAL_IMAGE_EDITOR=true in .env.local')

      // Restore for other tests
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
    })

    it('should block deck details when feature is disabled', async () => {
      // Temporarily disable the feature
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false'

      const request = new NextRequest('http://localhost:3000/api/image-editor/decks/test')
      const context = {
        params: Promise.resolve({ deckName: 'test' }),
      }

      const response = await deckDetailsHandler(request, context)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Local image editor is disabled. Set ENABLE_LOCAL_IMAGE_EDITOR=true in .env.local')

      // Restore for other tests
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
    })

    it('should block deck cards when feature is disabled', async () => {
      // Temporarily disable the feature
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'false'

      const request = new NextRequest('http://localhost:3000/api/image-editor/decks/test/cards')
      const context = {
        params: Promise.resolve({ deckName: 'test' }),
      }

      const response = await deckCardsHandler(request, context)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Local image editor is disabled. Set ENABLE_LOCAL_IMAGE_EDITOR=true in .env.local')

      // Restore for other tests
      process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'
    })
  })

  describe('Data Validation and Structure', () => {
    it('should return consistent data structures across endpoints', async () => {
      // Get deck list
      const listRequest = new NextRequest('http://localhost:3000/api/image-editor/decks')
      const listResponse = await decksHandler(listRequest)
      const listData = await listResponse.json()

      if (listData.decks.length === 0) {
        // Skip test if no decks available
        return
      }

      const deckName = listData.decks[0].name

      // Get deck details
      const detailsRequest = new NextRequest(`http://localhost:3000/api/image-editor/decks/${deckName}`)
      const detailsContext = { params: Promise.resolve({ deckName }) }
      const detailsResponse = await deckDetailsHandler(detailsRequest, detailsContext)
      const detailsData = await detailsResponse.json()

      // Get deck cards
      const cardsRequest = new NextRequest(`http://localhost:3000/api/image-editor/decks/${deckName}/cards`)
      const cardsContext = { params: Promise.resolve({ deckName }) }
      const cardsResponse = await deckCardsHandler(cardsRequest, cardsContext)
      const cardsData = await cardsResponse.json()

      // Verify consistency between endpoints
      expect(detailsData.deck.name).toBe(deckName)
      expect(cardsData.deckName).toBe(deckName)
      expect(detailsData.cards.length).toBe(cardsData.cards.length)
      expect(detailsData.summary.totalCards).toBe(cardsData.summary.totalCards)
    })

    it('should validate image information in card data', async () => {
      // Get deck list
      const listRequest = new NextRequest('http://localhost:3000/api/image-editor/decks')
      const listResponse = await decksHandler(listRequest)
      const listData = await listResponse.json()

      if (listData.decks.length === 0) {
        // Skip test if no decks available
        return
      }

      const deckName = listData.decks[0].name

      // Get deck cards
      const cardsRequest = new NextRequest(`http://localhost:3000/api/image-editor/decks/${deckName}/cards`)
      const cardsContext = { params: Promise.resolve({ deckName }) }
      const cardsResponse = await deckCardsHandler(cardsRequest, cardsContext)
      const cardsData = await cardsResponse.json()

      // Find a card with images
      const cardWithImages = cardsData.cards.find((card: any) => card.images.length > 0)

      if (cardWithImages) {
        const image = cardWithImages.images[0]

        // Verify image structure
        expect(image).toHaveProperty('filename')
        expect(image).toHaveProperty('path')
        expect(image).toHaveProperty('relativePath')
        expect(image).toHaveProperty('serveUrl')
        expect(image).toHaveProperty('size')
        expect(image).toHaveProperty('format')
        expect(image).toHaveProperty('lastModified')

        // Verify image data types
        expect(typeof image.filename).toBe('string')
        expect(typeof image.path).toBe('string')
        expect(typeof image.relativePath).toBe('string')
        expect(typeof image.serveUrl).toBe('string')
        expect(typeof image.size).toBe('number')
        expect(typeof image.format).toBe('string')
        expect(typeof image.lastModified).toBe('string')

        // Verify serve URL format
        expect(image.serveUrl).toMatch(/^\/api\/image-editor\/serve\//)

        // Verify format is valid
        expect(['png', 'jpg', 'jpeg', 'gif', 'webp']).toContain(image.format)
      }
    })
  })
})
