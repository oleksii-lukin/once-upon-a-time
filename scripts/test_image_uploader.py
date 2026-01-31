#!/usr/bin/env python3
"""
Test script for ImageUploader class

This script tests the ImageUploader class functionality including:
- Dry-run mode
- Progress reporting
- Error handling
- Cache management
"""

import logging
import os
import sys
import tempfile
import time
from pathlib import Path

# Add the scripts directory to the path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from image_uploader import ImageUploader, UploadProgress
from image_discovery import ImageDiscoveryService, ImageFilters


def setup_logging():
    """Set up logging for the test."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )


def progress_callback(progress: UploadProgress):
    """Progress callback function for testing."""
    percentage = progress.completion_percentage
    eta = progress.estimated_time_remaining
    rate = progress.upload_rate
    
    print(f"\rProgress: {percentage:.1f}% ({progress.completed_files}/{progress.total_files}) "
          f"Rate: {rate:.1f} files/sec", end="")
    
    if eta is not None:
        print(f" ETA: {eta:.1f}s", end="")
    
    if progress.current_file:
        print(f" Current: {Path(progress.current_file).name}", end="")
    
    if progress.completed_files == progress.total_files:
        print()  # New line when complete


def test_dry_run_mode():
    """Test the ImageUploader in dry-run mode."""
    print("\n" + "="*60)
    print("🧪 Testing ImageUploader - Dry Run Mode")
    print("="*60)
    
    # Use dummy credentials for dry-run
    uploader = ImageUploader(
        api_key="dummy_key",
        app_id="dummy_app_id",
        max_concurrent=3,
        progress_callback=progress_callback
    )
    
    try:
        # Test with discovered images
        print("\n📁 Discovering images...")
        filters = ImageFilters(deck_name="default")  # Only test with default deck if it exists
        
        result = uploader.upload_discovered_images(
            base_path="specs/decks",
            filters=filters,
            dry_run=True
        )
        
        print(f"\n📊 Results:")
        print(f"  Total processed: {result.total_processed}")
        print(f"  Successful uploads: {len(result.successful_uploads)}")
        print(f"  Failed uploads: {len(result.failed_uploads)}")
        print(f"  Cached URLs: {len(result.cached_urls)}")
        print(f"  Success rate: {result.success_rate:.1f}%")
        print(f"  Processing time: {result.progress.elapsed_time:.2f}s")
        
        if result.successful_uploads:
            print(f"\n✅ Sample successful uploads:")
            for i, (file_path, url) in enumerate(list(result.successful_uploads.items())[:3]):
                print(f"  {i+1}. {Path(file_path).name} -> {url}")
        
        if result.failed_uploads:
            print(f"\n❌ Failed uploads:")
            for file_path, error in result.failed_uploads.items():
                print(f"  {Path(file_path).name}: {error}")
        
        return result.total_processed > 0
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    
    finally:
        uploader.__exit__(None, None, None)


def test_batch_upload():
    """Test batch upload functionality."""
    print("\n" + "="*60)
    print("🧪 Testing ImageUploader - Batch Upload")
    print("="*60)
    
    # Create temporary test files
    test_files = []
    temp_dir = None
    
    try:
        temp_dir = tempfile.mkdtemp(prefix="image_uploader_test_")
        print(f"📁 Created temporary directory: {temp_dir}")
        
        # Create some dummy image files
        for i in range(3):
            test_file = Path(temp_dir) / f"test_image_{i}.jpg"
            test_file.write_text(f"Mock image content {i}")
            test_files.append(str(test_file))
        
        print(f"📄 Created {len(test_files)} test files")
        
        # Use dummy credentials for dry-run
        uploader = ImageUploader(
            api_key="dummy_key",
            app_id="dummy_app_id",
            max_concurrent=2,
            progress_callback=progress_callback
        )
        
        # Test batch upload in dry-run mode
        print("\n🚀 Starting batch upload (dry-run)...")
        result = uploader.upload_batch(
            file_paths=test_files,
            image_type="test",
            dry_run=True
        )
        
        print(f"\n📊 Batch upload results:")
        print(f"  Total processed: {result.total_processed}")
        print(f"  Successful uploads: {len(result.successful_uploads)}")
        print(f"  Failed uploads: {len(result.failed_uploads)}")
        print(f"  Success rate: {result.success_rate:.1f}%")
        
        return result.total_processed == len(test_files) and result.success_rate == 100.0
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    
    finally:
        # Clean up temporary files
        if temp_dir:
            import shutil
            try:
                shutil.rmtree(temp_dir)
                print(f"🗑️  Cleaned up temporary directory")
            except Exception as e:
                print(f"⚠️  Failed to clean up temporary directory: {e}")


def test_error_handling():
    """Test error handling with non-existent files."""
    print("\n" + "="*60)
    print("🧪 Testing ImageUploader - Error Handling")
    print("="*60)
    
    uploader = ImageUploader(
        api_key="dummy_key",
        app_id="dummy_app_id",
        max_concurrent=2,
        progress_callback=progress_callback
    )
    
    try:
        # Test with non-existent files
        non_existent_files = [
            "/path/to/non/existent/file1.jpg",
            "/path/to/non/existent/file2.png",
            "/path/to/non/existent/file3.webp"
        ]
        
        print(f"🚀 Testing with {len(non_existent_files)} non-existent files...")
        result = uploader.upload_batch(
            file_paths=non_existent_files,
            image_type="test",
            dry_run=True
        )
        
        print(f"\n📊 Error handling results:")
        print(f"  Total processed: {result.total_processed}")
        print(f"  Successful uploads: {len(result.successful_uploads)}")
        print(f"  Failed uploads: {len(result.failed_uploads)}")
        print(f"  Success rate: {result.success_rate:.1f}%")
        
        if result.failed_uploads:
            print(f"\n❌ Expected failures:")
            for file_path, error in result.failed_uploads.items():
                print(f"  {Path(file_path).name}: {error}")
        
        # Should have all failures and 0% success rate
        expected_failures = len(non_existent_files)
        return (len(result.failed_uploads) == expected_failures and 
                result.success_rate == 0.0)
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    
    finally:
        uploader.__exit__(None, None, None)


def test_cache_management():
    """Test cache management functionality."""
    print("\n" + "="*60)
    print("🧪 Testing ImageUploader - Cache Management")
    print("="*60)
    
    # Use a temporary cache file
    temp_cache = tempfile.NamedTemporaryFile(suffix='.json', delete=False)
    temp_cache.close()
    
    try:
        uploader = ImageUploader(
            api_key="dummy_key",
            app_id="dummy_app_id",
            cache_file=temp_cache.name
        )
        
        print(f"📄 Using temporary cache file: {temp_cache.name}")
        
        # Test cache stats
        print("\n📊 Initial cache stats:")
        stats = uploader.get_cache_stats()
        for key, value in stats.items():
            print(f"  {key}: {value}")
        
        # Test cache validation
        print("\n🔍 Validating cache...")
        removed_count = uploader.validate_cache()
        print(f"  Removed {removed_count} invalid URLs")
        
        # Test cache clearing
        print("\n🗑️  Clearing cache...")
        uploader.clear_cache()
        print("  Cache cleared successfully")
        
        # Verify cache is empty
        stats_after_clear = uploader.get_cache_stats()
        total_entries = stats_after_clear.get('total_entries', 0)
        print(f"  Cache entries after clear: {total_entries}")
        
        return total_entries == 0
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    
    finally:
        uploader.__exit__(None, None, None)
        # Clean up temporary cache file
        try:
            os.unlink(temp_cache.name)
        except Exception:
            pass


def main():
    """Run all tests."""
    setup_logging()
    
    print("🧪 ImageUploader Test Suite")
    print("="*60)
    
    tests = [
        ("Dry Run Mode", test_dry_run_mode),
        ("Batch Upload", test_batch_upload),
        ("Error Handling", test_error_handling),
        ("Cache Management", test_cache_management),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            print(f"\n🏃 Running test: {test_name}")
            success = test_func()
            results.append((test_name, success))
            
            if success:
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
                
        except Exception as e:
            print(f"💥 {test_name}: CRASHED - {e}")
            results.append((test_name, False))
    
    # Print summary
    print("\n" + "="*60)
    print("📋 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"  {test_name}: {status}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1


if __name__ == '__main__':
    sys.exit(main())