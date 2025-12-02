# UploadThing Setup Guide

## Overview
This project now uses [UploadThing](https://uploadthing.com/) for convenient image uploads. UploadThing provides 2GB of free storage, which is perfect for demo purposes.

## Setup Instructions

### 1. Create an UploadThing Account
1. Go to [uploadthing.com](https://uploadthing.com/)
2. Sign up for a free account
3. Create a new app

### 2. Get Your API Token
1. In your UploadThing dashboard, navigate to the API Keys section
2. Copy your **App Token**

### 3. Add Environment Variable
Add the following to your `.env.local` file:

```bash
UPLOADTHING_TOKEN=your_token_here
```

### 4. Restart Your Development Server
After adding the environment variable, restart your Next.js development server:

```bash
npm run dev
```

## Usage

The image upload component is now integrated into the Deck Editor. When creating or editing cards:

1. **Upload via File**: Click the "Choose Image" button to upload an image from your computer
2. **Upload via URL**: Alternatively, paste an image URL directly in the text field below the upload button

The uploaded images will be stored on UploadThing's CDN and automatically optimized for web delivery.

## Features

- ✅ Drag and drop support
- ✅ Image preview before saving
- ✅ Remove uploaded images
- ✅ Fallback to URL input
- ✅ Max file size: 4MB
- ✅ Supported formats: PNG, JPG, JPEG, GIF, WebP
- ✅ Authenticated uploads (requires Clerk login)

## Storage Limits

The free tier includes:
- 2GB total storage
- Unlimited uploads
- Unlimited bandwidth

This should be more than sufficient for demo purposes.
