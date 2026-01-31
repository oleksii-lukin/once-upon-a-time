#!/usr/bin/env python3
"""
Image Cache Manager for Card Deck System

This module provides the ImageCacheManager class that handles persistent caching
of uploaded image URLs to avoid duplicate uploads. It uses MD5 hashing to detect
file changes and validates cached URLs are still accessible.

Features:
- Persistent cache file (image_cache.json) with MD5 hashing
- Cache validation and URL verification (check for 404s)
- Cache management commands (clear, validate, list)
- Thread-safe operations with file locking
- Comprehensive error handling and logging
"""

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Any, List, Tuple
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import fcntl


class ImageCacheManager:
    """
    Manages persistent caching of uploaded image URLs to avoid duplicate uploads.
    
    The cache uses MD5 hashing to detect file changes and validates cached URLs
    are still accessible. It provides thread-safe operations and comprehensive
    error handling.
    """
    
    # Cache file format version
    CACHE_VERSION = "1.0"
    
    # Default cache file name
    DEFAULT_CACHE_FILE = "image_cache.json"
    
    # URL validation timeout
    URL_VALIDATION_TIMEOUT = 10
    
    # Maximum age for cache entries (in seconds) - 30 days
    MAX_CACHE_AGE = 30 * 24 * 60 * 60
    
    def __init__(self, cache_file: str = DEFAULT_CACHE_FILE):
        """
        Initialize the ImageCacheManager.
        
        Args:
            cache_file: Path to the cache file (default: image_cache.json)
        """
        self.cache_file = Path(cache_file)
        self.logger = logging.getLogger('image_cache_manager')
        
        # Configure session for URL validation
        self.session = requests.Session()
        
        # Set up retry strategy for URL validation
        retry_strategy = Retry(
            total=2,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504],  # Server errors only
            allowed_methods=["HEAD", "GET"],
            raise_on_status=False
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set default headers
        self.session.headers.update({
            'User-Agent': 'Python-ImageCache-Validator/1.0'
        })
        
        # Initialize cache if it doesn't exist
        self._initialize_cache()
    
    def _initialize_cache(self) -> None:
        """Initialize the cache file if it doesn't exist or is corrupted."""
        if not self.cache_file.exists():
            self.logger.info(f"Creating new cache file: {self.cache_file}")
            self._create_empty_cache()
        else:
            # Validate existing cache file
            try:
                self._load_cache()
                self.logger.debug(f"Loaded existing cache file: {self.cache_file}")
            except Exception as e:
                self.logger.warning(f"Cache file corrupted, recreating: {e}")
                self._create_empty_cache()
    
    def _create_empty_cache(self) -> None:
        """Create an empty cache file with the correct structure."""
        empty_cache = {
            "version": self.CACHE_VERSION,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "entries": {}
        }
        
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                # Acquire exclusive lock
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                json.dump(empty_cache, f, indent=2, ensure_ascii=False)
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            
            self.logger.info(f"Created empty cache file: {self.cache_file}")
            
        except Exception as e:
            self.logger.error(f"Failed to create cache file {self.cache_file}: {e}")
            raise
    
    def _load_cache(self) -> Dict[str, Any]:
        """
        Load cache data from file with file locking.
        
        Returns:
            Dictionary containing cache data
            
        Raises:
            Exception: If cache file is corrupted or cannot be read
        """
        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                # Acquire shared lock for reading
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                cache_data = json.load(f)
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            
            # Validate cache structure
            if not isinstance(cache_data, dict):
                raise ValueError("Cache data is not a JSON object")
            
            if "entries" not in cache_data:
                raise ValueError("Cache data missing 'entries' field")
            
            if not isinstance(cache_data["entries"], dict):
                raise ValueError("Cache 'entries' field is not a JSON object")
            
            # Check version compatibility
            cache_version = cache_data.get("version", "unknown")
            if cache_version != self.CACHE_VERSION:
                self.logger.warning(f"Cache version mismatch: {cache_version} != {self.CACHE_VERSION}")
                # For now, we'll continue with version mismatches
                # In the future, we might implement migration logic
            
            return cache_data
            
        except FileNotFoundError:
            raise Exception(f"Cache file not found: {self.cache_file}")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON in cache file: {e}")
        except Exception as e:
            raise Exception(f"Failed to load cache file: {e}")
    
    def _save_cache(self, cache_data: Dict[str, Any]) -> None:
        """
        Save cache data to file with file locking.
        
        Args:
            cache_data: Dictionary containing cache data to save
            
        Raises:
            Exception: If cache file cannot be written
        """
        try:
            # Update timestamp
            cache_data["last_updated"] = datetime.now(timezone.utc).isoformat()
            
            # Write to temporary file first, then rename for atomic operation
            temp_file = self.cache_file.with_suffix('.tmp')
            
            with open(temp_file, 'w', encoding='utf-8') as f:
                # Acquire exclusive lock
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                json.dump(cache_data, f, indent=2, ensure_ascii=False)
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            
            # Atomic rename
            temp_file.replace(self.cache_file)
            
            self.logger.debug(f"Saved cache data to: {self.cache_file}")
            
        except Exception as e:
            # Clean up temporary file if it exists
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception:
                    pass
            
            self.logger.error(f"Failed to save cache file {self.cache_file}: {e}")
            raise
    
    def calculate_file_hash(self, file_path: str) -> str:
        """
        Calculate MD5 hash of a file for caching purposes.
        
        Args:
            file_path: Path to the file
            
        Returns:
            MD5 hash as hexadecimal string, empty string if error
        """
        try:
            hash_md5 = hashlib.md5()
            
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    hash_md5.update(chunk)
            
            return hash_md5.hexdigest()
            
        except Exception as e:
            self.logger.error(f"Error calculating hash for {file_path}: {e}")
            return ""
    
    def _generate_cache_key(self, file_path: str, file_hash: str) -> str:
        """
        Generate a cache key from file path and hash.
        
        Args:
            file_path: Path to the file
            file_hash: MD5 hash of the file
            
        Returns:
            Cache key string
        """
        # Use a combination of normalized path and hash for the key
        normalized_path = str(Path(file_path).resolve())
        key_data = f"{normalized_path}:{file_hash}"
        return hashlib.sha256(key_data.encode('utf-8')).hexdigest()
    
    def get_cached_url(self, file_path: str, file_hash: str) -> Optional[str]:
        """
        Get cached URL for a file if it exists and is valid.
        
        Args:
            file_path: Path to the file
            file_hash: MD5 hash of the file
            
        Returns:
            Cached URL if found and valid, None otherwise
        """
        try:
            cache_data = self._load_cache()
            cache_key = self._generate_cache_key(file_path, file_hash)
            
            if cache_key not in cache_data["entries"]:
                self.logger.debug(f"No cache entry found for: {file_path}")
                return None
            
            entry = cache_data["entries"][cache_key]
            
            # Validate entry structure
            required_fields = ["file_path", "file_hash", "url", "uploaded_at"]
            for field in required_fields:
                if field not in entry:
                    self.logger.warning(f"Cache entry missing field '{field}': {cache_key}")
                    return None
            
            # Check if file hash matches (file hasn't changed)
            if entry["file_hash"] != file_hash:
                self.logger.debug(f"File hash mismatch for {file_path}: cached={entry['file_hash']}, current={file_hash}")
                return None
            
            # Check if entry is too old
            try:
                uploaded_at = datetime.fromisoformat(entry["uploaded_at"].replace('Z', '+00:00'))
                age = (datetime.now(timezone.utc) - uploaded_at).total_seconds()
                
                if age > self.MAX_CACHE_AGE:
                    self.logger.debug(f"Cache entry too old for {file_path}: {age} seconds")
                    return None
                    
            except (ValueError, TypeError) as e:
                self.logger.warning(f"Invalid timestamp in cache entry: {e}")
                return None
            
            url = entry["url"]
            self.logger.debug(f"Found cached URL for {file_path}: {url}")
            return url
            
        except Exception as e:
            self.logger.error(f"Error retrieving cached URL for {file_path}: {e}")
            return None
    
    def cache_url(self, file_path: str, file_hash: str, url: str) -> None:
        """
        Cache a URL for a file.
        
        Args:
            file_path: Path to the file
            file_hash: MD5 hash of the file
            url: URL to cache
        """
        try:
            cache_data = self._load_cache()
            cache_key = self._generate_cache_key(file_path, file_hash)
            
            # Get file size for metadata
            file_size = None
            try:
                file_size = os.path.getsize(file_path)
            except Exception:
                pass
            
            # Create cache entry
            entry = {
                "file_path": str(Path(file_path).resolve()),
                "file_hash": file_hash,
                "url": url,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "file_size": file_size
            }
            
            cache_data["entries"][cache_key] = entry
            self._save_cache(cache_data)
            
            self.logger.debug(f"Cached URL for {file_path}: {url}")
            
        except Exception as e:
            self.logger.error(f"Error caching URL for {file_path}: {e}")
    
    def validate_url(self, url: str) -> bool:
        """
        Validate that a URL is still accessible (not 404).
        
        Args:
            url: URL to validate
            
        Returns:
            True if URL is accessible, False otherwise
        """
        try:
            self.logger.debug(f"Validating URL: {url}")
            
            # Use HEAD request first (faster)
            response = self.session.head(url, timeout=self.URL_VALIDATION_TIMEOUT, allow_redirects=True)
            
            # If HEAD is not allowed, try GET
            if response.status_code == 405:  # Method Not Allowed
                response = self.session.get(url, timeout=self.URL_VALIDATION_TIMEOUT, allow_redirects=True, stream=True)
                # Close the connection immediately since we only need the status
                response.close()
            
            is_valid = response.status_code == 200
            
            if is_valid:
                self.logger.debug(f"URL is valid: {url}")
            else:
                self.logger.debug(f"URL returned status {response.status_code}: {url}")
            
            return is_valid
            
        except requests.exceptions.Timeout:
            self.logger.debug(f"URL validation timeout: {url}")
            return False
        except requests.exceptions.ConnectionError:
            self.logger.debug(f"URL validation connection error: {url}")
            return False
        except requests.exceptions.RequestException as e:
            self.logger.debug(f"URL validation request error for {url}: {e}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error validating URL {url}: {e}")
            return False
    
    def remove_invalid_urls(self) -> int:
        """
        Remove invalid URLs from the cache.
        
        Returns:
            Number of invalid URLs removed
        """
        try:
            cache_data = self._load_cache()
            entries = cache_data["entries"]
            
            if not entries:
                self.logger.info("No cache entries to validate")
                return 0
            
            self.logger.info(f"Validating {len(entries)} cached URLs...")
            
            invalid_keys = []
            validated_count = 0
            
            for cache_key, entry in entries.items():
                url = entry.get("url")
                if not url:
                    invalid_keys.append(cache_key)
                    continue
                
                if not self.validate_url(url):
                    invalid_keys.append(cache_key)
                    self.logger.info(f"Removing invalid URL: {url}")
                
                validated_count += 1
                
                # Log progress for large caches
                if validated_count % 10 == 0:
                    self.logger.info(f"Validated {validated_count}/{len(entries)} URLs...")
            
            # Remove invalid entries
            for cache_key in invalid_keys:
                del entries[cache_key]
            
            if invalid_keys:
                self._save_cache(cache_data)
                self.logger.info(f"Removed {len(invalid_keys)} invalid URLs from cache")
            else:
                self.logger.info("All cached URLs are valid")
            
            return len(invalid_keys)
            
        except Exception as e:
            self.logger.error(f"Error validating cache URLs: {e}")
            return 0
    
    def clear_cache(self) -> None:
        """Clear all entries from the cache."""
        try:
            self.logger.info("Clearing cache...")
            self._create_empty_cache()
            self.logger.info("Cache cleared successfully")
            
        except Exception as e:
            self.logger.error(f"Error clearing cache: {e}")
            raise
    
    def list_cache_entries(self) -> List[Dict[str, Any]]:
        """
        List all cache entries with their metadata.
        
        Returns:
            List of cache entry dictionaries
        """
        try:
            cache_data = self._load_cache()
            entries = []
            
            for cache_key, entry in cache_data["entries"].items():
                # Add cache key to entry for reference
                entry_with_key = entry.copy()
                entry_with_key["cache_key"] = cache_key
                entries.append(entry_with_key)
            
            # Sort by upload date (newest first)
            entries.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
            
            return entries
            
        except Exception as e:
            self.logger.error(f"Error listing cache entries: {e}")
            return []
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        try:
            cache_data = self._load_cache()
            entries = cache_data["entries"]
            
            # Calculate statistics
            total_entries = len(entries)
            total_size = 0
            oldest_entry = None
            newest_entry = None
            
            for entry in entries.values():
                # File size
                if entry.get("file_size"):
                    total_size += entry["file_size"]
                
                # Timestamps
                uploaded_at = entry.get("uploaded_at")
                if uploaded_at:
                    if oldest_entry is None or uploaded_at < oldest_entry:
                        oldest_entry = uploaded_at
                    if newest_entry is None or uploaded_at > newest_entry:
                        newest_entry = uploaded_at
            
            stats = {
                "cache_file": str(self.cache_file),
                "cache_version": cache_data.get("version", "unknown"),
                "created_at": cache_data.get("created_at"),
                "last_updated": cache_data.get("last_updated"),
                "total_entries": total_entries,
                "total_file_size": total_size,
                "oldest_entry": oldest_entry,
                "newest_entry": newest_entry
            }
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Error getting cache stats: {e}")
            return {
                "cache_file": str(self.cache_file),
                "error": str(e)
            }
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - close session."""
        if hasattr(self, 'session'):
            self.session.close()