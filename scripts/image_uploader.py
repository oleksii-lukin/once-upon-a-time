#!/usr/bin/env python3
"""
ImageUploader Class for Card Deck System

This module provides the ImageUploader class that orchestrates the entire image upload
process. It uses the UploadThingClient and ImageCacheManager to handle concurrent
uploads efficiently while providing detailed progress reporting and robust error handling.

Features:
- Concurrent uploads with configurable limits (max 5)
- Progress reporting with ETA estimates
- Comprehensive error handling for network/API failures
- Graceful continuation when individual uploads fail
- Integration with caching system to avoid duplicate uploads
"""

import asyncio
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Tuple
from threading import Lock

from uploadthing_client import UploadThingClient, UploadResult, UploadLimits
from image_cache_manager import ImageCacheManager
from image_discovery import ImageDiscoveryService, ImageCollection, ImageFilters


@dataclass
class UploadProgress:
    """Progress information for upload operations."""
    total_files: int = 0
    completed_files: int = 0
    successful_uploads: int = 0
    failed_uploads: int = 0
    cached_urls: int = 0
    skipped_files: int = 0  # Files skipped due to validation failures
    start_time: float = field(default_factory=time.time)
    current_file: Optional[str] = None
    resume_point: Optional[int] = None  # Index of file to resume from
    
    @property
    def completion_percentage(self) -> float:
        """Calculate completion percentage."""
        if self.total_files == 0:
            return 0.0
        return (self.completed_files / self.total_files) * 100
    
    @property
    def elapsed_time(self) -> float:
        """Calculate elapsed time in seconds."""
        return time.time() - self.start_time
    
    @property
    def estimated_time_remaining(self) -> Optional[float]:
        """Calculate estimated time remaining in seconds."""
        if self.completed_files == 0 or self.elapsed_time == 0:
            return None
        
        rate = self.completed_files / self.elapsed_time
        remaining_files = self.total_files - self.completed_files
        
        if rate > 0:
            return remaining_files / rate
        return None
    
    @property
    def upload_rate(self) -> float:
        """Calculate upload rate in files per second."""
        if self.elapsed_time == 0:
            return 0.0
        return self.completed_files / self.elapsed_time


@dataclass
class UploadTask:
    """Represents a single upload task."""
    file_path: str
    image_type: str  # 'card', 'border', 'background', 'category'
    name: str  # Card name, deck name, or category name
    metadata: Dict[str, Any] = field(default_factory=dict)
    validated: bool = False  # Whether the file has been pre-validated
    validation_error: Optional[str] = None  # Validation error if any
    
    def __post_init__(self):
        """Initialize default metadata."""
        if not self.metadata:
            self.metadata = {
                'imageType': self.image_type,
                'imageName': self.name,
                'uploadedBy': 'image-uploader'
            }


@dataclass
class UploadBatchResult:
    """Result of a batch upload operation."""
    successful_uploads: Dict[str, str] = field(default_factory=dict)  # file_path -> url
    failed_uploads: Dict[str, str] = field(default_factory=dict)  # file_path -> error
    cached_urls: Dict[str, str] = field(default_factory=dict)  # file_path -> url
    skipped_files: Dict[str, str] = field(default_factory=dict)  # file_path -> reason
    progress: UploadProgress = field(default_factory=UploadProgress)
    resume_state: Optional[Dict[str, Any]] = None  # State for resuming interrupted operations
    
    @property
    def total_processed(self) -> int:
        """Total number of files processed."""
        return len(self.successful_uploads) + len(self.failed_uploads) + len(self.cached_urls) + len(self.skipped_files)
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        total = self.total_processed
        if total == 0:
            return 0.0
        successful = len(self.successful_uploads) + len(self.cached_urls)
        return (successful / total) * 100


