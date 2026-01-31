#!/usr/bin/env python3
"""
Image Upload Script for Card Deck System

This script handles automated image upload to UploadThing service for card decks.
It can be run standalone or called by generate_seed.py to process images before SQL generation.

Features:
- Automatic image discovery in deck/card folders
- UploadThing API integration with caching
- Command-line filtering by deck, category, card
- Dry-run mode for testing
- JSON output for integration with seed generator
- Comprehensive logging and error handling
- Configurable retry attempts, timeouts, and file extensions
"""

import argparse
import base64
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# Import the new ImageDiscoveryService and UploadThingClient
from image_discovery import ImageDiscoveryService, ImageFilters
from uploadthing_client import UploadThingClient, UploadResult, UploadLimits
from image_cache_manager import ImageCacheManager
from image_uploader import ImageUploader
from config import get_config_manager, ImageUploadConfig


def setup_logging(config: ImageUploadConfig) -> logging.Logger:
    """Configure logging with the specified configuration."""
    log_level = getattr(logging, config.logging.level.upper(), logging.INFO)
    
    # Create formatter
    formatter = logging.Formatter(
        config.logging.format,
        datefmt=config.logging.date_format
    )
    
    # Configure root logger
    logger = logging.getLogger('upload_images')
    logger.setLevel(log_level)
    
    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger


