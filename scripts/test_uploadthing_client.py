#!/usr/bin/env python3
"""
Test script for UploadThingClient
"""

import os
import sys
from pathlib import Path

# Add current directory to path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent))

from uploadthing_client import UploadThingClient
from upload_images import decode_uploadthing_token, load_env_file

def test_client():
    """Test the UploadThingClient with real credentials."""
    
    # Load environment variables
    env_vars = load_env_file('.env.local')  # Fixed path
    env_vars.update(os.environ)
    
    print(f"Environment variables loaded: {len(env_vars)}")
    print(f"UPLOADTHING_TOKEN present: {'UPLOADTHING_TOKEN' in env_vars}")
    
    # Try to get credentials
    api_key = env_vars.get('UPLOADTHING_SECRET')
    app_id = env_vars.get('UPLOADTHING_APP_ID')
    
    print(f"Direct credentials - API Key: {api_key}, App ID: {app_id}")
    
    if not api_key or not app_id:
        # Try to decode token
        token = env_vars.get('UPLOADTHING_TOKEN')
        print(f"Token found: {bool(token)}")
        if token:
            api_key, app_id = decode_uploadthing_token(token)
            print(f"Decoded credentials - API Key: {api_key[:20] if api_key else None}..., App ID: {app_id}")
    
    if not api_key or not app_id:
        print("❌ No valid UploadThing credentials found")
        return False
    
    print(f"✅ Found credentials:")
    print(f"   API Key: {api_key[:20]}...")
    print(f"   App ID: {app_id}")
    
    # Create client
    try:
        client = UploadThingClient(api_key=api_key, app_id=app_id)
        print("✅ Client created successfully")
        
        # Get upload limits
        limits = client.get_upload_limits()
        print(f"✅ Upload limits: {limits.max_file_size} bytes, types: {limits.supported_types}")
        
        # Test credential validation
        print("🔍 Validating credentials...")
        is_valid = client.validate_credentials()
        print(f"{'✅' if is_valid else '❌'} Credential validation: {'PASSED' if is_valid else 'FAILED'}")
        
        return is_valid
        
    except Exception as e:
        print(f"❌ Error creating client: {e}")
        return False

if __name__ == '__main__':
    test_client()