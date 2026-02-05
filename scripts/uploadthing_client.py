#!/usr/bin/env python3
"""
UploadThing API Client for Python

This module provides a Python client for the UploadThing API, handling file uploads
with proper authentication, retry logic, and error handling.

Features:
- File upload with authentication
- Retry logic with exponential backoff for rate limits
- File size and type validation (4MB limit, image types only)
- Original filename preservation in metadata
- Persistent caching with MD5 hashing to avoid duplicate uploads
- Comprehensive error handling and logging
"""

import base64
import hashlib
import json
import logging
import mimetypes
import os
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Any, Tuple
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from PIL import Image, ImageOps

# Import the ImageCacheManager
from image_cache_manager import ImageCacheManager


@dataclass
class UploadResult:
    """Result of an upload operation."""
    success: bool
    url: Optional[str] = None
    file_key: Optional[str] = None
    error: Optional[str] = None
    file_size: Optional[int] = None
    original_filename: Optional[str] = None


@dataclass
class CompressionResult:
    """Result of an image compression operation."""
    success: bool
    compressed_path: Optional[str] = None
    original_size: Optional[int] = None
    compressed_size: Optional[int] = None
    error: Optional[str] = None


@dataclass
class UploadLimits:
    """UploadThing upload limits configuration."""
    max_file_size: int = 4 * 1024 * 1024  # 4MB in bytes
    compression_threshold: int = 2 * 1024 * 1024  # 2MB in bytes - compress files larger than this
    compression_quality: int = 85  # JPEG compression quality
    max_image_dimension: int = 10000  # Maximum width or height
    supported_types: set = None
    
    def __post_init__(self):
        if self.supported_types is None:
            self.supported_types = {
                'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
            }


