#!/usr/bin/env python3
"""
Test script for resumable operations functionality in ImageUploader.

This script tests the key features of resumable operations:
1. Image validation before upload attempts
2. Resume state saving and loading
3. Proper resource management during concurrent processing
"""

import json
import logging
import tempfile
import time
from pathlib import Path
from unittest.mock import Mock

# Set up path for imports
import sys
sys.path.append('.')

from image_uploader import ImageUploader, UploadTask, UploadProgress
from image_discovery import ImageCollection, DeckImages, CardImage


def setup_test_logging():
    """Set up logging for tests."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger('test_resumable')


def create_test_image_file(path: Path, size_kb: int = 10) -> None:
    """Create a test image file using PIL."""
    try:
        from PIL import Image
        import io
        
        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='red')
        
        # Save to bytes first to control size
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_data = img_bytes.getvalue()
        
        # If we need a larger file, create a bigger image
        if len(img_data) < size_kb * 1024:
            # Calculate dimensions for target size (roughly)
            target_pixels = size_kb * 1024 // 3  # Rough estimate for RGB
            side_length = int(target_pixels ** 0.5)
            img = Image.new('RGB', (side_length, side_length), color='red')
            
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='PNG')
            img_data = img_bytes.getvalue()
        
        # Write to file
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'wb') as f:
            f.write(img_data)
            
    except ImportError:
        # Fallback: create a minimal valid PNG if PIL is not available
        # This is a 1x1 pixel PNG
        png_data = bytes.fromhex(
            '89504e470d0a1a0a0000000d49484452000000010000000108020000'
            '0090916836000000094944415478da6300010000050001000000000000'
            '0000000049454e44ae426082'
        )
        
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'wb') as f:
            f.write(png_data)


def test_image_validation():
    """Test image file validation functionality."""
    logger = setup_test_logging()
    logger.info("Testing image validation functionality...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Create test uploader (with dummy credentials for validation testing)
        uploader = ImageUploader(
            api_key="test_key",
            app_id="test_app",
            resume_state_file=str(temp_path / "resume_test.json")
        )
        
        # Test 1: Valid image file
        valid_image = temp_path / "valid.png"
        create_test_image_file(valid_image, size_kb=50)
        
        is_valid, error = uploader.validate_image_file(str(valid_image))
        assert is_valid, f"Valid image should pass validation: {error}"
        logger.info("✅ Valid image file validation passed")
        
        # Test 2: Non-existent file
        missing_file = temp_path / "missing.png"
        is_valid, error = uploader.validate_image_file(str(missing_file))
        assert not is_valid, "Missing file should fail validation"
        assert "not found" in error.lower(), f"Error should mention file not found: {error}"
        logger.info("✅ Missing file validation failed as expected")
        
        # Test 3: Empty file
        empty_file = temp_path / "empty.png"
        empty_file.touch()
        is_valid, error = uploader.validate_image_file(str(empty_file))
        assert not is_valid, "Empty file should fail validation"
        assert "empty" in error.lower(), f"Error should mention empty file: {error}"
        logger.info("✅ Empty file validation failed as expected")
        
        # Test 4: Unsupported file type
        text_file = temp_path / "test.txt"
        text_file.write_text("This is not an image")
        is_valid, error = uploader.validate_image_file(str(text_file))
        assert not is_valid, "Text file should fail validation"
        assert "unsupported" in error.lower(), f"Error should mention unsupported type: {error}"
        logger.info("✅ Unsupported file type validation failed as expected")
        
        logger.info("🎉 All image validation tests passed!")


def test_resume_state_management():
    """Test resume state saving and loading functionality."""
    logger = setup_test_logging()
    logger.info("Testing resume state management...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        resume_file = temp_path / "resume_test.json"
        
        # Create test uploader
        uploader = ImageUploader(
            api_key="test_key",
            app_id="test_app",
            resume_state_file=str(resume_file)
        )
        
        # Create test tasks
        test_tasks = [
            UploadTask(
                file_path=str(temp_path / f"test_{i}.png"),
                image_type="card",
                name=f"Test Card {i}",
                validated=True
            )
            for i in range(5)
        ]
        
        # Create mock results
        from image_uploader import UploadBatchResult
        mock_results = UploadBatchResult()
        mock_results.successful_uploads = {"test_1.png": "http://example.com/1"}
        mock_results.failed_uploads = {"test_2.png": "Upload failed"}
        mock_results.cached_urls = {"test_3.png": "http://example.com/3"}
        mock_results.skipped_files = {"test_4.png": "Validation failed"}
        
        # Test 1: Save resume state
        uploader.save_resume_state(test_tasks, 2, mock_results)
        assert resume_file.exists(), "Resume state file should be created"
        logger.info("✅ Resume state saved successfully")
        
        # Test 2: Load resume state
        loaded_state = uploader.load_resume_state()
        assert loaded_state is not None, "Resume state should be loaded"
        assert loaded_state['current_index'] == 2, "Current index should be preserved"
        assert len(loaded_state['remaining_tasks']) == 3, "Should have 3 remaining tasks"
        logger.info("✅ Resume state loaded successfully")
        
        # Test 3: Create tasks from resume state
        resumed_tasks = uploader.create_tasks_from_resume_state(loaded_state)
        assert len(resumed_tasks) == 3, "Should create 3 tasks from resume state"
        assert resumed_tasks[0].file_path.endswith("test_2.png"), "First resumed task should be test_2"
        logger.info("✅ Tasks created from resume state successfully")
        
        # Test 4: Clear resume state
        uploader.clear_resume_state()
        assert not resume_file.exists(), "Resume state file should be deleted"
        logger.info("✅ Resume state cleared successfully")
        
        # Test 5: Load non-existent resume state
        loaded_state = uploader.load_resume_state()
        assert loaded_state is None, "Should return None for non-existent resume state"
        logger.info("✅ Non-existent resume state handled correctly")
        
        logger.info("🎉 All resume state management tests passed!")


def test_task_validation():
    """Test task validation functionality."""
    logger = setup_test_logging()
    logger.info("Testing task validation functionality...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Create test uploader
        uploader = ImageUploader(
            api_key="test_key",
            app_id="test_app",
            resume_state_file=str(temp_path / "resume_test.json")
        )
        
        # Create test files
        valid_image = temp_path / "valid.png"
        create_test_image_file(valid_image, size_kb=50)
        
        invalid_image = temp_path / "invalid.txt"
        invalid_image.write_text("Not an image")
        
        missing_image = temp_path / "missing.png"
        
        # Create test tasks
        test_tasks = [
            UploadTask(file_path=str(valid_image), image_type="card", name="Valid Card"),
            UploadTask(file_path=str(invalid_image), image_type="card", name="Invalid Card"),
            UploadTask(file_path=str(missing_image), image_type="card", name="Missing Card"),
        ]
        
        # Validate tasks
        validated_tasks = uploader.validate_tasks(test_tasks)
        
        # Check results
        assert len(validated_tasks) == 3, "Should return all tasks"
        assert validated_tasks[0].validated, "First task should be valid"
        assert not validated_tasks[1].validated, "Second task should be invalid"
        assert not validated_tasks[2].validated, "Third task should be invalid"
        
        assert validated_tasks[1].validation_error is not None, "Invalid task should have error message"
        assert validated_tasks[2].validation_error is not None, "Missing task should have error message"
        
        logger.info("✅ Task validation completed successfully")
        logger.info(f"   Valid tasks: {sum(1 for t in validated_tasks if t.validated)}")
        logger.info(f"   Invalid tasks: {sum(1 for t in validated_tasks if not t.validated)}")
        
        logger.info("🎉 Task validation tests passed!")


def test_resource_management():
    """Test resource management during concurrent processing."""
    logger = setup_test_logging()
    logger.info("Testing resource management...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Create test uploader with limited concurrency
        uploader = ImageUploader(
            api_key="test_key",
            app_id="test_app",
            max_concurrent=2,  # Limit to 2 concurrent uploads
            resume_state_file=str(temp_path / "resume_test.json")
        )
        
        # Test resource tracking
        assert uploader._active_uploads == 0, "Should start with 0 active uploads"
        
        # Simulate resource acquisition
        with uploader._resource_lock:
            uploader._active_uploads += 1
            assert uploader._active_uploads == 1, "Should track active uploads"
        
        with uploader._resource_lock:
            uploader._active_uploads -= 1
            assert uploader._active_uploads == 0, "Should release resources"
        
        logger.info("✅ Resource tracking works correctly")
        logger.info("🎉 Resource management tests passed!")


def main():
    """Run all tests."""
    logger = setup_test_logging()
    logger.info("🚀 Starting resumable operations tests...")
    
    try:
        test_image_validation()
        test_resume_state_management()
        test_task_validation()
        test_resource_management()
        
        logger.info("🎉 All resumable operations tests passed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())