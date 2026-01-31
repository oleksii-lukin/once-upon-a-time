#!/usr/bin/env python3
"""
Configuration Management for Image Upload Automation

This module provides comprehensive configuration management for the image upload system,
supporting configurable retry attempts, timeout values, image file extensions, and other settings.
It provides user-friendly error messages and setup instructions when configuration is missing or invalid.

Features:
- Configurable retry attempts and timeout values
- Configurable image file extensions
- Environment variable support with .env file loading
- User-friendly error messages and setup instructions
- Configuration validation and defaults
- Support for different configuration sources (env vars, config files, command line)
"""

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Any, Union
import sys


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    timeout_seconds: int = 30
    backoff_factor: float = 1.0
    status_codes_to_retry: List[int] = field(default_factory=lambda: [429, 500, 502, 503, 504])
    
    def validate(self) -> List[str]:
        """Validate retry configuration and return any errors."""
        errors = []
        
        if self.max_attempts < 1:
            errors.append("max_attempts must be at least 1")
        elif self.max_attempts > 10:
            errors.append("max_attempts should not exceed 10 (recommended: 3-5)")
        
        if self.timeout_seconds < 5:
            errors.append("timeout_seconds must be at least 5")
        elif self.timeout_seconds > 300:
            errors.append("timeout_seconds should not exceed 300 (5 minutes)")
        
        if self.backoff_factor < 0.1:
            errors.append("backoff_factor must be at least 0.1")
        elif self.backoff_factor > 5.0:
            errors.append("backoff_factor should not exceed 5.0")
        
        return errors


@dataclass
class UploadConfig:
    """Configuration for upload behavior."""
    max_concurrent_uploads: int = 5
    max_file_size_mb: int = 4
    compression_threshold_mb: int = 2
    compression_quality: int = 85
    max_image_dimension: int = 10000
    
    def validate(self) -> List[str]:
        """Validate upload configuration and return any errors."""
        errors = []
        
        if self.max_concurrent_uploads < 1:
            errors.append("max_concurrent_uploads must be at least 1")
        elif self.max_concurrent_uploads > 20:
            errors.append("max_concurrent_uploads should not exceed 20 (recommended: 3-8)")
        
        if self.max_file_size_mb < 1:
            errors.append("max_file_size_mb must be at least 1")
        elif self.max_file_size_mb > 50:
            errors.append("max_file_size_mb should not exceed 50")
        
        if self.compression_threshold_mb < 0.5:
            errors.append("compression_threshold_mb must be at least 0.5")
        elif self.compression_threshold_mb > self.max_file_size_mb:
            errors.append("compression_threshold_mb cannot exceed max_file_size_mb")
        
        if self.compression_quality < 10:
            errors.append("compression_quality must be at least 10")
        elif self.compression_quality > 100:
            errors.append("compression_quality cannot exceed 100")
        
        if self.max_image_dimension < 100:
            errors.append("max_image_dimension must be at least 100")
        elif self.max_image_dimension > 50000:
            errors.append("max_image_dimension should not exceed 50000")
        
        return errors
    
    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024
    
    @property
    def compression_threshold_bytes(self) -> int:
        """Get compression threshold in bytes."""
        return self.compression_threshold_mb * 1024 * 1024


@dataclass
class FileConfig:
    """Configuration for file handling."""
    supported_extensions: Set[str] = field(default_factory=lambda: {'.jpg', '.jpeg', '.png', '.webp'})
    supported_mime_types: Set[str] = field(default_factory=lambda: {'image/jpeg', 'image/jpg', 'image/png', 'image/webp'})
    cache_file: str = "image_cache.json"
    resume_state_file: str = "upload_resume.json"
    
    def validate(self) -> List[str]:
        """Validate file configuration and return any errors."""
        errors = []
        
        if not self.supported_extensions:
            errors.append("supported_extensions cannot be empty")
        
        # Validate extensions format
        for ext in self.supported_extensions:
            if not ext.startswith('.'):
                errors.append(f"Extension '{ext}' must start with a dot")
            if len(ext) < 2:
                errors.append(f"Extension '{ext}' is too short")
        
        if not self.supported_mime_types:
            errors.append("supported_mime_types cannot be empty")
        
        # Validate MIME types format
        for mime_type in self.supported_mime_types:
            if '/' not in mime_type:
                errors.append(f"MIME type '{mime_type}' is invalid (must contain '/')")
        
        return errors


