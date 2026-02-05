#!/usr/bin/env python3
"""
Image Discovery Service for Card Deck System

This module provides the ImageDiscoveryService class that handles scanning
the file system for images in deck and card directories. It supports filtering
by deck, category, and card name, and organizes discovered images by type.
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Any, Set


@dataclass
class CardImage:
    """Represents a card image with metadata."""
    card_name: str
    category: str
    file_path: str
    deck_name: str
    locale: Optional[str] = None  # for locale-specific images


@dataclass
class DeckImages:
    """Represents deck-level images and configuration."""
    deck_name: str
    border_image: Optional[str] = None
    background_image: Optional[str] = None
    category_images: Dict[str, str] = field(default_factory=dict)
    layout_config_path: Optional[str] = None


@dataclass
class ImageFilters:
    """Filters for image discovery."""
    deck_name: Optional[str] = None
    category: Optional[str] = None
    card_name: Optional[str] = None


@dataclass
class ImageCollection:
    """Complete collection of discovered images."""
    deck_images: Dict[str, DeckImages] = field(default_factory=dict)
    card_images: List[CardImage] = field(default_factory=list)
    layout_configs: Dict[str, str] = field(default_factory=dict)


class ImageDiscoveryService:
    """
    Service for discovering images in the deck structure.
    
    This class scans the specs/decks/{deck_name}/cards/ directory structure
    to find deck-level images (Border.jpg, GameBoard.jpg, category images)
    and card images in individual card folders.
    """
    
    # Supported image extensions
    SUPPORTED_EXTENSIONS: Set[str] = {'.jpg', '.jpeg', '.png', '.webp'}
    
    # Standard deck-level image names
    BORDER_IMAGE_NAME = "Border.jpg"
    GAMEBOARD_IMAGE_NAME = "GameBoard.jpg"
    LAYOUT_CONFIG_NAME = "position.json"
    
    # Alternative layout config names (for flexibility)
    LAYOUT_CONFIG_ALTERNATIVES = ["position.json", "layout.json", "deck_layout.json"]
    
    def __init__(self, base_path: str = "specs/decks", supported_extensions: Optional[Set[str]] = None):
        """
        Initialize the ImageDiscoveryService.
        
        Args:
            base_path: Base directory to search for decks (default: "specs/decks")
            supported_extensions: Set of supported file extensions (with dots)
        """
        self.base_path = Path(base_path)
        self.supported_extensions = supported_extensions or self.SUPPORTED_EXTENSIONS.copy()
        self.logger = logging.getLogger('image_discovery')
    
    def discover_deck_images(self, deck_name: str) -> DeckImages:
        """
        Discover deck-level images for a specific deck.
        
        Args:
            deck_name: Name of the deck to scan
            
        Returns:
            DeckImages object containing discovered deck-level images
        """
        deck_dir = self.base_path / deck_name
        deck_images = DeckImages(deck_name=deck_name)
        
        if not deck_dir.exists() or not deck_dir.is_dir():
            self.logger.warning(f"Deck directory does not exist: {deck_dir}")
            return deck_images
        
        self.logger.debug(f"Scanning deck directory: {deck_dir}")
        
        # Look for border image
        border_path = deck_dir / self.BORDER_IMAGE_NAME
        if border_path.exists() and border_path.is_file():
            deck_images.border_image = str(border_path)
            self.logger.debug(f"Found border image: {border_path}")
        
        # Look for background/GameBoard image
        gameboard_path = deck_dir / self.GAMEBOARD_IMAGE_NAME
        if gameboard_path.exists() and gameboard_path.is_file():
            deck_images.background_image = str(gameboard_path)
            self.logger.debug(f"Found background image: {gameboard_path}")
        
        # Look for category images (any .jpg file except Border.jpg and GameBoard.jpg)
        for image_file in deck_dir.glob("*.jpg"):
            if image_file.name not in [self.BORDER_IMAGE_NAME, self.GAMEBOARD_IMAGE_NAME]:
                category_name = image_file.stem.lower()
                deck_images.category_images[category_name] = str(image_file)
                self.logger.debug(f"Found category image '{category_name}': {image_file}")
        
        # Look for layout configuration (try multiple names)
        layout_config_found = False
        for config_name in self.LAYOUT_CONFIG_ALTERNATIVES:
            layout_path = deck_dir / config_name
            if layout_path.exists() and layout_path.is_file():
                # Validate that it's a valid JSON file
                if self._validate_layout_config(layout_path):
                    deck_images.layout_config_path = str(layout_path)
                    self.logger.debug(f"Found valid layout config: {layout_path}")
                    layout_config_found = True
                    break
                else:
                    self.logger.warning(f"Found layout config but it's invalid: {layout_path}")
        
        if not layout_config_found:
            self.logger.debug(f"No valid layout configuration found in {deck_dir}")
        
        return deck_images
    
    def discover_card_images(self, deck_name: str, category: Optional[str] = None) -> List[CardImage]:
        """
        Discover card images for a specific deck and optionally a specific category.
        Supports both locale-specific images (card_en.jpg, card_ru.jpg) and generic images (card.jpg).
        
        Args:
            deck_name: Name of the deck to scan
            category: Optional category filter (protagonists, antagonists, etc.)
            
        Returns:
            List of CardImage objects for discovered card images
        """
        deck_dir = self.base_path / deck_name
        cards_dir = deck_dir / "cards"
        card_images = []
        
        if not cards_dir.exists() or not cards_dir.is_dir():
            self.logger.debug(f"Cards directory does not exist: {cards_dir}")
            return card_images
        
        self.logger.debug(f"Scanning cards directory: {cards_dir}")
        
        # Process each category directory
        for category_dir in cards_dir.iterdir():
            if not category_dir.is_dir():
                continue
            
            category_name = category_dir.name
            
            # Apply category filter
            if category and category_name != category:
                continue
            
            self.logger.debug(f"Scanning category: {category_name}")
            
            # Process each card directory
            for card_dir in category_dir.iterdir():
                if not card_dir.is_dir():
                    continue
                
                card_name = card_dir.name
                
                # Discover all locale-specific and generic images for this card
                card_images_for_card = self._discover_card_images_for_card(card_dir, card_name, category_name, deck_name)
                card_images.extend(card_images_for_card)
        
        return card_images
    
    def _discover_card_images_for_card(self, card_dir: Path, card_name: str, category_name: str, deck_name: str) -> List[CardImage]:
        """
        Discover all images (locale-specific and generic) for a single card.
        
        Args:
            card_dir: Path to the card directory
            card_name: Name of the card
            category_name: Category of the card
            deck_name: Name of the deck
            
        Returns:
            List of CardImage objects for this card
        """
        card_images = []
        
        # Find all image files in the card directory
        found_images = []
        for file_path in card_dir.iterdir():
            if (file_path.is_file() and 
                file_path.suffix.lower() in self.supported_extensions):
                found_images.append(file_path)
                self.logger.debug(f"Found card image: {file_path}")
        
        if not found_images:
            return card_images
        
        # Group images by locale and generic
        locale_images = {}  # locale -> file_path
        generic_images = []
        
        for image_path in found_images:
            locale = self._extract_locale_from_filename(image_path.name)
            if locale:
                # This is a locale-specific image
                locale_images[locale] = image_path
                self.logger.debug(f"Found locale-specific image for '{locale}': {image_path}")
            else:
                # This is a generic image
                generic_images.append(image_path)
                self.logger.debug(f"Found generic image: {image_path}")
        
        # Create CardImage objects for locale-specific images
        for locale, image_path in locale_images.items():
            card_image = CardImage(
                card_name=card_name,
                category=category_name,
                file_path=str(image_path),
                deck_name=deck_name,
                locale=locale
            )
            card_images.append(card_image)
        
        # Create CardImage objects for generic images (if no locale-specific images exist)
        # Or if we want to support both (for fallback purposes)
        if generic_images:
            # Sort to ensure deterministic selection
            generic_images.sort(key=lambda p: p.name)
            selected_generic = generic_images[0]
            
            card_image = CardImage(
                card_name=card_name,
                category=category_name,
                file_path=str(selected_generic),
                deck_name=deck_name,
                locale=None  # Generic image has no specific locale
            )
            card_images.append(card_image)
        
        return card_images
    
    def discover_all_images(self, filters: Optional[ImageFilters] = None) -> ImageCollection:
        """
        Discover all images in the base path, optionally filtered.
        
        Args:
            filters: Optional ImageFilters to limit discovery scope
            
        Returns:
            ImageCollection containing all discovered images
        """
        if filters is None:
            filters = ImageFilters()
        
        collection = ImageCollection()
        
        if not self.base_path.exists():
            self.logger.warning(f"Base path does not exist: {self.base_path}")
            return collection
        
        # Process each deck directory
        for deck_dir in self.base_path.iterdir():
            if not deck_dir.is_dir():
                continue
            
            deck_name = deck_dir.name
            
            # Apply deck filter
            if filters.deck_name and deck_name != filters.deck_name:
                continue
            
            self.logger.info(f"Scanning deck: {deck_name}")
            
            # Discover deck-level images
            deck_images = self.discover_deck_images(deck_name)
            if (deck_images.border_image or deck_images.background_image or 
                deck_images.category_images or deck_images.layout_config_path):
                collection.deck_images[deck_name] = deck_images
                
                # Store layout config path separately for backward compatibility
                if deck_images.layout_config_path:
                    collection.layout_configs[deck_name] = deck_images.layout_config_path
            
            # Discover card images
            card_images = self.discover_card_images(deck_name, filters.category)
            
            # Apply card name filter
            if filters.card_name:
                card_images = [img for img in card_images if img.card_name == filters.card_name]
            
            collection.card_images.extend(card_images)
        
        # Log summary
        total_deck_images = len(collection.deck_images)
        total_card_images = len(collection.card_images)
        total_layouts = len(collection.layout_configs)
        
        self.logger.info(
            f"Discovery complete: {total_deck_images} decks with images, "
            f"{total_card_images} card images, {total_layouts} layout configs"
        )
        
        return collection
    
    def _validate_layout_config(self, config_path: Path) -> bool:
        """
        Validate that a layout configuration file is valid JSON.
        
        Args:
            config_path: Path to the layout configuration file
            
        Returns:
            True if the file contains valid JSON, False otherwise
        """
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                json.load(f)
            return True
        except (json.JSONDecodeError, IOError, UnicodeDecodeError) as e:
            self.logger.debug(f"Layout config validation failed for {config_path}: {e}")
            return False
    
    def _extract_locale_from_filename(self, filename: str) -> Optional[str]:
        """
        Extract locale from filename if present (e.g., card_en.jpg -> 'en', image_ru.png -> 'ru').
        
        Supports multiple patterns:
        - card_en.jpg, card_ru.jpg, card_ua.jpg
        - image_en.png, image_ru.png, image_ua.png
        - name_en.webp, name_ru.webp, name_ua.webp
        
        Args:
            filename: The image filename
            
        Returns:
            Locale string if found, None otherwise
        """
        # Common locale patterns: card_en.jpg, image_ru.png, etc.
        name_without_ext = Path(filename).stem
        parts = name_without_ext.split('_')
        
        if len(parts) >= 2:
            potential_locale = parts[-1].lower()
            # Check if it looks like a locale code (2-3 characters)
            # Support common locales: en, ru, ua, fr, de, es, etc.
            if len(potential_locale) in [2, 3] and potential_locale.isalpha():
                # Additional validation for known locale patterns
                common_locales = {'en', 'ru', 'ua', 'fr', 'de', 'es', 'it', 'pt', 'ja', 'ko', 'zh'}
                if potential_locale in common_locales:
                    return potential_locale
                # If not in common locales but looks like a locale, still accept it
                elif len(potential_locale) == 2:
                    return potential_locale
        
        return None
    
    def get_supported_extensions(self) -> Set[str]:
        """
        Get the set of supported image file extensions.
        
        Returns:
            Set of supported extensions (including the dot)
        """
        return self.supported_extensions.copy()
    
    def to_legacy_format(self, collection: ImageCollection) -> Dict[str, Any]:
        """
        Convert ImageCollection to the legacy format used by the existing upload_images.py.
        
        This method provides backward compatibility with the existing discover_images() function
        while preserving locale-specific image information.
        
        Args:
            collection: ImageCollection to convert
            
        Returns:
            Dictionary in the legacy format with locale-specific image support
        """
        legacy_format = {
            'deck_images': {},
            'card_images': {},
            'layout_configs': collection.layout_configs.copy()
        }
        
        # Convert deck images
        for deck_name, deck_images in collection.deck_images.items():
            deck_data = {}
            
            if deck_images.border_image:
                deck_data['border_image'] = deck_images.border_image
            
            if deck_images.background_image:
                deck_data['background_image'] = deck_images.background_image
            
            if deck_images.category_images:
                deck_data['category_images'] = deck_images.category_images.copy()
            
            if deck_data:
                legacy_format['deck_images'][deck_name] = deck_data
        
        # Convert card images - preserve all locale-specific images
        for card_image in collection.card_images:
            deck_name = card_image.deck_name
            card_name = card_image.card_name
            
            if deck_name not in legacy_format['card_images']:
                legacy_format['card_images'][deck_name] = {}
            
            if card_name not in legacy_format['card_images'][deck_name]:
                legacy_format['card_images'][deck_name][card_name] = {
                    'locale_images': {},
                    'generic_image': None
                }
            
            # Store the image based on locale
            if card_image.locale:
                legacy_format['card_images'][deck_name][card_name]['locale_images'][card_image.locale] = card_image.file_path
            else:
                legacy_format['card_images'][deck_name][card_name]['generic_image'] = card_image.file_path
        
        # Clean up empty structures and convert single-image cards to simple format for backward compatibility
        for deck_name in list(legacy_format['card_images'].keys()):
            for card_name in list(legacy_format['card_images'][deck_name].keys()):
                card_data = legacy_format['card_images'][deck_name][card_name]
                
                # If only generic image exists, use simple format for backward compatibility
                if not card_data['locale_images'] and card_data['generic_image']:
                    legacy_format['card_images'][deck_name][card_name] = card_data['generic_image']
                # If only locale images exist, keep the complex format
                elif card_data['locale_images'] and not card_data['generic_image']:
                    legacy_format['card_images'][deck_name][card_name] = {
                        'locale_images': card_data['locale_images']
                    }
                # If both exist, keep the complex format
                elif card_data['locale_images'] and card_data['generic_image']:
                    # Keep as is
                    pass
                else:
                    # No images found, remove the entry
                    del legacy_format['card_images'][deck_name][card_name]
        
        return legacy_format