class ImageUploader:
    """
    High-level ImageUploader class that orchestrates the entire upload process.
    
    This class uses the UploadThingClient and ImageCacheManager to handle concurrent
    uploads efficiently while providing detailed progress reporting and robust error handling.
    Supports resumable operations for interrupted batch processing.
    """
    
    def __init__(
        self,
        api_key: str,
        app_id: str,
        cache_file: str = "image_cache.json",
        max_concurrent: int = 5,
        timeout: int = 30,
        retry_attempts: int = 3,
        backoff_factor: float = 1.0,
        upload_limits: Optional[UploadLimits] = None,
        progress_callback: Optional[Callable[[UploadProgress], None]] = None,
        resume_state_file: str = "upload_resume.json"
    ):
        """
        Initialize the ImageUploader.
        
        Args:
            api_key: UploadThing API secret key
            app_id: UploadThing application ID
            cache_file: Path to the cache file for avoiding duplicate uploads
            max_concurrent: Maximum number of concurrent uploads (default: 5)
            timeout: Request timeout in seconds (default: 30)
            retry_attempts: Number of retry attempts for failed requests
            backoff_factor: Backoff factor for exponential backoff
            upload_limits: Custom upload limits configuration
            progress_callback: Optional callback function for progress updates
            resume_state_file: Path to file for storing resume state
        """
        self.api_key = api_key
        self.app_id = app_id
        self.cache_file = cache_file
        self.max_concurrent = max_concurrent
        self.timeout = timeout
        self.retry_attempts = retry_attempts
        self.backoff_factor = backoff_factor
        self.progress_callback = progress_callback
        self.resume_state_file = resume_state_file
        
        self.logger = logging.getLogger('image_uploader')
        
        # Initialize components
        self.upload_client = UploadThingClient(
            api_key=api_key,
            app_id=app_id,
            timeout=timeout,
            cache_file=cache_file,
            retry_attempts=retry_attempts,
            backoff_factor=backoff_factor,
            upload_limits=upload_limits
        )
        
        self.cache_manager = ImageCacheManager(cache_file)
        self.discovery_service = ImageDiscoveryService()
        
        # Thread safety
        self._progress_lock = Lock()
        self._current_progress = UploadProgress()
        
        # Resource management
        self._active_uploads = 0
        self._resource_lock = Lock()
    
    def validate_image_file(self, file_path: str) -> Tuple[bool, Optional[str]]:
        """
        Validate an image file before attempting upload.
        
        Args:
            file_path: Path to the image file
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            file_path_obj = Path(file_path)
            
            # Check if file exists
            if not file_path_obj.exists():
                return False, f"File not found: {file_path}"
            
            # Check if it's a file (not directory)
            if not file_path_obj.is_file():
                return False, f"Path is not a file: {file_path}"
            
            # Check file size
            file_size = file_path_obj.stat().st_size
            if file_size == 0:
                return False, f"File is empty: {file_path}"
            
            if file_size > self.upload_client.limits.max_file_size:
                # Check if compression might help
                if file_size > self.upload_client.limits.compression_threshold:
                    # File might be compressible, allow it through
                    self.logger.debug(f"Large file {file_path} ({file_size} bytes) will be compressed")
                else:
                    return False, f"File too large: {file_size} bytes (max: {self.upload_client.limits.max_file_size} bytes)"
            
            # Check file extension
            extension = file_path_obj.suffix.lower()
            if extension not in {'.jpg', '.jpeg', '.png', '.webp'}:
                return False, f"Unsupported file type: {extension}"
            
            # Check MIME type
            import mimetypes
            mime_type, _ = mimetypes.guess_type(str(file_path_obj))
            if mime_type and mime_type not in self.upload_client.limits.supported_types:
                return False, f"Unsupported MIME type: {mime_type}"
            
            # Try to open the image to verify it's not corrupted
            try:
                from PIL import Image
                with Image.open(file_path_obj) as img:
                    # Verify the image can be loaded
                    img.verify()
                    
                # Re-open to check basic properties (verify() closes the image)
                with Image.open(file_path_obj) as img:
                    width, height = img.size
                    if width == 0 or height == 0:
                        return False, f"Invalid image dimensions: {width}x{height}"
                    
                    # Check for reasonable dimensions (not too large)
                    max_dimension = 10000  # 10k pixels max
                    if width > max_dimension or height > max_dimension:
                        return False, f"Image dimensions too large: {width}x{height} (max: {max_dimension})"
                        
            except Exception as e:
                return False, f"Corrupted or invalid image file: {str(e)}"
            
            return True, None
            
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    def validate_tasks(self, tasks: List[UploadTask]) -> List[UploadTask]:
        """
        Validate all tasks before processing and mark invalid ones.
        
        Args:
            tasks: List of UploadTask objects to validate
            
        Returns:
            List of tasks with validation status updated
        """
        self.logger.info(f"Validating {len(tasks)} upload tasks...")
        
        validated_tasks = []
        for i, task in enumerate(tasks):
            is_valid, error_message = self.validate_image_file(task.file_path)
            
            task.validated = is_valid
            task.validation_error = error_message
            
            if is_valid:
                self.logger.debug(f"Task {i+1}/{len(tasks)} valid: {task.file_path}")
            else:
                self.logger.warning(f"Task {i+1}/{len(tasks)} invalid: {task.file_path} - {error_message}")
            
            validated_tasks.append(task)
        
        valid_count = sum(1 for task in validated_tasks if task.validated)
        invalid_count = len(validated_tasks) - valid_count
        
        self.logger.info(f"Validation complete: {valid_count} valid, {invalid_count} invalid tasks")
        
        return validated_tasks
    
    def save_resume_state(self, tasks: List[UploadTask], current_index: int, results: UploadBatchResult) -> None:
        """
        Save the current state for resuming interrupted operations.
        
        Args:
            tasks: List of all tasks
            current_index: Index of the current task being processed
            results: Current batch results
        """
        try:
            resume_state = {
                'version': '1.0',
                'timestamp': time.time(),
                'current_index': current_index,
                'total_tasks': len(tasks),
                'completed_files': results.progress.completed_files,
                'successful_uploads': results.successful_uploads.copy(),
                'failed_uploads': results.failed_uploads.copy(),
                'cached_urls': results.cached_urls.copy(),
                'skipped_files': results.skipped_files.copy(),
                'remaining_tasks': [
                    {
                        'file_path': task.file_path,
                        'image_type': task.image_type,
                        'name': task.name,
                        'metadata': task.metadata,
                        'validated': task.validated,
                        'validation_error': task.validation_error
                    }
                    for task in tasks[current_index:]
                ]
            }
            
            with open(self.resume_state_file, 'w', encoding='utf-8') as f:
                json.dump(resume_state, f, indent=2, ensure_ascii=False)
            
            self.logger.debug(f"Resume state saved to {self.resume_state_file}")
            
        except Exception as e:
            self.logger.warning(f"Failed to save resume state: {e}")
    
    def load_resume_state(self) -> Optional[Dict[str, Any]]:
        """
        Load resume state from previous interrupted operation.
        
        Returns:
            Resume state dictionary if found and valid, None otherwise
        """
        try:
            if not Path(self.resume_state_file).exists():
                return None
            
            with open(self.resume_state_file, 'r', encoding='utf-8') as f:
                resume_state = json.load(f)
            
            # Validate resume state structure
            required_fields = ['version', 'timestamp', 'current_index', 'remaining_tasks']
            for field in required_fields:
                if field not in resume_state:
                    self.logger.warning(f"Invalid resume state: missing field '{field}'")
                    return None
            
            # Check if resume state is too old (more than 24 hours)
            age = time.time() - resume_state.get('timestamp', 0)
            if age > 24 * 60 * 60:  # 24 hours
                self.logger.info(f"Resume state is too old ({age/3600:.1f} hours), ignoring")
                return None
            
            self.logger.info(f"Found resume state with {len(resume_state['remaining_tasks'])} remaining tasks")
            return resume_state
            
        except Exception as e:
            self.logger.warning(f"Failed to load resume state: {e}")
            return None
    
    def clear_resume_state(self) -> None:
        """Clear the resume state file."""
        try:
            if Path(self.resume_state_file).exists():
                Path(self.resume_state_file).unlink()
                self.logger.debug(f"Resume state file cleared: {self.resume_state_file}")
        except Exception as e:
            self.logger.warning(f"Failed to clear resume state: {e}")
    
    def create_tasks_from_resume_state(self, resume_state: Dict[str, Any]) -> List[UploadTask]:
        """
        Create UploadTask objects from resume state.
        
        Args:
            resume_state: Resume state dictionary
            
        Returns:
            List of UploadTask objects
        """
        tasks = []
        for task_data in resume_state.get('remaining_tasks', []):
            task = UploadTask(
                file_path=task_data['file_path'],
                image_type=task_data['image_type'],
                name=task_data['name'],
                metadata=task_data.get('metadata', {}),
                validated=task_data.get('validated', False),
                validation_error=task_data.get('validation_error')
            )
            tasks.append(task)
        
        return tasks
    
    def upload_image_collection(
        self,
        collection: ImageCollection,
        dry_run: bool = False,
        resume: bool = True
    ) -> UploadBatchResult:
        """
        Upload all images in an ImageCollection with concurrent processing and resumable operations.
        
        Args:
            collection: ImageCollection containing images to upload
            dry_run: If True, simulate uploads without actually uploading
            resume: If True, attempt to resume from previous interrupted operation
            
        Returns:
            UploadBatchResult with detailed results and progress information
        """
        self.logger.info("Starting batch upload of image collection")
        
        # Check for resume state if requested
        resume_state = None
        if resume:
            resume_state = self.load_resume_state()
        
        if resume_state:
            self.logger.info(f"Resuming from previous operation with {len(resume_state['remaining_tasks'])} remaining tasks")
            
            # Create tasks from resume state
            tasks = self.create_tasks_from_resume_state(resume_state)
            
            # Initialize result with previous progress
            result = UploadBatchResult()
            result.successful_uploads = resume_state.get('successful_uploads', {})
            result.failed_uploads = resume_state.get('failed_uploads', {})
            result.cached_urls = resume_state.get('cached_urls', {})
            result.skipped_files = resume_state.get('skipped_files', {})
            
            # Update progress
            with self._progress_lock:
                self._current_progress = UploadProgress(
                    total_files=resume_state.get('total_tasks', len(tasks)),
                    completed_files=resume_state.get('completed_files', 0),
                    successful_uploads=len(result.successful_uploads),
                    failed_uploads=len(result.failed_uploads),
                    cached_urls=len(result.cached_urls),
                    skipped_files=len(result.skipped_files),
                    resume_point=resume_state.get('current_index', 0)
                )
                result.progress = self._current_progress
        else:
            # Create upload tasks from collection
            tasks = self._create_upload_tasks_from_collection(collection)
            
            if not tasks:
                self.logger.warning("No upload tasks created from collection")
                return UploadBatchResult()
            
            # Validate all tasks before processing
            tasks = self.validate_tasks(tasks)
            
            # Initialize result
            result = UploadBatchResult()
            
            # Initialize progress
            with self._progress_lock:
                self._current_progress = UploadProgress(total_files=len(tasks))
                result.progress = self._current_progress
        
        # Execute batch upload with resumable support
        return self._execute_resumable_batch_upload(tasks, result, dry_run=dry_run)
    
    def upload_discovered_images(
        self,
        base_path: str = "specs/decks",
        filters: Optional[ImageFilters] = None,
        dry_run: bool = False
    ) -> UploadBatchResult:
        """
        Discover and upload images with filtering support.
        
        Args:
            base_path: Base directory to search for decks
            filters: Optional filters to limit discovery scope
            dry_run: If True, simulate uploads without actually uploading
            
        Returns:
            UploadBatchResult with detailed results and progress information
        """
        self.logger.info(f"Discovering images in {base_path}")
        
        # Discover images
        self.discovery_service.base_path = Path(base_path)
        collection = self.discovery_service.discover_all_images(filters)
        
        # Upload discovered images
        return self.upload_image_collection(collection, dry_run=dry_run)
    
    def upload_batch(
        self,
        file_paths: List[str],
        image_type: str = "generic",
        dry_run: bool = False
    ) -> UploadBatchResult:
        """
        Upload a batch of files with concurrent processing.
        
        Args:
            file_paths: List of file paths to upload
            image_type: Type of images being uploaded
            dry_run: If True, simulate uploads without actually uploading
            
        Returns:
            UploadBatchResult with detailed results and progress information
        """
        self.logger.info(f"Starting batch upload of {len(file_paths)} files")
        
        # Create upload tasks
        tasks = []
        for file_path in file_paths:
            file_name = Path(file_path).stem
            task = UploadTask(
                file_path=file_path,
                image_type=image_type,
                name=file_name
            )
            tasks.append(task)
        
        # Execute batch upload
        return self._execute_batch_upload(tasks, dry_run=dry_run)
    
    def _create_upload_tasks_from_collection(self, collection: ImageCollection) -> List[UploadTask]:
        """
        Create upload tasks from an ImageCollection.
        
        Args:
            collection: ImageCollection to process
            
        Returns:
            List of UploadTask objects
        """
        tasks = []
        
        # Process deck images
        for deck_name, deck_images in collection.deck_images.items():
            # Border image
            if deck_images.border_image:
                task = UploadTask(
                    file_path=deck_images.border_image,
                    image_type="border",
                    name=deck_name,
                    metadata={
                        'imageType': 'border',
                        'deckName': deck_name,
                        'uploadedBy': 'image-uploader'
                    }
                )
                tasks.append(task)
            
            # Background image
            if deck_images.background_image:
                task = UploadTask(
                    file_path=deck_images.background_image,
                    image_type="background",
                    name=deck_name,
                    metadata={
                        'imageType': 'background',
                        'deckName': deck_name,
                        'uploadedBy': 'image-uploader'
                    }
                )
                tasks.append(task)
            
            # Category images
            for category, image_path in deck_images.category_images.items():
                task = UploadTask(
                    file_path=image_path,
                    image_type="category",
                    name=f"{deck_name}-{category}",
                    metadata={
                        'imageType': 'category',
                        'deckName': deck_name,
                        'categoryName': category,
                        'uploadedBy': 'image-uploader'
                    }
                )
                tasks.append(task)
        
        # Process card images
        for card_image in collection.card_images:
            task = UploadTask(
                file_path=card_image.file_path,
                image_type="card",
                name=card_image.card_name,
                metadata={
                    'imageType': 'card',
                    'cardName': card_image.card_name,
                    'deckName': card_image.deck_name,
                    'categoryName': card_image.category,
                    'locale': card_image.locale,
                    'uploadedBy': 'image-uploader'
                }
            )
            tasks.append(task)
        
        self.logger.debug(f"Created {len(tasks)} upload tasks from collection")
        return tasks
    
    def _execute_resumable_batch_upload(
        self, 
        tasks: List[UploadTask], 
        result: UploadBatchResult, 
        dry_run: bool = False
    ) -> UploadBatchResult:
        """
        Execute a batch of upload tasks with resumable support and proper resource management.
        
        Args:
            tasks: List of UploadTask objects to process
            result: Existing UploadBatchResult to continue from
            dry_run: If True, simulate uploads without actually uploading
            
        Returns:
            UploadBatchResult with detailed results
        """
        if not tasks:
            self.logger.info("No tasks to process")
            return result
        
        self.logger.info(f"Processing {len(tasks)} upload tasks with max {self.max_concurrent} concurrent uploads")
        
        if dry_run:
            self.logger.info("DRY RUN MODE - No actual uploads will be performed")
        
        # Track resource usage
        with self._resource_lock:
            self._active_uploads = 0
        
        try:
            # Process tasks with resumable support
            with ThreadPoolExecutor(max_workers=self.max_concurrent) as executor:
                # Submit tasks in batches to manage resources
                future_to_task = {}
                task_index = result.progress.resume_point or 0
                
                while task_index < len(tasks):
                    # Submit up to max_concurrent tasks
                    batch_size = min(self.max_concurrent, len(tasks) - task_index)
                    batch_tasks = tasks[task_index:task_index + batch_size]
                    
                    # Submit batch
                    for i, task in enumerate(batch_tasks):
                        current_task_index = task_index + i
                        future = executor.submit(self._process_single_task_with_resources, task, dry_run, current_task_index)
                        future_to_task[future] = (task, current_task_index)
                    
                    # Process completed tasks in this batch
                    for future in as_completed(future_to_task):
                        task, current_task_index = future_to_task[future]
                        
                        try:
                            upload_result, was_cached = future.result()
                            
                            # Update results
                            if not task.validated:
                                # Task failed validation
                                result.skipped_files[task.file_path] = task.validation_error or "Validation failed"
                            elif upload_result.success:
                                if was_cached:
                                    result.cached_urls[task.file_path] = upload_result.url
                                else:
                                    result.successful_uploads[task.file_path] = upload_result.url
                            else:
                                result.failed_uploads[task.file_path] = upload_result.error or "Unknown error"
                            
                            # Update progress
                            with self._progress_lock:
                                self._current_progress.completed_files += 1
                                if not task.validated:
                                    self._current_progress.skipped_files += 1
                                elif upload_result.success:
                                    if was_cached:
                                        self._current_progress.cached_urls += 1
                                    else:
                                        self._current_progress.successful_uploads += 1
                                else:
                                    self._current_progress.failed_uploads += 1
                                
                                self._current_progress.current_file = None
                                
                                # Save resume state periodically
                                if self._current_progress.completed_files % 10 == 0:
                                    self.save_resume_state(tasks, current_task_index + 1, result)
                                
                                # Call progress callback if provided
                                if self.progress_callback:
                                    try:
                                        self.progress_callback(self._current_progress)
                                    except Exception as e:
                                        self.logger.warning(f"Progress callback error: {e}")
                        
                        except Exception as e:
                            self.logger.error(f"Unexpected error processing task {task.file_path}: {e}")
                            result.failed_uploads[task.file_path] = str(e)
                            
                            # Update progress for failed task
                            with self._progress_lock:
                                self._current_progress.completed_files += 1
                                self._current_progress.failed_uploads += 1
                                self._current_progress.current_file = None
                        
                        # Remove processed future
                        del future_to_task[future]
                    
                    # Move to next batch
                    task_index += batch_size
                    
                    # Clear futures for next batch
                    future_to_task.clear()
        
        except KeyboardInterrupt:
            self.logger.info("Upload interrupted by user")
            # Save current state for resuming
            with self._progress_lock:
                current_index = self._current_progress.completed_files
            self.save_resume_state(tasks, current_index, result)
            raise
        
        except Exception as e:
            self.logger.error(f"Unexpected error during batch upload: {e}")
            # Save current state for resuming
            with self._progress_lock:
                current_index = self._current_progress.completed_files
            self.save_resume_state(tasks, current_index, result)
            raise
        
        # Final progress update
        with self._progress_lock:
            result.progress = self._current_progress
        
        # Clear resume state on successful completion
        self.clear_resume_state()
        
        # Log summary
        total_processed = result.total_processed
        success_rate = result.success_rate
        
        self.logger.info(f"Batch upload completed: {total_processed} files processed")
        self.logger.info(f"Success rate: {success_rate:.1f}%")
        self.logger.info(f"Successful uploads: {len(result.successful_uploads)}")
        self.logger.info(f"Cached URLs used: {len(result.cached_urls)}")
        self.logger.info(f"Failed uploads: {len(result.failed_uploads)}")
        self.logger.info(f"Skipped files: {len(result.skipped_files)}")
        
        if result.failed_uploads:
            self.logger.warning("Failed uploads:")
            for file_path, error in result.failed_uploads.items():
                self.logger.warning(f"  {file_path}: {error}")
        
        if result.skipped_files:
            self.logger.info("Skipped files:")
            for file_path, reason in result.skipped_files.items():
                self.logger.info(f"  {file_path}: {reason}")
        
        return result
    
    def _process_single_task_with_resources(
        self, 
        task: UploadTask, 
        dry_run: bool = False, 
        task_index: int = 0
    ) -> Tuple[UploadResult, bool]:
        """
        Process a single upload task with proper resource management.
        
        Args:
            task: UploadTask to process
            dry_run: If True, simulate upload without actually uploading
            task_index: Index of the task for resume state tracking
            
        Returns:
            Tuple of (UploadResult, was_cached)
        """
        # Acquire resource
        with self._resource_lock:
            self._active_uploads += 1
            current_active = self._active_uploads
        
        try:
            self.logger.debug(f"Processing task {task_index}: {task.file_path} (active uploads: {current_active})")
            
            # Check if task passed validation
            if not task.validated:
                self.logger.warning(f"Skipping invalid task: {task.file_path} - {task.validation_error}")
                return UploadResult(
                    success=False,
                    error=task.validation_error or "Validation failed",
                    original_filename=Path(task.file_path).name
                ), False
            
            # Process the task
            return self._process_single_task(task, dry_run)
        
        finally:
            # Release resource
            with self._resource_lock:
                self._active_uploads -= 1
    
    def _execute_batch_upload(self, tasks: List[UploadTask], dry_run: bool = False) -> UploadBatchResult:
        """
        Execute a batch of upload tasks with concurrent processing.
        
        Args:
            tasks: List of UploadTask objects to process
            dry_run: If True, simulate uploads without actually uploading
            
        Returns:
            UploadBatchResult with detailed results
        """
        result = UploadBatchResult()
        
        # Initialize progress
        with self._progress_lock:
            self._current_progress = UploadProgress(total_files=len(tasks))
            result.progress = self._current_progress
        
        if not tasks:
            self.logger.info("No tasks to process")
            return result
        
        self.logger.info(f"Processing {len(tasks)} upload tasks with max {self.max_concurrent} concurrent uploads")
        
        if dry_run:
            self.logger.info("DRY RUN MODE - No actual uploads will be performed")
        
        # Process tasks concurrently
        with ThreadPoolExecutor(max_workers=self.max_concurrent) as executor:
            # Submit all tasks
            future_to_task = {
                executor.submit(self._process_single_task, task, dry_run): task
                for task in tasks
            }
            
            # Process completed tasks
            for future in as_completed(future_to_task):
                task = future_to_task[future]
                
                try:
                    upload_result, was_cached = future.result()
                    
                    # Update results
                    if upload_result.success:
                        if was_cached:
                            result.cached_urls[task.file_path] = upload_result.url
                        else:
                            result.successful_uploads[task.file_path] = upload_result.url
                    else:
                        result.failed_uploads[task.file_path] = upload_result.error or "Unknown error"
                    
                    # Update progress
                    with self._progress_lock:
                        self._current_progress.completed_files += 1
                        if upload_result.success:
                            if was_cached:
                                self._current_progress.cached_urls += 1
                            else:
                                self._current_progress.successful_uploads += 1
                        else:
                            self._current_progress.failed_uploads += 1
                        
                        self._current_progress.current_file = None
                        
                        # Call progress callback if provided
                        if self.progress_callback:
                            try:
                                self.progress_callback(self._current_progress)
                            except Exception as e:
                                self.logger.warning(f"Progress callback error: {e}")
                
                except Exception as e:
                    self.logger.error(f"Unexpected error processing task {task.file_path}: {e}")
                    result.failed_uploads[task.file_path] = str(e)
                    
                    # Update progress for failed task
                    with self._progress_lock:
                        self._current_progress.completed_files += 1
                        self._current_progress.failed_uploads += 1
                        self._current_progress.current_file = None
        
        # Final progress update
        with self._progress_lock:
            result.progress = self._current_progress
        
        # Log summary
        total_processed = result.total_processed
        success_rate = result.success_rate
        
        self.logger.info(f"Batch upload completed: {total_processed} files processed")
        self.logger.info(f"Success rate: {success_rate:.1f}%")
        self.logger.info(f"Successful uploads: {len(result.successful_uploads)}")
        self.logger.info(f"Cached URLs used: {len(result.cached_urls)}")
        self.logger.info(f"Failed uploads: {len(result.failed_uploads)}")
        
        if result.failed_uploads:
            self.logger.warning("Failed uploads:")
            for file_path, error in result.failed_uploads.items():
                self.logger.warning(f"  {file_path}: {error}")
        
        return result
    
    def _process_single_task(self, task: UploadTask, dry_run: bool = False) -> Tuple[UploadResult, bool]:
        """
        Process a single upload task.
        
        Args:
            task: UploadTask to process
            dry_run: If True, simulate upload without actually uploading
            
        Returns:
            Tuple of (UploadResult, was_cached)
        """
        # Update current file in progress
        with self._progress_lock:
            self._current_progress.current_file = task.file_path
        
        self.logger.debug(f"Processing {task.image_type} '{task.name}': {task.file_path}")
        
        if dry_run:
            # Even in dry-run mode, check if file exists for realistic testing
            if not Path(task.file_path).exists():
                result = UploadResult(
                    success=False,
                    error=f"File not found: {task.file_path}",
                    original_filename=Path(task.file_path).name
                )
                self.logger.debug(f"[DRY RUN] File not found: {task.file_path}")
                return result, False
            
            # Simulate upload with mock result
            time.sleep(0.1)  # Simulate processing time
            mock_url = f"https://uploadthing.com/f/mock-{task.image_type}-{task.name.lower().replace(' ', '-')}.jpg"
            
            result = UploadResult(
                success=True,
                url=mock_url,
                file_key=f"mock-{task.name}",
                file_size=Path(task.file_path).stat().st_size,
                original_filename=Path(task.file_path).name
            )
            
            self.logger.debug(f"[DRY RUN] Mock upload result: {mock_url}")
            return result, False
        
        try:
            # Check if file exists
            if not Path(task.file_path).exists():
                return UploadResult(
                    success=False,
                    error=f"File not found: {task.file_path}",
                    original_filename=Path(task.file_path).name
                ), False
            
            # Calculate file hash for cache checking
            file_hash = self.cache_manager.calculate_file_hash(task.file_path)
            if not file_hash:
                self.logger.warning(f"Could not calculate hash for {task.file_path}, proceeding without cache")
            
            # Check cache first
            was_cached = False
            if file_hash:
                cached_url = self.cache_manager.get_cached_url(task.file_path, file_hash)
                if cached_url:
                    # Validate cached URL
                    if self.cache_manager.validate_url(cached_url):
                        self.logger.debug(f"Using cached URL for {task.file_path}: {cached_url}")
                        
                        result = UploadResult(
                            success=True,
                            url=cached_url,
                            file_key=cached_url.split('/')[-1] if '/' in cached_url else None,
                            file_size=Path(task.file_path).stat().st_size,
                            original_filename=Path(task.file_path).name
                        )
                        
                        return result, True
                    else:
                        self.logger.debug(f"Cached URL is invalid, will re-upload: {cached_url}")
            
            # Perform actual upload
            result = self.upload_client.upload_file(task.file_path, metadata=task.metadata)
            
            if result.success:
                self.logger.debug(f"Successfully uploaded {task.image_type} '{task.name}': {result.url}")
            else:
                self.logger.error(f"Failed to upload {task.image_type} '{task.name}': {result.error}")
            
            return result, was_cached
            
        except Exception as e:
            self.logger.error(f"Unexpected error processing {task.file_path}: {e}")
            return UploadResult(
                success=False,
                error=f"Unexpected error: {str(e)}",
                original_filename=Path(task.file_path).name
            ), False
    
    def get_progress(self) -> UploadProgress:
        """
        Get current upload progress.
        
        Returns:
            Current UploadProgress object
        """
        with self._progress_lock:
            return self._current_progress
    
    def validate_credentials(self) -> bool:
        """
        Validate UploadThing credentials.
        
        Returns:
            True if credentials are valid, False otherwise
        """
        return self.upload_client.validate_credentials()
    
    def clear_cache(self) -> None:
        """Clear the upload cache."""
        self.cache_manager.clear_cache()
    
    def validate_cache(self) -> int:
        """
        Validate cached URLs and remove invalid ones.
        
        Returns:
            Number of invalid URLs removed
        """
        return self.cache_manager.remove_invalid_urls()
    
    def get_cache_stats(self) -> Dict[str, Any]:
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
        """Context manager exit."""
        if hasattr(self, 'upload_client'):
            self.upload_client.__exit__(exc_type, exc_val, exc_tb)
        if hasattr(self, 'cache_manager'):
            self.cache_manager.__exit__(exc_type, exc_val, exc_tb)