@dataclass
class LoggingConfig:
    """Configuration for logging behavior."""
    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    date_format: str = "%Y-%m-%d %H:%M:%S"
    
    def validate(self) -> List[str]:
        """Validate logging configuration and return any errors."""
        errors = []
        
        valid_levels = {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}
        if self.level.upper() not in valid_levels:
            errors.append(f"Invalid log level '{self.level}'. Must be one of: {', '.join(valid_levels)}")
        
        return errors


@dataclass
class ImageUploadConfig:
    """Complete configuration for the image upload system."""
    retry: RetryConfig = field(default_factory=RetryConfig)
    upload: UploadConfig = field(default_factory=UploadConfig)
    files: FileConfig = field(default_factory=FileConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    
    # UploadThing credentials
    uploadthing_secret: Optional[str] = None
    uploadthing_app_id: Optional[str] = None
    uploadthing_token: Optional[str] = None
    
    def validate(self) -> List[str]:
        """Validate the complete configuration and return any errors."""
        errors = []
        
        # Validate sub-configurations
        errors.extend([f"retry.{error}" for error in self.retry.validate()])
        errors.extend([f"upload.{error}" for error in self.upload.validate()])
        errors.extend([f"files.{error}" for error in self.files.validate()])
        errors.extend([f"logging.{error}" for error in self.logging.validate()])
        
        return errors
    
    def has_credentials(self) -> bool:
        """Check if UploadThing credentials are available."""
        return bool(
            (self.uploadthing_secret and self.uploadthing_app_id) or
            self.uploadthing_token
        )


class ConfigurationManager:
    """
    Manages configuration loading, validation, and error reporting for the image upload system.
    
    Supports multiple configuration sources:
    1. Environment variables
    2. .env files (.env, .env.local, .env.production)
    3. JSON configuration files
    4. Command line arguments (via override methods)
    """
    
    def __init__(self, config_file: Optional[str] = None):
        """
        Initialize the configuration manager.
        
        Args:
            config_file: Optional path to JSON configuration file
        """
        self.config_file = config_file
        self.logger = logging.getLogger('config_manager')
        self._config: Optional[ImageUploadConfig] = None
    
    def load_config(self) -> ImageUploadConfig:
        """
        Load configuration from all available sources.
        
        Returns:
            Complete ImageUploadConfig object
            
        Raises:
            SystemExit: If configuration is invalid or credentials are missing
        """
        if self._config is not None:
            return self._config
        
        # Start with defaults
        config = ImageUploadConfig()
        
        # Load from environment variables and .env files
        self._load_from_environment(config)
        
        # Load from JSON config file if specified
        if self.config_file:
            self._load_from_json_file(config, self.config_file)
        
        # Validate configuration
        errors = config.validate()
        if errors:
            self._print_configuration_errors(errors)
            sys.exit(1)
        
        # Check credentials
        if not config.has_credentials():
            self._print_credential_setup_instructions()
            sys.exit(1)
        
        self._config = config
        return config
    
    def _load_from_environment(self, config: ImageUploadConfig) -> None:
        """Load configuration from environment variables and .env files."""
        # Load environment variables from .env files
        env_vars = {}
        
        # Try to load from common .env file locations
        env_files = ['.env', '.env.local', '.env.production']
        for env_file in env_files:
            if os.path.exists(env_file):
                self.logger.debug(f"Loading environment variables from {env_file}")
                file_vars = self._load_env_file(env_file)
                env_vars.update(file_vars)
        
        # Merge with actual environment variables (they take precedence)
        env_vars.update(os.environ)
        
        # Map environment variables to configuration
        self._map_env_vars_to_config(config, env_vars)
    
    def _load_env_file(self, env_file: str) -> Dict[str, str]:
        """Load environment variables from a .env file."""
        env_vars = {}
        
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    
                    # Skip empty lines and comments
                    if not line or line.startswith('#'):
                        continue
                    
                    # Parse KEY=VALUE format
                    if '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Remove quotes if present
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        elif value.startswith("'") and value.endswith("'"):
                            value = value[1:-1]
                        
                        env_vars[key] = value
                    else:
                        self.logger.warning(f"Invalid line in {env_file}:{line_num}: {line}")
        
        except Exception as e:
            self.logger.warning(f"Failed to load {env_file}: {e}")
        
        return env_vars
    
    def _map_env_vars_to_config(self, config: ImageUploadConfig, env_vars: Dict[str, str]) -> None:
        """Map environment variables to configuration object."""
        # UploadThing credentials
        config.uploadthing_secret = env_vars.get('UPLOADTHING_SECRET')
        config.uploadthing_app_id = env_vars.get('UPLOADTHING_APP_ID')
        config.uploadthing_token = env_vars.get('UPLOADTHING_TOKEN')
        
        # Retry configuration
        if 'UPLOAD_RETRY_ATTEMPTS' in env_vars:
            try:
                config.retry.max_attempts = int(env_vars['UPLOAD_RETRY_ATTEMPTS'])
            except ValueError:
                self.logger.warning(f"Invalid UPLOAD_RETRY_ATTEMPTS: {env_vars['UPLOAD_RETRY_ATTEMPTS']}")
        
        if 'UPLOAD_TIMEOUT_SECONDS' in env_vars:
            try:
                config.retry.timeout_seconds = int(env_vars['UPLOAD_TIMEOUT_SECONDS'])
            except ValueError:
                self.logger.warning(f"Invalid UPLOAD_TIMEOUT_SECONDS: {env_vars['UPLOAD_TIMEOUT_SECONDS']}")
        
        if 'UPLOAD_BACKOFF_FACTOR' in env_vars:
            try:
                config.retry.backoff_factor = float(env_vars['UPLOAD_BACKOFF_FACTOR'])
            except ValueError:
                self.logger.warning(f"Invalid UPLOAD_BACKOFF_FACTOR: {env_vars['UPLOAD_BACKOFF_FACTOR']}")
        
        # Upload configuration
        if 'UPLOAD_MAX_CONCURRENT' in env_vars:
            try:
                config.upload.max_concurrent_uploads = int(env_vars['UPLOAD_MAX_CONCURRENT'])
            except ValueError:
                self.logger.warning(f"Invalid UPLOAD_MAX_CONCURRENT: {env_vars['UPLOAD_MAX_CONCURRENT']}")
        
        if 'UPLOAD_MAX_FILE_SIZE_MB' in env_vars:
            try:
                config.upload.max_file_size_mb = int(env_vars['UPLOAD_MAX_FILE_SIZE_MB'])
            except ValueError:
                self.logger.warning(f"Invalid UPLOAD_MAX_FILE_SIZE_MB: {env_vars['UPLOAD_MAX_FILE_SIZE_MB']}")
        
        if 'UPLOAD_COMPRESSION_THRESHOLD_MB' in env_vars:
            try:
                config.upload.compression_threshold_mb = int(env_vars['UPLOAD_COMPRESSION_THRESHOLD_MB'])
            except ValueError:
                self.logger.warning(f"Invalid UPLOAD_COMPRESSION_THRESHOLD_MB: {env_vars['UPLOAD_COMPRESSION_THRESHOLD_MB']}")
        
        if 'UPLOAD_COMPRESSION_QUALITY' in env_vars:
            try:
                config.upload.compression_quality = int(env_vars['UPLOAD_COMPRESSION_QUALITY'])
            except ValueError:
                self.logger.warning(f"Invalid UPLOAD_COMPRESSION_QUALITY: {env_vars['UPLOAD_COMPRESSION_QUALITY']}")
        
        # File configuration
        if 'UPLOAD_SUPPORTED_EXTENSIONS' in env_vars:
            try:
                extensions = env_vars['UPLOAD_SUPPORTED_EXTENSIONS'].split(',')
                config.files.supported_extensions = {ext.strip() for ext in extensions if ext.strip()}
            except Exception:
                self.logger.warning(f"Invalid UPLOAD_SUPPORTED_EXTENSIONS: {env_vars['UPLOAD_SUPPORTED_EXTENSIONS']}")
        
        if 'UPLOAD_CACHE_FILE' in env_vars:
            config.files.cache_file = env_vars['UPLOAD_CACHE_FILE']
        
        # Logging configuration
        if 'UPLOAD_LOG_LEVEL' in env_vars:
            config.logging.level = env_vars['UPLOAD_LOG_LEVEL']
    
    def _load_from_json_file(self, config: ImageUploadConfig, config_file: str) -> None:
        """Load configuration from JSON file."""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                json_config = json.load(f)
            
            # Apply JSON configuration to config object
            self._apply_json_config(config, json_config)
            
            self.logger.info(f"Loaded configuration from {config_file}")
            
        except FileNotFoundError:
            self.logger.warning(f"Configuration file not found: {config_file}")
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in configuration file {config_file}: {e}")
            sys.exit(1)
        except Exception as e:
            self.logger.error(f"Error loading configuration file {config_file}: {e}")
            sys.exit(1)
    
    def _apply_json_config(self, config: ImageUploadConfig, json_config: Dict[str, Any]) -> None:
        """Apply JSON configuration to config object."""
        # Retry configuration
        if 'retry' in json_config:
            retry_config = json_config['retry']
            if 'max_attempts' in retry_config:
                config.retry.max_attempts = retry_config['max_attempts']
            if 'timeout_seconds' in retry_config:
                config.retry.timeout_seconds = retry_config['timeout_seconds']
            if 'backoff_factor' in retry_config:
                config.retry.backoff_factor = retry_config['backoff_factor']
        
        # Upload configuration
        if 'upload' in json_config:
            upload_config = json_config['upload']
            if 'max_concurrent_uploads' in upload_config:
                config.upload.max_concurrent_uploads = upload_config['max_concurrent_uploads']
            if 'max_file_size_mb' in upload_config:
                config.upload.max_file_size_mb = upload_config['max_file_size_mb']
            if 'compression_threshold_mb' in upload_config:
                config.upload.compression_threshold_mb = upload_config['compression_threshold_mb']
            if 'compression_quality' in upload_config:
                config.upload.compression_quality = upload_config['compression_quality']
        
        # File configuration
        if 'files' in json_config:
            files_config = json_config['files']
            if 'supported_extensions' in files_config:
                config.files.supported_extensions = set(files_config['supported_extensions'])
            if 'cache_file' in files_config:
                config.files.cache_file = files_config['cache_file']
        
        # Logging configuration
        if 'logging' in json_config:
            logging_config = json_config['logging']
            if 'level' in logging_config:
                config.logging.level = logging_config['level']
    
    def _print_configuration_errors(self, errors: List[str]) -> None:
        """Print configuration validation errors."""
        print("❌ Configuration validation failed!")
        print("\n🔧 CONFIGURATION ERRORS:")
        print("=" * 50)
        
        for i, error in enumerate(errors, 1):
            print(f"{i:2d}. {error}")
        
        print("\n💡 Fix these errors and try again.")
        print("   Use --help to see available configuration options.")
    
    def _print_credential_setup_instructions(self) -> None:
        """Print detailed setup instructions for UploadThing credentials."""
        print("❌ Missing required UploadThing credentials!")
        print("\n🔧 SETUP INSTRUCTIONS:")
        print("=" * 50)
        
        print("\n📋 Option 1: Use separate environment variables")
        print("Add these to your .env.local file:")
        print("   UPLOADTHING_SECRET=your_secret_key_here")
        print("   UPLOADTHING_APP_ID=your_app_id_here")
        
        print("\n📋 Option 2: Use UploadThing token (current web app format)")
        print("Add this to your .env.local file:")
        print("   UPLOADTHING_TOKEN=your_jwt_token_here")
        
        print("\n🌐 How to get your credentials:")
        print("1. Go to https://uploadthing.com/dashboard")
        print("2. Select your app or create a new one")
        print("3. Navigate to the API Keys section")
        print("4. Copy your credentials:")
        print("   - For Option 1: Copy 'Secret Key' and 'App ID' separately")
        print("   - For Option 2: Copy the 'App Token' (JWT format)")
        
        print("\n📁 Supported .env file locations:")
        env_files = ['.env', '.env.local', '.env.production']
        for env_file in env_files:
            exists = "✅" if os.path.exists(env_file) else "❌"
            print(f"   {exists} {env_file}")
        
        print("\n⚙️  Additional configuration options:")
        print("You can also configure these settings via environment variables:")
        print("   UPLOAD_RETRY_ATTEMPTS=3          # Number of retry attempts (1-10)")
        print("   UPLOAD_TIMEOUT_SECONDS=30        # Request timeout (5-300)")
        print("   UPLOAD_MAX_CONCURRENT=5          # Max concurrent uploads (1-20)")
        print("   UPLOAD_MAX_FILE_SIZE_MB=4        # Max file size in MB (1-50)")
        print("   UPLOAD_COMPRESSION_THRESHOLD_MB=2 # Compress files larger than this")
        print("   UPLOAD_COMPRESSION_QUALITY=85    # JPEG compression quality (10-100)")
        print("   UPLOAD_SUPPORTED_EXTENSIONS=.jpg,.jpeg,.png,.webp")
        print("   UPLOAD_LOG_LEVEL=INFO            # Logging level")
        
        print("\n🔄 After adding credentials:")
        print("1. Restart this script")
        print("2. For web app: restart your development server")
        
        print("\n🐛 Troubleshooting:")
        print("- Ensure no extra quotes around values in .env files")
        print("- Check that .env files are in the project root directory")
        print("- Verify your UploadThing account has valid API access")
        print("- Use --log-level DEBUG for more detailed error information")
    
    def override_retry_config(self, max_attempts: Optional[int] = None, 
                            timeout_seconds: Optional[int] = None,
                            backoff_factor: Optional[float] = None) -> None:
        """Override retry configuration (typically from command line args)."""
        if self._config is None:
            raise RuntimeError("Configuration not loaded yet")
        
        if max_attempts is not None:
            self._config.retry.max_attempts = max_attempts
        if timeout_seconds is not None:
            self._config.retry.timeout_seconds = timeout_seconds
        if backoff_factor is not None:
            self._config.retry.backoff_factor = backoff_factor
    
    def override_upload_config(self, max_concurrent: Optional[int] = None,
                             max_file_size_mb: Optional[int] = None,
                             compression_threshold_mb: Optional[int] = None) -> None:
        """Override upload configuration (typically from command line args)."""
        if self._config is None:
            raise RuntimeError("Configuration not loaded yet")
        
        if max_concurrent is not None:
            self._config.upload.max_concurrent_uploads = max_concurrent
        if max_file_size_mb is not None:
            self._config.upload.max_file_size_mb = max_file_size_mb
        if compression_threshold_mb is not None:
            self._config.upload.compression_threshold_mb = compression_threshold_mb
    
    def override_file_config(self, supported_extensions: Optional[Set[str]] = None,
                           cache_file: Optional[str] = None) -> None:
        """Override file configuration (typically from command line args)."""
        if self._config is None:
            raise RuntimeError("Configuration not loaded yet")
        
        if supported_extensions is not None:
            self._config.files.supported_extensions = supported_extensions
        if cache_file is not None:
            self._config.files.cache_file = cache_file
    
    def get_config(self) -> ImageUploadConfig:
        """Get the current configuration (must call load_config first)."""
        if self._config is None:
            raise RuntimeError("Configuration not loaded yet. Call load_config() first.")
        return self._config
    
    def save_config_template(self, output_file: str = "upload_config.json") -> None:
        """Save a configuration template file with all available options."""
        template = {
            "retry": {
                "max_attempts": 3,
                "timeout_seconds": 30,
                "backoff_factor": 1.0,
                "status_codes_to_retry": [429, 500, 502, 503, 504]
            },
            "upload": {
                "max_concurrent_uploads": 5,
                "max_file_size_mb": 4,
                "compression_threshold_mb": 2,
                "compression_quality": 85,
                "max_image_dimension": 10000
            },
            "files": {
                "supported_extensions": [".jpg", ".jpeg", ".png", ".webp"],
                "supported_mime_types": ["image/jpeg", "image/jpg", "image/png", "image/webp"],
                "cache_file": "image_cache.json",
                "resume_state_file": "upload_resume.json"
            },
            "logging": {
                "level": "INFO",
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "date_format": "%Y-%m-%d %H:%M:%S"
            }
        }
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(template, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Configuration template saved to: {output_file}")
            print("   Edit this file to customize your settings, then use --config-file option")
            
        except Exception as e:
            print(f"❌ Failed to save configuration template: {e}")


# Global configuration manager instance
_config_manager: Optional[ConfigurationManager] = None


def get_config_manager(config_file: Optional[str] = None) -> ConfigurationManager:
    """Get the global configuration manager instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigurationManager(config_file)
    return _config_manager


def get_config(config_file: Optional[str] = None) -> ImageUploadConfig:
    """Get the loaded configuration (convenience function)."""
    manager = get_config_manager(config_file)
    return manager.load_config()