def decode_uploadthing_token(token: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Decode UploadThing token to extract API key and app ID.
    Supports both JWT format and base64-encoded JSON format.
    
    Args:
        token: UploadThing token
        
    Returns:
        Tuple of (api_key, app_id) or (None, None) if decoding fails
    """
    logger = logging.getLogger('upload_images')
    
    try:
        # Remove quotes if present
        token = token.strip('\'"')
        logger.debug(f"Token after quote removal: {token[:50]}...")
        
        # Try JWT format first (3 parts separated by dots)
        parts = token.split('.')
        logger.debug(f"Token parts count: {len(parts)}")
        
        if len(parts) == 3:
            # Standard JWT format
            logger.debug("Attempting JWT decoding")
            payload = parts[1]
            
            # Add padding if needed for base64 decoding
            padding = 4 - (len(payload) % 4)
            if padding != 4:
                payload += '=' * padding
            
            # Decode base64
            decoded_bytes = base64.urlsafe_b64decode(payload)
            payload_data = json.loads(decoded_bytes.decode('utf-8'))
            
        else:
            # Try direct base64 decoding (UploadThing format)
            logger.debug("Attempting direct base64 decoding")
            
            # Add padding if needed for base64 decoding
            token_padded = token
            padding = 4 - (len(token_padded) % 4)
            if padding != 4:
                token_padded += '=' * padding
            
            # Decode base64
            decoded_bytes = base64.urlsafe_b64decode(token_padded)
            payload_data = json.loads(decoded_bytes.decode('utf-8'))
        
        logger.debug(f"Decoded payload keys: {list(payload_data.keys())}")
        
        # Extract apiKey and appId
        api_key = payload_data.get('apiKey')
        app_id = payload_data.get('appId')
        
        logger.debug(f"Extracted - API Key: {'***' if api_key else None}, App ID: {app_id}")
        
        return api_key, app_id
        
    except Exception as e:
        logger.debug(f"Failed to decode UploadThing token: {e}")
        return None, None


def discover_images(
    config: ImageUploadConfig,
    base_path: str = "specs/decks",
    deck_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    card_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    Discover images in the deck structure using ImageDiscoveryService.
    
    This function provides backward compatibility with the existing interface
    while using the new ImageDiscoveryService class internally.
    
    Args:
        config: Configuration object with supported extensions
        base_path: Base directory to search for decks
        deck_filter: Only process this specific deck
        category_filter: Only process this category (protagonists, antagonists, etc.)
        card_filter: Only process this specific card name
        
    Returns:
        Dictionary with discovered images organized by type (legacy format)
    """
    logger = logging.getLogger('upload_images')
    
    # Create ImageDiscoveryService instance with configured extensions
    discovery_service = ImageDiscoveryService(
        base_path=base_path,
        supported_extensions=config.files.supported_extensions
    )
    
    # Create filters
    filters = ImageFilters(
        deck_name=deck_filter,
        category=category_filter,
        card_name=card_filter
    )
    
    # Discover all images
    collection = discovery_service.discover_all_images(filters)
    
    # Convert to legacy format for backward compatibility
    return discovery_service.to_legacy_format(collection)


def create_progress_callback(logger, verbosity_level: str = "INFO"):
    """Create a progress callback function for the ImageUploader with configurable verbosity."""
    def progress_callback(progress):
        """Progress callback function that logs upload progress with different verbosity levels."""
        percentage = progress.completion_percentage
        eta = progress.estimated_time_remaining
        rate = progress.upload_rate
        
        # Determine reporting frequency based on verbosity level
        if verbosity_level == "DEBUG":
            # Report every file completion
            should_report = True
        elif verbosity_level == "INFO":
            # Report every 10% or when complete
            should_report = (progress.completed_files == progress.total_files or 
                           int(percentage) % 10 == 0 and progress.completed_files > 0)
        elif verbosity_level == "WARNING":
            # Report only at 25%, 50%, 75%, and completion
            should_report = (progress.completed_files == progress.total_files or 
                           int(percentage) in [25, 50, 75] and progress.completed_files > 0)
        else:  # ERROR level
            # Report only completion
            should_report = progress.completed_files == progress.total_files
        
        if should_report:
            # Base progress message
            msg = f"📊 Upload progress: {percentage:.1f}% ({progress.completed_files}/{progress.total_files})"
            
            # Add detailed statistics based on verbosity
            if verbosity_level in ["DEBUG", "INFO"]:
                # Add success/failure breakdown
                if progress.successful_uploads > 0 or progress.cached_urls > 0 or progress.failed_uploads > 0:
                    msg += f" [✅{progress.successful_uploads + progress.cached_urls} ❌{progress.failed_uploads}]"
                
                # Add ETA and rate information
                if eta is not None and eta > 1:
                    if eta > 60:
                        msg += f", ETA: {eta/60:.1f}m"
                    else:
                        msg += f", ETA: {eta:.0f}s"
                
                if rate > 0:
                    msg += f", Rate: {rate:.1f} files/sec"
            
            # Add current file information for DEBUG level
            if verbosity_level == "DEBUG" and progress.current_file:
                current_file_name = Path(progress.current_file).name
                msg += f", Current: {current_file_name}"
            
            # Log at appropriate level
            if verbosity_level == "DEBUG":
                logger.debug(msg)
            elif verbosity_level == "WARNING":
                logger.warning(msg)
            elif verbosity_level == "ERROR":
                logger.error(msg)
            else:
                logger.info(msg)
    
    return progress_callback


def process_images(
    config: ImageUploadConfig,
    discovered_images: Dict[str, Any],
    dry_run: bool = False,
    output_json: Optional[str] = None,
    verbosity_level: str = "INFO"
) -> Dict[str, Any]:
    """
    Process discovered images using the ImageUploader class.
    
    Args:
        config: Configuration object with all settings
        discovered_images: Images discovered by discover_images()
        dry_run: If True, simulate uploads without actually uploading
        output_json: Path to write JSON output file
        verbosity_level: Verbosity level for progress reporting
        
    Returns:
        Dictionary with processed results
    """
    logger = logging.getLogger('upload_images')
    
    # Convert legacy format to ImageCollection
    discovery_service = ImageDiscoveryService(supported_extensions=config.files.supported_extensions)
    
    # Create a mock collection from the legacy format
    from image_discovery import ImageCollection, DeckImages, CardImage
    
    collection = ImageCollection()
    
    # Convert deck images
    for deck_name, deck_data in discovered_images.get('deck_images', {}).items():
        deck_images = DeckImages(deck_name=deck_name)
        
        if 'border_image' in deck_data:
            deck_images.border_image = deck_data['border_image']
        
        if 'background_image' in deck_data:
            deck_images.background_image = deck_data['background_image']
        
        if 'category_images' in deck_data:
            deck_images.category_images = deck_data['category_images']
        
        collection.deck_images[deck_name] = deck_images
    
    # Convert card images
    for deck_name, card_data in discovered_images.get('card_images', {}).items():
        for card_name, image_info in card_data.items():
            # Handle both old format (direct path) and new format (with locale info)
            if isinstance(image_info, str):
                # Old format: direct path
                # Extract category from path (assuming structure: .../category/card_name/...)
                path_parts = Path(image_info).parts
                category = "unknown"
                for i, part in enumerate(path_parts):
                    if part == "cards" and i + 1 < len(path_parts):
                        category = path_parts[i + 1]
                        break
                
                card_image = CardImage(
                    card_name=card_name,
                    category=category,
                    file_path=image_info,
                    deck_name=deck_name,
                    locale=None
                )
                collection.card_images.append(card_image)
            elif isinstance(image_info, dict):
                # New format: with locale information
                # Extract category from any available path
                sample_path = image_info.get('generic_image') or next(iter(image_info.get('locale_images', {}).values()), '')
                path_parts = Path(sample_path).parts if sample_path else []
                category = "unknown"
                for i, part in enumerate(path_parts):
                    if part == "cards" and i + 1 < len(path_parts):
                        category = path_parts[i + 1]
                        break
                
                # Add generic image if present
                if image_info.get('generic_image'):
                    card_image = CardImage(
                        card_name=card_name,
                        category=category,
                        file_path=image_info['generic_image'],
                        deck_name=deck_name,
                        locale=None
                    )
                    collection.card_images.append(card_image)
                
                # Add locale-specific images
                for locale, image_path in image_info.get('locale_images', {}).items():
                    card_image = CardImage(
                        card_name=card_name,
                        category=category,
                        file_path=image_path,
                        deck_name=deck_name,
                        locale=locale
                    )
                    collection.card_images.append(card_image)
    
    # Store layout configs
    collection.layout_configs = discovered_images.get('layout_configs', {})
    
    if dry_run:
        logger.info("🔍 DRY RUN MODE - No actual uploads will be performed")
        # Use dummy credentials for dry-run
        uploader = ImageUploader(
            api_key="dummy_key",
            app_id="dummy_app_id",
            cache_file=config.files.cache_file,
            max_concurrent=config.upload.max_concurrent_uploads,
            timeout=config.retry.timeout_seconds,
            retry_attempts=config.retry.max_attempts,
            backoff_factor=config.retry.backoff_factor,
            upload_limits=UploadLimits(
                max_file_size=config.upload.max_file_size_bytes,
                compression_threshold=config.upload.compression_threshold_bytes,
                compression_quality=config.upload.compression_quality,
                max_image_dimension=config.upload.max_image_dimension,
                supported_types=config.files.supported_mime_types
            ),
            progress_callback=create_progress_callback(logger, verbosity_level),
            resume_state_file=config.files.resume_state_file
        )
    else:
        if not config.has_credentials():
            logger.error("❌ API credentials required for actual uploads")
            return {
                'deck_images': {},
                'card_images': {},
                'layout_configs': {},
                'summary': {
                    'total_processed': 0,
                    'successful_uploads': 0,
                    'failed_uploads': 0,
                    'cached_urls': 0
                }
            }
        
        # Get credentials from config
        api_key = config.uploadthing_secret
        app_id = config.uploadthing_app_id
        
        # If using token format, decode it
        if not api_key or not app_id:
            if config.uploadthing_token:
                api_key, app_id = decode_uploadthing_token(config.uploadthing_token)
        
        if not api_key or not app_id:
            logger.error("❌ Could not extract valid credentials from configuration")
            return {
                'deck_images': {},
                'card_images': {},
                'layout_configs': {},
                'summary': {
                    'total_processed': 0,
                    'successful_uploads': 0,
                    'failed_uploads': 0,
                    'cached_urls': 0
                }
            }
        
        # Initialize ImageUploader with real credentials and configuration
        try:
            uploader = ImageUploader(
                api_key=api_key,
                app_id=app_id,
                cache_file=config.files.cache_file,
                max_concurrent=config.upload.max_concurrent_uploads,
                timeout=config.retry.timeout_seconds,
                retry_attempts=config.retry.max_attempts,
                backoff_factor=config.retry.backoff_factor,
                upload_limits=UploadLimits(
                    max_file_size=config.upload.max_file_size_bytes,
                    compression_threshold=config.upload.compression_threshold_bytes,
                    compression_quality=config.upload.compression_quality,
                    max_image_dimension=config.upload.max_image_dimension,
                    supported_types=config.files.supported_mime_types
                ),
                progress_callback=create_progress_callback(logger, verbosity_level),
                resume_state_file=config.files.resume_state_file
            )
            logger.info("✅ ImageUploader initialized")
            
            # Validate credentials
            if not uploader.validate_credentials():
                logger.error("❌ Invalid UploadThing credentials")
                return {
                    'deck_images': {},
                    'card_images': {},
                    'layout_configs': {},
                    'summary': {
                        'total_processed': 0,
                        'successful_uploads': 0,
                        'failed_uploads': 0,
                        'cached_urls': 0
                    }
                }
            
            logger.info("✅ UploadThing credentials validated")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize ImageUploader: {e}")
            return {
                'deck_images': {},
                'card_images': {},
                'layout_configs': {},
                'summary': {
                    'total_processed': 0,
                    'successful_uploads': 0,
                    'failed_uploads': 0,
                    'cached_urls': 0
                }
            }
    
    try:
        # Track timing for enhanced statistics
        start_time = time.time()
        
        # Upload images using ImageUploader
        batch_result = uploader.upload_image_collection(collection, dry_run=dry_run)
        
        # Calculate timing statistics
        end_time = time.time()
        total_time = end_time - start_time
        avg_per_file = total_time / max(batch_result.total_processed, 1)
        
        # Convert batch result back to legacy format
        results = {
            'deck_images': {},
            'card_images': {},
            'layout_configs': {},
            'summary': {
                'total_processed': batch_result.total_processed,
                'successful_uploads': len(batch_result.successful_uploads),
                'failed_uploads': len(batch_result.failed_uploads),
                'cached_urls': len(batch_result.cached_urls),
                'timing': {
                    'total_time': total_time,
                    'avg_per_file': avg_per_file,
                    'cache_hits': len(batch_result.cached_urls),
                    'upload_time': total_time - (len(batch_result.cached_urls) * 0.1),  # Estimate
                    'cache_time': len(batch_result.cached_urls) * 0.1  # Estimate
                }
            }
        }
        
        # Process successful uploads and cached URLs
        all_successful_urls = {**batch_result.successful_uploads, **batch_result.cached_urls}
        
        # Organize results by deck and card
        for file_path, url in all_successful_urls.items():
            # Find the corresponding task in the collection
            found = False
            
            # Check deck images
            for deck_name, deck_images in collection.deck_images.items():
                if deck_images.border_image == file_path:
                    if deck_name not in results['deck_images']:
                        results['deck_images'][deck_name] = {}
                    results['deck_images'][deck_name]['card_back_image_url'] = url
                    found = True
                    break
                elif deck_images.background_image == file_path:
                    if deck_name not in results['deck_images']:
                        results['deck_images'][deck_name] = {}
                    results['deck_images'][deck_name]['bg_image_url'] = url
                    found = True
                    break
                else:
                    # Check category images
                    for category, category_path in deck_images.category_images.items():
                        if category_path == file_path:
                            if deck_name not in results['deck_images']:
                                results['deck_images'][deck_name] = {}
                            if 'category_images' not in results['deck_images'][deck_name]:
                                results['deck_images'][deck_name]['category_images'] = {}
                            results['deck_images'][deck_name]['category_images'][category] = url
                            found = True
                            break
                    if found:
                        break
            
            # Check card images
            if not found:
                for card_image in collection.card_images:
                    if card_image.file_path == file_path:
                        deck_name = card_image.deck_name
                        card_name = card_image.card_name
                        
                        if deck_name not in results['card_images']:
                            results['card_images'][deck_name] = {}
                        
                        if card_name not in results['card_images'][deck_name]:
                            results['card_images'][deck_name][card_name] = {}
                        
                        # Handle locale-specific vs generic images
                        if card_image.locale:
                            # Store locale-specific image URL
                            if 'locale_images' not in results['card_images'][deck_name][card_name]:
                                results['card_images'][deck_name][card_name]['locale_images'] = {}
                            results['card_images'][deck_name][card_name]['locale_images'][card_image.locale] = url
                            logger.debug(f"  Stored locale-specific image for {card_name} ({card_image.locale}): {url}")
                        else:
                            # Store generic image URL (fallback)
                            results['card_images'][deck_name][card_name]['generic_image'] = url
                            logger.debug(f"  Stored generic image for {card_name}: {url}")
                        
                        found = True
                        break
        
        # Process layout configurations
        for deck_name, layout_path in collection.layout_configs.items():
            logger.info(f"Processing layout config for: {deck_name}")
            
            try:
                with open(layout_path, 'r', encoding='utf-8') as f:
                    layout_data = json.load(f)
                
                # Validate that the layout data has expected structure
                if not isinstance(layout_data, dict):
                    logger.warning(f"  Layout config is not a JSON object: {layout_path}")
                    continue
                
                # Ensure deck entry exists in results
                if deck_name not in results['deck_images']:
                    results['deck_images'][deck_name] = {}
                
                results['deck_images'][deck_name]['layout_config'] = layout_data
                logger.info(f"  ✅ Successfully loaded layout configuration from: {layout_path}")
                
            except json.JSONDecodeError as e:
                logger.error(f"  ❌ Invalid JSON in layout config {layout_path}: {e}")
            except FileNotFoundError:
                logger.error(f"  ❌ Layout config file not found: {layout_path}")
            except Exception as e:
                logger.error(f"  ❌ Unexpected error loading layout config {layout_path}: {e}")
        
        # Write JSON output if requested
        if output_json:
            try:
                # Create a clean format for seed generator integration
                # Only include deck_images and card_images as specified in task requirements
                clean_output = {
                    'deck_images': results['deck_images'],
                    'card_images': results['card_images']
                }
                
                with open(output_json, 'w', encoding='utf-8') as f:
                    json.dump(clean_output, f, indent=2, ensure_ascii=False)
                logger.info(f"📄 JSON output written to: {output_json}")
            except Exception as e:
                logger.error(f"Failed to write JSON output to {output_json}: {e}")
        
        return results
        
    except Exception as e:
        logger.error(f"❌ Unexpected error during image processing: {e}")
        return {
            'deck_images': {},
            'card_images': {},
            'layout_configs': {},
            'summary': {
                'total_processed': 0,
                'successful_uploads': 0,
                'failed_uploads': 0,
                'cached_urls': 0
            }
        }
    
    finally:
        # Clean up uploader
        if 'uploader' in locals():
            uploader.__exit__(None, None, None)


def print_summary(results: Dict[str, Any], dry_run: bool = False, verbosity_level: str = "normal") -> None:
    """Print a human-readable summary of the processing results with configurable verbosity."""
    summary = results['summary']
    
    # Map user-friendly verbosity levels to internal levels
    verbosity_mapping = {
        'quiet': 'ERROR',
        'normal': 'INFO',
        'verbose': 'INFO',
        'debug': 'DEBUG'
    }
    internal_verbosity = verbosity_mapping.get(verbosity_level, 'INFO')
    
    print("\n" + "="*60)
    print("📊 IMAGE PROCESSING SUMMARY")
    print("="*60)
    
    # Basic mode and statistics (always shown unless quiet)
    if verbosity_level != 'quiet':
        if dry_run:
            print("🔍 Mode: DRY RUN (no actual uploads performed)")
        else:
            print("🚀 Mode: LIVE (actual uploads performed)")
        
        print(f"📁 Total images processed: {summary['total_processed']}")
        print(f"✅ Successful uploads: {summary['successful_uploads']}")
        print(f"❌ Failed uploads: {summary['failed_uploads']}")
        print(f"💾 Cached URLs used: {summary['cached_urls']}")
        
        # Calculate and show success rate
        total_successful = summary['successful_uploads'] + summary['cached_urls']
        if summary['total_processed'] > 0:
            success_rate = (total_successful / summary['total_processed']) * 100
            print(f"📈 Success rate: {success_rate:.1f}%")
    
    # Show detailed breakdown based on verbosity level
    if verbosity_level in ["verbose", "debug"]:
        # Deck images summary
        deck_count = len(results['deck_images'])
        if deck_count > 0:
            print(f"\n🎴 Deck Images ({deck_count} decks):")
            for deck_name, deck_data in results['deck_images'].items():
                print(f"  • {deck_name}:")
                
                # Count different types of deck images
                deck_image_count = 0
                if 'card_back_image_url' in deck_data:
                    print(f"    - Card back image: ✅")
                    deck_image_count += 1
                if 'bg_image_url' in deck_data:
                    print(f"    - Background image: ✅")
                    deck_image_count += 1
                if 'category_images' in deck_data:
                    category_count = len(deck_data['category_images'])
                    print(f"    - Category images: {category_count}")
                    deck_image_count += category_count
                    
                    # Show category details for DEBUG level
                    if verbosity_level == "debug" and category_count > 0:
                        for category in deck_data['category_images'].keys():
                            print(f"      • {category}")
                
                if 'layout_config' in deck_data:
                    print(f"    - Layout config: ✅")
                
                # Show total for this deck
                if verbosity_level == "debug":
                    print(f"    Total: {deck_image_count} images")
        
        # Card images summary
        total_cards = sum(len(cards) for cards in results['card_images'].values())
        if total_cards > 0:
            print(f"\n🃏 Card Images ({total_cards} cards):")
            for deck_name, cards in results['card_images'].items():
                card_count = len(cards)
                print(f"  • {deck_name}: {card_count} cards")
                
                # Show individual card names for DEBUG level
                if verbosity_level == "debug" and card_count > 0:
                    for card_name in sorted(cards.keys()):
                        print(f"    - {card_name}")
    
    # Show timing information for DEBUG level
    if verbosity_level == "debug" and 'timing' in summary:
        timing = summary['timing']
        print(f"\n⏱️  Timing Information:")
        print(f"  • Total time: {timing.get('total_time', 0):.2f}s")
        print(f"  • Average per file: {timing.get('avg_per_file', 0):.2f}s")
        if timing.get('cache_hits', 0) > 0:
            print(f"  • Cache lookup time: {timing.get('cache_time', 0):.2f}s")
        if timing.get('upload_time', 0) > 0:
            print(f"  • Upload time: {timing.get('upload_time', 0):.2f}s")
    
    # Show error details for verbose and debug levels
    if verbosity_level in ["verbose", "debug"] and summary['failed_uploads'] > 0:
        print(f"\n❌ Failed Upload Details:")
        # This would need to be populated by the calling function
        # For now, just indicate that failures occurred
        print(f"  • {summary['failed_uploads']} files failed to upload")
        print(f"  • Check logs for detailed error information")
    
    # Show cache statistics for DEBUG level
    if verbosity_level == "debug" and summary['cached_urls'] > 0:
        cache_percentage = (summary['cached_urls'] / summary['total_processed']) * 100
        print(f"\n💾 Cache Performance:")
        print(f"  • Cache hit rate: {cache_percentage:.1f}%")
        print(f"  • Files served from cache: {summary['cached_urls']}")
        print(f"  • Files uploaded fresh: {summary['successful_uploads']}")
    
    # Only show separator for non-quiet mode
    if verbosity_level != 'quiet':
        print("="*60)
    
    # Show next steps or recommendations based on results
    if verbosity_level in ["normal", "verbose", "debug"]:
        if dry_run:
            print("\n💡 This was a dry run. Use without --dry-run to perform actual uploads.")
        elif summary['failed_uploads'] > 0:
            print("\n💡 Some uploads failed. Check the logs above for details and retry if needed.")
        elif summary['total_processed'] == 0:
            print("\n💡 No images found. Check your file paths and filters.")
        else:
            print("\n✨ All images processed successfully!")
    
    # Only show final newline for non-quiet mode
    if verbosity_level != 'quiet':
        print()


def handle_cache_management(args, logger, config: ImageUploadConfig) -> bool:
    """
    Handle cache management commands.
    
    Args:
        args: Parsed command line arguments
        logger: Logger instance
        config: Configuration object
        
    Returns:
        True if a cache management command was executed, False otherwise
    """
    # Check if any cache management command was requested
    cache_commands = [args.clear_cache, args.validate_cache, args.list_cache, args.cache_stats]
    if not any(cache_commands):
        return False
    
    # Initialize cache manager with configured cache file
    cache_manager = ImageCacheManager(config.files.cache_file)
    
    try:
        if args.clear_cache:
            logger.info("🗑️  Clearing image cache...")
            cache_manager.clear_cache()
            print("✅ Cache cleared successfully")
        
        if args.validate_cache:
            logger.info("🔍 Validating cached URLs...")
            removed_count = cache_manager.remove_invalid_urls()
            if removed_count > 0:
                print(f"✅ Removed {removed_count} invalid URLs from cache")
            else:
                print("✅ All cached URLs are valid")
        
        if args.list_cache:
            logger.info("📋 Listing cache entries...")
            entries = cache_manager.list_cache_entries()
            
            if not entries:
                print("📭 Cache is empty")
            else:
                print(f"📋 Cache contains {len(entries)} entries:")
                print("-" * 80)
                
                for i, entry in enumerate(entries, 1):
                    file_path = entry.get("file_path", "Unknown")
                    url = entry.get("url", "Unknown")
                    uploaded_at = entry.get("uploaded_at", "Unknown")
                    file_size = entry.get("file_size")
                    
                    print(f"{i:3d}. {Path(file_path).name}")
                    print(f"     Path: {file_path}")
                    print(f"     URL:  {url}")
                    print(f"     Date: {uploaded_at}")
                    if file_size:
                        print(f"     Size: {file_size:,} bytes")
                    print()
        
        if args.cache_stats:
            logger.info("📊 Getting cache statistics...")
            stats = cache_manager.get_cache_stats()
            
            print("📊 Cache Statistics:")
            print("-" * 40)
            print(f"Cache file:     {stats.get('cache_file', 'Unknown')}")
            print(f"Cache version:  {stats.get('cache_version', 'Unknown')}")
            print(f"Total entries:  {stats.get('total_entries', 0):,}")
            
            total_size = stats.get('total_file_size', 0)
            if total_size > 0:
                if total_size > 1024 * 1024:
                    print(f"Total size:     {total_size / (1024 * 1024):.1f} MB")
                elif total_size > 1024:
                    print(f"Total size:     {total_size / 1024:.1f} KB")
                else:
                    print(f"Total size:     {total_size} bytes")
            
            created_at = stats.get('created_at')
            if created_at:
                print(f"Created:        {created_at}")
            
            last_updated = stats.get('last_updated')
            if last_updated:
                print(f"Last updated:   {last_updated}")
            
            oldest_entry = stats.get('oldest_entry')
            if oldest_entry:
                print(f"Oldest entry:   {oldest_entry}")
            
            newest_entry = stats.get('newest_entry')
            if newest_entry:
                print(f"Newest entry:   {newest_entry}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Cache management error: {e}")
        print(f"❌ Error: {e}")
        return True  # Still return True since we handled a cache command
    
    finally:
        cache_manager.__exit__(None, None, None)


def main():
    """Main entry point for the upload_images script."""
    """
    Handle cache management commands.
    
    Args:
        args: Parsed command line arguments
        logger: Logger instance
        
    Returns:
        True if a cache management command was executed, False otherwise
    """
    from image_cache_manager import ImageCacheManager
    
    # Check if any cache management command was requested
    cache_commands = [args.clear_cache, args.validate_cache, args.list_cache, args.cache_stats]
    if not any(cache_commands):
        return False
    
    # Initialize cache manager
    cache_manager = ImageCacheManager()
    
    try:
        if args.clear_cache:
            logger.info("🗑️  Clearing image cache...")
            cache_manager.clear_cache()
            print("✅ Cache cleared successfully")
        
        if args.validate_cache:
            logger.info("🔍 Validating cached URLs...")
            removed_count = cache_manager.remove_invalid_urls()
            if removed_count > 0:
                print(f"✅ Removed {removed_count} invalid URLs from cache")
            else:
                print("✅ All cached URLs are valid")
        
        if args.list_cache:
            logger.info("📋 Listing cache entries...")
            entries = cache_manager.list_cache_entries()
            
            if not entries:
                print("📭 Cache is empty")
            else:
                print(f"📋 Cache contains {len(entries)} entries:")
                print("-" * 80)
                
                for i, entry in enumerate(entries, 1):
                    file_path = entry.get("file_path", "Unknown")
                    url = entry.get("url", "Unknown")
                    uploaded_at = entry.get("uploaded_at", "Unknown")
                    file_size = entry.get("file_size")
                    
                    print(f"{i:3d}. {Path(file_path).name}")
                    print(f"     Path: {file_path}")
                    print(f"     URL:  {url}")
                    print(f"     Date: {uploaded_at}")
                    if file_size:
                        print(f"     Size: {file_size:,} bytes")
                    print()
        
        if args.cache_stats:
            logger.info("📊 Getting cache statistics...")
            stats = cache_manager.get_cache_stats()
            
            print("📊 Cache Statistics:")
            print("-" * 40)
            print(f"Cache file:     {stats.get('cache_file', 'Unknown')}")
            print(f"Cache version:  {stats.get('cache_version', 'Unknown')}")
            print(f"Total entries:  {stats.get('total_entries', 0):,}")
            
            total_size = stats.get('total_file_size', 0)
            if total_size > 0:
                if total_size > 1024 * 1024:
                    print(f"Total size:     {total_size / (1024 * 1024):.1f} MB")
                elif total_size > 1024:
                    print(f"Total size:     {total_size / 1024:.1f} KB")
                else:
                    print(f"Total size:     {total_size} bytes")
            
            created_at = stats.get('created_at')
            if created_at:
                print(f"Created:        {created_at}")
            
            last_updated = stats.get('last_updated')
            if last_updated:
                print(f"Last updated:   {last_updated}")
            
            oldest_entry = stats.get('oldest_entry')
            if oldest_entry:
                print(f"Oldest entry:   {oldest_entry}")
            
            newest_entry = stats.get('newest_entry')
            if newest_entry:
                print(f"Newest entry:   {newest_entry}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Cache management error: {e}")
        print(f"❌ Error: {e}")
        return True  # Still return True since we handled a cache command
    
    finally:
        cache_manager.__exit__(None, None, None)


def main():
    """Main entry point for the upload_images script."""
    parser = argparse.ArgumentParser(
        description="Upload images for card deck system to UploadThing service",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process all images in dry-run mode
  python upload_images.py --dry-run
  
  # Process only the 'default' deck
  python upload_images.py --deck default
  
  # Process only protagonist cards
  python upload_images.py --category protagonists
  
  # Process a specific card
  python upload_images.py --card "The Clever Thief"
  
  # Generate JSON output for seed generator integration
  python upload_images.py --deck default --output-json urls.json
  
  # Verbose logging with detailed progress
  python upload_images.py --verbosity debug --deck default
  
  # Quiet mode (errors only)
  python upload_images.py --verbosity quiet --deck default
  
  # Cache management commands
  python upload_images.py --clear-cache
  python upload_images.py --validate-cache
  python upload_images.py --list-cache
  python upload_images.py --cache-stats
  
  # Configuration options
  python upload_images.py --config-file my_config.json
  python upload_images.py --save-config-template
  python upload_images.py --max-concurrent 8 --timeout 60
        """
    )
    
    # Configuration options
    parser.add_argument(
        '--config-file',
        type=str,
        help='Path to JSON configuration file'
    )
    
    parser.add_argument(
        '--save-config-template',
        action='store_true',
        help='Save a configuration template file and exit'
    )
    
    # Filtering options
    parser.add_argument(
        '--deck',
        type=str,
        help='Process only the specified deck name'
    )
    
    parser.add_argument(
        '--category',
        type=str,
        help='Process only the specified category (protagonists, antagonists, settings, etc.)'
    )
    
    parser.add_argument(
        '--card',
        type=str,
        help='Process only the specified card name'
    )
    
    # Output options
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simulate uploads without actually uploading files'
    )
    
    parser.add_argument(
        '--output-json',
        type=str,
        help='Write results to JSON file (for integration with generate_seed.py)'
    )
    
    # Logging options
    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        help='Set logging level (overrides config file)'
    )
    
    parser.add_argument(
        '--verbosity',
        choices=['quiet', 'normal', 'verbose', 'debug'],
        default='normal',
        help='Set progress reporting verbosity: quiet (errors only), normal (standard), verbose (detailed), debug (everything)'
    )
    
    # Configuration overrides
    parser.add_argument(
        '--max-concurrent',
        type=int,
        help='Maximum number of concurrent uploads (1-20, overrides config)'
    )
    
    parser.add_argument(
        '--timeout',
        type=int,
        help='Request timeout in seconds (5-300, overrides config)'
    )
    
    parser.add_argument(
        '--retry-attempts',
        type=int,
        help='Number of retry attempts (1-10, overrides config)'
    )
    
    parser.add_argument(
        '--max-file-size',
        type=int,
        help='Maximum file size in MB (1-50, overrides config)'
    )
    
    parser.add_argument(
        '--supported-extensions',
        type=str,
        help='Comma-separated list of supported extensions (e.g., .jpg,.png,.webp)'
    )
    
    # Cache management options
    parser.add_argument(
        '--clear-cache',
        action='store_true',
        help='Clear the image upload cache'
    )
    
    parser.add_argument(
        '--validate-cache',
        action='store_true',
        help='Validate cached URLs and remove invalid ones'
    )
    
    parser.add_argument(
        '--list-cache',
        action='store_true',
        help='List all cached image URLs'
    )
    
    parser.add_argument(
        '--cache-stats',
        action='store_true',
        help='Show cache statistics'
    )
    
    # Base path option
    parser.add_argument(
        '--base-path',
        type=str,
        default='specs/decks',
        help='Base directory to search for decks (default: specs/decks)'
    )
    
    args = parser.parse_args()
    
    # Handle save config template
    if args.save_config_template:
        from config import ConfigurationManager
        manager = ConfigurationManager()
        manager.save_config_template()
        return
    
    try:
        # Load configuration
        config_manager = get_config_manager(args.config_file)
        
        # For cache management and dry-run, we can skip credential validation
        cache_commands = [args.clear_cache, args.validate_cache, args.list_cache, args.cache_stats]
        if any(cache_commands) or args.dry_run:
            # Load config without credential validation for these operations
            try:
                config = config_manager.load_config()
            except SystemExit:
                # If credentials are missing but we're doing cache management or dry-run, create minimal config
                from config import ImageUploadConfig
                config = ImageUploadConfig()
                # Still load environment variables for other settings
                config_manager._load_from_environment(config)
                if args.config_file:
                    config_manager._load_from_json_file(config, args.config_file)
        else:
            config = config_manager.load_config()
        
        # Apply command line overrides
        if args.log_level:
            config.logging.level = args.log_level
        
        if args.max_concurrent:
            config.upload.max_concurrent_uploads = args.max_concurrent
        
        if args.timeout:
            config.retry.timeout_seconds = args.timeout
        
        if args.retry_attempts:
            config.retry.max_attempts = args.retry_attempts
        
        if args.max_file_size:
            config.upload.max_file_size_mb = args.max_file_size
        
        if args.supported_extensions:
            extensions = {ext.strip() for ext in args.supported_extensions.split(',') if ext.strip()}
            config.files.supported_extensions = extensions
        
        # Set up logging with configuration
        logger = setup_logging(config)
        
        # Map verbosity to progress reporting level
        verbosity_mapping = {
            'quiet': 'ERROR',
            'normal': 'INFO', 
            'verbose': 'INFO',
            'debug': 'DEBUG'
        }
        progress_verbosity = verbosity_mapping.get(args.verbosity, 'INFO')
        
        # Handle cache management commands first
        if handle_cache_management(args, logger, config):
            return  # Exit after handling cache commands
        
        logger.info("🚀 Starting image upload process with comprehensive configuration")
        logger.debug(f"Configuration: max_concurrent={config.upload.max_concurrent_uploads}, "
                    f"timeout={config.retry.timeout_seconds}s, "
                    f"retry_attempts={config.retry.max_attempts}, "
                    f"max_file_size={config.upload.max_file_size_mb}MB")
        
        # Discover images
        logger.info("🔍 Discovering images...")
        discovered = discover_images(
            config=config,
            base_path=args.base_path,
            deck_filter=args.deck,
            category_filter=args.category,
            card_filter=args.card
        )
        
        if not any([discovered['deck_images'], discovered['card_images'], discovered['layout_configs']]):
            logger.warning("⚠️  No images or configurations found matching the specified criteria")
            return
        
        # Process images
        logger.info("🚀 Processing images...")
        results = process_images(
            config=config,
            discovered_images=discovered,
            dry_run=args.dry_run,
            output_json=args.output_json,
            verbosity_level=progress_verbosity
        )
        
        # Print summary
        print_summary(results, dry_run=args.dry_run, verbosity_level=args.verbosity)
        
        logger.info("✅ Image processing completed successfully")
        
    except KeyboardInterrupt:
        logger.info("⏹️  Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        # Set up basic logging if config loading failed
        if 'logger' not in locals():
            logger = logging.getLogger('upload_images')
            logging.basicConfig(level=logging.ERROR)
        
        logger.error(f"❌ Unexpected error: {e}")
        if hasattr(args, 'log_level') and args.log_level == 'DEBUG':
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()