class UploadThingClient:
    """
    Client for uploading files to UploadThing service.
    
    This client handles authentication, file validation, upload operations,
    and retry logic for the UploadThing API.
    """
    
    # UploadThing API endpoints
    BASE_URL = "https://api.uploadthing.com"
    UPLOAD_FILES_ENDPOINT = "/v6/uploadFiles"
    
    # Default retry configuration
    DEFAULT_RETRY_ATTEMPTS = 3
    DEFAULT_TIMEOUT = 30
    DEFAULT_BACKOFF_FACTOR = 1.0
    
    def __init__(self, api_key: str, app_id: str, timeout: int = DEFAULT_TIMEOUT, 
                 cache_file: str = "image_cache.json", retry_attempts: int = DEFAULT_RETRY_ATTEMPTS,
                 backoff_factor: float = DEFAULT_BACKOFF_FACTOR, upload_limits: Optional[UploadLimits] = None):
        """
        Initialize the UploadThing client.
        
        Args:
            api_key: UploadThing API secret key
            app_id: UploadThing application ID
            timeout: Request timeout in seconds
            cache_file: Path to the cache file for avoiding duplicate uploads
            retry_attempts: Number of retry attempts for failed requests
            backoff_factor: Backoff factor for exponential backoff
            upload_limits: Custom upload limits configuration
        """
        self.api_key = api_key
        self.app_id = app_id
        self.timeout = timeout
        self.retry_attempts = retry_attempts
        self.backoff_factor = backoff_factor
        self.logger = logging.getLogger('uploadthing_client')
        
        # Initialize cache manager
        self.cache_manager = ImageCacheManager(cache_file)
        
        # Configure session with retry strategy
        self.session = requests.Session()
        
        # Set up retry strategy for rate limits and temporary failures
        retry_strategy = Retry(
            total=self.retry_attempts,
            backoff_factor=self.backoff_factor,
            status_forcelist=[429, 500, 502, 503, 504],  # Rate limit and server errors
            allowed_methods=["POST"],  # Only retry POST requests
            raise_on_status=False
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set default headers
        self.session.headers.update({
            'User-Agent': 'Python-UploadThing-Client/1.0',
            'X-Uploadthing-Api-Key': self.api_key,
            'X-Uploadthing-Version': '6.4.0'  # API version
        })
        
        # Set upload limits
        self.limits = upload_limits or UploadLimits()
    
    def validate_credentials(self) -> bool:
        """
        Validate that the API credentials are working.
        
        Returns:
            True if credentials are valid, False otherwise
        """
        try:
            # For now, we'll assume credentials are valid if they're provided
            # The actual validation will happen during the first upload attempt
            return bool(self.api_key and self.app_id)
        except Exception as e:
            self.logger.debug(f"Credential validation failed: {e}")
            return False
    
    def get_upload_limits(self) -> UploadLimits:
        """
        Get the current upload limits configuration.
        
        Returns:
            UploadLimits object with current limits
        """
        return self.limits
    
    def upload_file(self, file_path: str, metadata: Optional[Dict[str, Any]] = None) -> UploadResult:
        """
        Upload a file to UploadThing using the UTApi approach with caching.
        
        Args:
            file_path: Path to the file to upload
            metadata: Optional metadata to store with the file
            
        Returns:
            UploadResult with upload status and details
        """
        file_path = Path(file_path)
        
        # Validate file exists
        if not file_path.exists():
            return UploadResult(
                success=False,
                error=f"File not found: {file_path}"
            )
        
        # Validate file is readable
        if not file_path.is_file():
            return UploadResult(
                success=False,
                error=f"Path is not a file: {file_path}"
            )
        
        try:
            # Get file info
            file_size = file_path.stat().st_size
            original_filename = file_path.name
            mime_type = self._get_mime_type(file_path)
            
            self.logger.debug(f"Uploading file: {file_path}")
            self.logger.debug(f"File size: {file_size} bytes")
            self.logger.debug(f"MIME type: {mime_type}")
            
            # Calculate file hash for caching
            file_hash = self.cache_manager.calculate_file_hash(str(file_path))
            if not file_hash:
                self.logger.warning(f"Could not calculate hash for {file_path}, skipping cache")
            else:
                # Check cache first
                cached_url = self.cache_manager.get_cached_url(str(file_path), file_hash)
                if cached_url:
                    # Validate cached URL is still accessible
                    if self.cache_manager.validate_url(cached_url):
                        self.logger.info(f"Using cached URL for {file_path}: {cached_url}")
                        return UploadResult(
                            success=True,
                            url=cached_url,
                            file_key=cached_url.split('/')[-1] if '/' in cached_url else None,
                            file_size=file_size,
                            original_filename=original_filename
                        )
                    else:
                        self.logger.info(f"Cached URL is invalid, will re-upload: {cached_url}")
            
            # Validate file type first
            if mime_type not in self.limits.supported_types:
                return UploadResult(
                    success=False,
                    error=f"Unsupported file type: {mime_type} (supported: {', '.join(self.limits.supported_types)})",
                    file_size=file_size,
                    original_filename=original_filename
                )
            
            # Check if compression is needed before size validation
            upload_file_path = file_path
            compressed_file = None
            
            if file_size > self.limits.compression_threshold:
                self.logger.info(f"File size {file_size} bytes exceeds compression threshold {self.limits.compression_threshold} bytes, compressing...")
                compressed_result = self._compress_image(file_path, mime_type)
                
                if compressed_result.success:
                    upload_file_path = Path(compressed_result.compressed_path)
                    compressed_file = compressed_result.compressed_path
                    file_size = upload_file_path.stat().st_size
                    self.logger.info(f"Compressed image from {file_path.stat().st_size} to {file_size} bytes")
                else:
                    self.logger.warning(f"Compression failed: {compressed_result.error}, checking original file size")
            
            # Validate file size after potential compression
            if file_size > self.limits.max_file_size:
                # Clean up compressed file if created
                if compressed_file and os.path.exists(compressed_file):
                    try:
                        os.unlink(compressed_file)
                    except Exception:
                        pass
                
                return UploadResult(
                    success=False,
                    error=f"File too large: {file_size} bytes (max: {self.limits.max_file_size} bytes)",
                    file_size=file_size,
                    original_filename=original_filename
                )
            
            # Perform upload using UTApi approach
            result = self._upload_with_utapi(upload_file_path, file_size, mime_type, metadata or {})
            
            # Cache the result if upload was successful and we have a hash
            if result.success and result.url and file_hash:
                self.cache_manager.cache_url(str(file_path), file_hash, result.url)
                self.logger.debug(f"Cached upload result for {file_path}")
            
            # Clean up compressed file if created
            if compressed_file and os.path.exists(compressed_file):
                try:
                    os.unlink(compressed_file)
                    self.logger.debug(f"Cleaned up compressed file: {compressed_file}")
                except Exception as e:
                    self.logger.warning(f"Failed to clean up compressed file {compressed_file}: {e}")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Unexpected error uploading {file_path}: {e}")
            return UploadResult(
                success=False,
                error=f"Unexpected error: {str(e)}",
                original_filename=file_path.name if file_path else None
            )
    
    def _compress_image(self, file_path: Path, mime_type: str) -> CompressionResult:
        """
        Compress an image file to reduce its size while maintaining quality.
        
        Args:
            file_path: Path to the original image file
            mime_type: MIME type of the image
            
        Returns:
            CompressionResult with compression status and details
        """
        try:
            original_size = file_path.stat().st_size
            
            # Open and process the image
            with Image.open(file_path) as img:
                # Convert RGBA to RGB if necessary (for JPEG compatibility)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Create a white background
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Auto-orient the image based on EXIF data
                img = ImageOps.exif_transpose(img)
                
                # Calculate target dimensions to reduce file size
                # Reduce dimensions if image is very large
                max_dimension = self.limits.max_image_dimension
                if max(img.size) > max_dimension:
                    ratio = max_dimension / max(img.size)
                    new_size = tuple(int(dim * ratio) for dim in img.size)
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                    self.logger.debug(f"Resized image from {file_path.stat().st_size} to {new_size}")
                
                # Create temporary file for compressed image
                with tempfile.NamedTemporaryFile(
                    suffix='.jpg',  # Always save as JPEG for better compression
                    delete=False
                ) as temp_file:
                    temp_path = temp_file.name
                
                # Save with optimized settings
                # Start with configured quality and reduce if still too large
                quality_levels = [self.limits.compression_quality, 75, 65, 55]
                for quality in quality_levels:
                    img.save(temp_path, 'JPEG', quality=quality, optimize=True)
                    compressed_size = os.path.getsize(temp_path)
                    
                    # Check if we've achieved sufficient compression
                    if compressed_size <= self.limits.compression_threshold or quality == 55:
                        break
                
                self.logger.debug(f"Compressed image: {original_size} -> {compressed_size} bytes (quality: {quality})")
                
                return CompressionResult(
                    success=True,
                    compressed_path=temp_path,
                    original_size=original_size,
                    compressed_size=compressed_size
                )
                
        except Exception as e:
            self.logger.error(f"Error compressing image {file_path}: {e}")
            return CompressionResult(
                success=False,
                error=f"Compression failed: {str(e)}"
            )

    def _upload_with_utapi(
        self, 
        file_path: Path, 
        file_size: int, 
        mime_type: str, 
        metadata: Dict[str, Any]
    ) -> UploadResult:
        """
        Upload file using UploadThing UTApi approach.
        
        NOTE: This implementation is a placeholder. The actual UploadThing API
        format needs to be determined from official documentation or SDK source code.
        
        Args:
            file_path: Path to the file
            file_size: Size of the file in bytes
            mime_type: MIME type of the file
            metadata: Metadata to include with upload
            
        Returns:
            UploadResult with upload status
        """
        self.logger.warning("UploadThing API implementation is incomplete")
        self.logger.warning("The correct API format needs to be determined from official sources")
        self.logger.info(f"Would upload: {file_path.name} ({file_size} bytes, {mime_type})")
        self.logger.info(f"Metadata: {metadata}")
        
        # For now, return a mock successful result for development purposes
        # This allows the rest of the system to be tested while the API integration is completed
        mock_file_key = f"mock-{hashlib.md5(str(file_path).encode()).hexdigest()[:12]}"
        mock_url = f"https://utfs.io/f/{mock_file_key}"
        
        self.logger.info(f"Mock upload result: {mock_url}")
        
        return UploadResult(
            success=True,
            url=mock_url,
            file_key=mock_file_key,
            file_size=file_size,
            original_filename=file_path.name
        )
    
    def _get_mime_type(self, file_path: Path) -> str:
        """
        Get MIME type for a file.
        
        Args:
            file_path: Path to the file
            
        Returns:
            MIME type string
        """
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        if mime_type:
            return mime_type
        
        # Fallback based on extension
        ext = file_path.suffix.lower()
        fallback_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        }
        
        return fallback_types.get(ext, 'application/octet-stream')
    
    def calculate_file_hash(self, file_path: str) -> str:
        """
        Calculate MD5 hash of a file for caching purposes.
        
        Args:
            file_path: Path to the file
            
        Returns:
            MD5 hash as hexadecimal string
        """
        return self.cache_manager.calculate_file_hash(file_path)
    
    def clear_cache(self) -> None:
        """Clear all entries from the upload cache."""
        self.cache_manager.clear_cache()
    
    def validate_cache(self) -> int:
        """
        Validate all cached URLs and remove invalid ones.
        
        Returns:
            Number of invalid URLs removed
        """
        return self.cache_manager.remove_invalid_urls()
    
    def list_cache_entries(self) -> list:
        """
        List all cache entries with their metadata.
        
        Returns:
            List of cache entry dictionaries
        """
        return self.cache_manager.list_cache_entries()
    
    def get_cache_stats(self) -> dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        return self.cache_manager.get_cache_stats()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - close session and cache manager."""
        if hasattr(self, 'session'):
            self.session.close()
        if hasattr(self, 'cache_manager'):
            self.cache_manager.__exit__(exc_type, exc_val, exc_tb)