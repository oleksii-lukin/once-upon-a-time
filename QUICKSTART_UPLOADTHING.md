# Quick Start: UploadThing Setup

## 🚀 3-Minute Setup

### Step 1: Get Your Token
1. Go to **[uploadthing.com](https://uploadthing.com/)**
2. Click **"Sign Up"** (use GitHub for fastest signup)
3. Create a new app
4. Copy your **App Token** from the dashboard

### Step 2: Add to Environment
Open your `.env.local` file and add:
```bash
UPLOADTHING_TOKEN=paste_your_token_here
```

### Step 3: Restart Server
```bash
# Stop the current dev server (Ctrl+C)
npm run dev
```

## ✅ That's It!

You can now:
- Upload images when creating/editing cards
- Drag & drop images
- Preview images before saving
- Still use URL input as a fallback

## 📸 How to Use

1. Navigate to **Admin > Decks**
2. Create or edit a card
3. Look for the **"Card Image"** section
4. Either:
   - Click **"Choose Image"** to upload from your computer
   - Or paste a URL in the text field below

## 💡 Tips

- **Max file size**: 4MB
- **Supported formats**: PNG, JPG, JPEG, GIF, WebP
- **Storage**: 2GB free (plenty for demos!)
- **Images are automatically optimized** for web delivery

## 🔒 Security

- Only authenticated users can upload
- Files are scanned for malware
- Automatic CDN delivery
- HTTPS encryption

---

Need help? Check `UPLOADTHING_SETUP.md` for detailed documentation.
