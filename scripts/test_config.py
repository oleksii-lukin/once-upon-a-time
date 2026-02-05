#!/usr/bin/env python3
"""
Test script for the configuration system.

This script tests the comprehensive configuration system to ensure it works correctly
with environment variables, configuration files, and command line overrides.
"""

import os
import tempfile
import json
from pathlib import Path

from config import ConfigurationManager, ImageUploadConfig


def test_default_configuration():
    """Test that default configuration loads correctly."""
    print("🧪 Testing default configuration...")
    
    config = ImageUploadConfig()
    
    # Test default values
    assert config.retry.max_attempts == 3
    assert config.retry.timeout_seconds == 30
    assert config.upload.max_concurrent_uploads == 5
    assert config.upload.max_file_size_mb == 4
    assert config.files.supported_extensions == {'.jpg', '.jpeg', '.png', '.webp'}
    assert config.logging.level == "INFO"
    
    print("✅ Default configuration test passed")


def test_environment_variable_loading():
    """Test loading configuration from environment variables."""
    print("🧪 Testing environment variable loading...")
    
    # Set test environment variables
    test_env = {
        'UPLOAD_RETRY_ATTEMPTS': '5',
        'UPLOAD_TIMEOUT_SECONDS': '60',
        'UPLOAD_MAX_CONCURRENT': '8',
        'UPLOAD_MAX_FILE_SIZE_MB': '10',
        'UPLOAD_COMPRESSION_QUALITY': '90',
        'UPLOAD_SUPPORTED_EXTENSIONS': '.jpg,.png,.webp',
        'UPLOAD_LOG_LEVEL': 'DEBUG'
    }
    
    # Save original environment
    original_env = {}
    for key in test_env:
        original_env[key] = os.environ.get(key)
        os.environ[key] = test_env[key]
    
    try:
        # Create configuration manager and load config
        manager = ConfigurationManager()
        config = ImageUploadConfig()
        manager._map_env_vars_to_config(config, os.environ)
        
        # Test that environment variables were applied
        assert config.retry.max_attempts == 5
        assert config.retry.timeout_seconds == 60
        assert config.upload.max_concurrent_uploads == 8
        assert config.upload.max_file_size_mb == 10
        assert config.upload.compression_quality == 90
        assert config.files.supported_extensions == {'.jpg', '.png', '.webp'}
        assert config.logging.level == 'DEBUG'
        
        print("✅ Environment variable loading test passed")
        
    finally:
        # Restore original environment
        for key, value in original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def test_json_configuration_loading():
    """Test loading configuration from JSON file."""
    print("🧪 Testing JSON configuration loading...")
    
    # Create temporary JSON config file
    config_data = {
        "retry": {
            "max_attempts": 7,
            "timeout_seconds": 45,
            "backoff_factor": 2.0
        },
        "upload": {
            "max_concurrent_uploads": 10,
            "max_file_size_mb": 8,
            "compression_threshold_mb": 3,
            "compression_quality": 80
        },
        "files": {
            "supported_extensions": [".jpg", ".png"],
            "cache_file": "test_cache.json"
        },
        "logging": {
            "level": "WARNING"
        }
    }
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(config_data, f)
        config_file = f.name
    
    try:
        # Load configuration from JSON file
        config = ImageUploadConfig()
        manager = ConfigurationManager()
        manager._apply_json_config(config, config_data)
        
        # Test that JSON configuration was applied
        assert config.retry.max_attempts == 7
        assert config.retry.timeout_seconds == 45
        assert config.retry.backoff_factor == 2.0
        assert config.upload.max_concurrent_uploads == 10
        assert config.upload.max_file_size_mb == 8
        assert config.upload.compression_threshold_mb == 3
        assert config.upload.compression_quality == 80
        assert config.files.supported_extensions == {".jpg", ".png"}
        assert config.files.cache_file == "test_cache.json"
        assert config.logging.level == "WARNING"
        
        print("✅ JSON configuration loading test passed")
        
    finally:
        # Clean up temporary file
        os.unlink(config_file)


def test_configuration_validation():
    """Test configuration validation."""
    print("🧪 Testing configuration validation...")
    
    # Test valid configuration
    config = ImageUploadConfig()
    errors = config.validate()
    assert len(errors) == 0, f"Valid config should have no errors, got: {errors}"
    
    # Test invalid configuration
    config.retry.max_attempts = 0  # Invalid: must be at least 1
    config.upload.max_concurrent_uploads = 25  # Invalid: should not exceed 20
    config.files.supported_extensions = set()  # Invalid: cannot be empty
    
    errors = config.validate()
    assert len(errors) > 0, "Invalid config should have errors"
    
    print("✅ Configuration validation test passed")


def test_config_template_generation():
    """Test configuration template generation."""
    print("🧪 Testing configuration template generation...")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        template_file = f.name
    
    try:
        # Generate configuration template
        manager = ConfigurationManager()
        manager.save_config_template(template_file)
        
        # Verify template file was created and is valid JSON
        assert os.path.exists(template_file)
        
        with open(template_file, 'r') as f:
            template_data = json.load(f)
        
        # Verify template has expected structure
        assert 'retry' in template_data
        assert 'upload' in template_data
        assert 'files' in template_data
        assert 'logging' in template_data
        
        print("✅ Configuration template generation test passed")
        
    finally:
        # Clean up
        if os.path.exists(template_file):
            os.unlink(template_file)


def test_credential_detection():
    """Test credential detection."""
    print("🧪 Testing credential detection...")
    
    # Test with no credentials
    config = ImageUploadConfig()
    assert not config.has_credentials()
    
    # Test with separate credentials
    config.uploadthing_secret = "test_secret"
    config.uploadthing_app_id = "test_app_id"
    assert config.has_credentials()
    
    # Test with token
    config = ImageUploadConfig()
    config.uploadthing_token = "test_token"
    assert config.has_credentials()
    
    print("✅ Credential detection test passed")


def main():
    """Run all configuration tests."""
    print("🚀 Running configuration system tests...")
    print("=" * 50)
    
    try:
        test_default_configuration()
        test_environment_variable_loading()
        test_json_configuration_loading()
        test_configuration_validation()
        test_config_template_generation()
        test_credential_detection()
        
        print("\n" + "=" * 50)
        print("✅ All configuration tests passed!")
        print("🎉 Configuration system is working correctly")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())