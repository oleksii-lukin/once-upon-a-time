#!/usr/bin/env python3
"""
Unit tests for ImageDiscoveryService

This test file verifies that the ImageDiscoveryService class correctly
discovers images in the deck structure and handles filtering properly.
"""

import tempfile
import unittest
from pathlib import Path
from image_discovery import ImageDiscoveryService, ImageFilters


class TestImageDiscoveryService(unittest.TestCase):
    """Test cases for ImageDiscoveryService."""
    
    def setUp(self):
        """Set up test environment with temporary directory structure."""
        self.temp_dir = tempfile.mkdtemp()
        self.base_path = Path(self.temp_dir)
        
        # Create test deck structure
        self.deck_dir = self.base_path / "test_deck"
        self.deck_dir.mkdir(parents=True)
        
        # Create cards directory structure
        self.cards_dir = self.deck_dir / "cards"
        self.cards_dir.mkdir()
        
        self.protagonists_dir = self.cards_dir / "protagonists"
        self.protagonists_dir.mkdir()
        
        self.antagonists_dir = self.cards_dir / "antagonists"
        self.antagonists_dir.mkdir()
        
        # Create card directories
        self.card1_dir = self.protagonists_dir / "Hero Card"
        self.card1_dir.mkdir()
        
        self.card2_dir = self.antagonists_dir / "Villain Card"
        self.card2_dir.mkdir()
        
        # Create test files
        self._create_test_files()
        
        # Initialize service
        self.service = ImageDiscoveryService(base_path=str(self.base_path))
    
    def _create_test_files(self):
        """Create test image and configuration files."""
        # Deck-level images
        (self.deck_dir / "Border.jpg").touch()
        (self.deck_dir / "GameBoard.jpg").touch()
        (self.deck_dir / "protagonists.jpg").touch()
        (self.deck_dir / "antagonists.jpg").touch()
        
        # Layout configuration
        (self.deck_dir / "position.json").write_text('{"test": "config"}')
        
        # Card images
        (self.card1_dir / "hero.png").touch()
        (self.card1_dir / "hero_en.jpg").touch()  # Locale-specific
        (self.card2_dir / "villain.webp").touch()
        
        # Non-image files (should be ignored)
        (self.card1_dir / "description.md").touch()
        (self.deck_dir / "readme.txt").touch()
    
    def tearDown(self):
        """Clean up temporary directory."""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_discover_deck_images(self):
        """Test deck-level image discovery."""
        deck_images = self.service.discover_deck_images("test_deck")
        
        self.assertEqual(deck_images.deck_name, "test_deck")
        self.assertIsNotNone(deck_images.border_image)
        self.assertIsNotNone(deck_images.background_image)
        self.assertIsNotNone(deck_images.layout_config_path)
        
        # Check category images
        self.assertIn("protagonists", deck_images.category_images)
        self.assertIn("antagonists", deck_images.category_images)
        
        # Verify paths are correct
        self.assertTrue(deck_images.border_image.endswith("Border.jpg"))
        self.assertTrue(deck_images.background_image.endswith("GameBoard.jpg"))
        self.assertTrue(deck_images.layout_config_path.endswith("position.json"))
    
    def test_discover_card_images(self):
        """Test card image discovery."""
        card_images = self.service.discover_card_images("test_deck")
        
        self.assertEqual(len(card_images), 2)
        
        # Check card names and categories
        card_names = [img.card_name for img in card_images]
        self.assertIn("Hero Card", card_names)
        self.assertIn("Villain Card", card_names)
        
        # Check categories
        categories = [img.category for img in card_images]
        self.assertIn("protagonists", categories)
        self.assertIn("antagonists", categories)
        
        # Check file paths
        for card_image in card_images:
            self.assertTrue(Path(card_image.file_path).exists())
    
    def test_discover_card_images_with_category_filter(self):
        """Test card image discovery with category filter."""
        card_images = self.service.discover_card_images("test_deck", category="protagonists")
        
        self.assertEqual(len(card_images), 1)
        self.assertEqual(card_images[0].card_name, "Hero Card")
        self.assertEqual(card_images[0].category, "protagonists")
    
    def test_discover_all_images(self):
        """Test complete image discovery."""
        collection = self.service.discover_all_images()
        
        # Check deck images
        self.assertIn("test_deck", collection.deck_images)
        deck_images = collection.deck_images["test_deck"]
        self.assertIsNotNone(deck_images.border_image)
        self.assertIsNotNone(deck_images.background_image)
        
        # Check card images
        self.assertEqual(len(collection.card_images), 2)
        
        # Check layout configs
        self.assertIn("test_deck", collection.layout_configs)
    
    def test_discover_all_images_with_filters(self):
        """Test image discovery with filters."""
        filters = ImageFilters(deck_name="test_deck", category="protagonists")
        collection = self.service.discover_all_images(filters)
        
        # Should still find deck images
        self.assertIn("test_deck", collection.deck_images)
        
        # Should only find protagonist cards
        self.assertEqual(len(collection.card_images), 1)
        self.assertEqual(collection.card_images[0].category, "protagonists")
    
    def test_discover_all_images_with_card_filter(self):
        """Test image discovery with card name filter."""
        filters = ImageFilters(card_name="Hero Card")
        collection = self.service.discover_all_images(filters)
        
        # Should find deck images
        self.assertIn("test_deck", collection.deck_images)
        
        # Should only find the specific card
        self.assertEqual(len(collection.card_images), 1)
        self.assertEqual(collection.card_images[0].card_name, "Hero Card")
    
    def test_supported_extensions(self):
        """Test that supported extensions are correctly defined."""
        extensions = self.service.get_supported_extensions()
        
        expected_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
        self.assertEqual(extensions, expected_extensions)
    
    def test_locale_extraction(self):
        """Test locale extraction from filenames."""
        # Test with locale-specific filename
        locale = self.service._extract_locale_from_filename("hero_en.jpg")
        self.assertEqual(locale, "en")
        
        # Test with non-locale filename
        locale = self.service._extract_locale_from_filename("hero.jpg")
        self.assertIsNone(locale)
        
        # Test with multiple underscores
        locale = self.service._extract_locale_from_filename("card_image_ru.png")
        self.assertEqual(locale, "ru")
    
    def test_to_legacy_format(self):
        """Test conversion to legacy format."""
        collection = self.service.discover_all_images()
        legacy_format = self.service.to_legacy_format(collection)
        
        # Check structure
        self.assertIn('deck_images', legacy_format)
        self.assertIn('card_images', legacy_format)
        self.assertIn('layout_configs', legacy_format)
        
        # Check deck images
        self.assertIn('test_deck', legacy_format['deck_images'])
        deck_data = legacy_format['deck_images']['test_deck']
        self.assertIn('border_image', deck_data)
        self.assertIn('background_image', deck_data)
        self.assertIn('category_images', deck_data)
        
        # Check card images
        self.assertIn('test_deck', legacy_format['card_images'])
        card_data = legacy_format['card_images']['test_deck']
        self.assertIn('Hero Card', card_data)
        self.assertIn('Villain Card', card_data)
    
    def test_nonexistent_deck(self):
        """Test behavior with nonexistent deck."""
        deck_images = self.service.discover_deck_images("nonexistent")
        
        self.assertEqual(deck_images.deck_name, "nonexistent")
        self.assertIsNone(deck_images.border_image)
        self.assertIsNone(deck_images.background_image)
        self.assertEqual(len(deck_images.category_images), 0)
        self.assertIsNone(deck_images.layout_config_path)
    
    def test_empty_card_directory(self):
        """Test behavior with empty card directories."""
        # Create empty card directory
        empty_card_dir = self.protagonists_dir / "Empty Card"
        empty_card_dir.mkdir()
        
        card_images = self.service.discover_card_images("test_deck")
        
        # Should not include empty card directory
        card_names = [img.card_name for img in card_images]
        self.assertNotIn("Empty Card", card_names)


if __name__ == '__main__':
    unittest.main()