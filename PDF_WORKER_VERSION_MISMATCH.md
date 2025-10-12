# PDF.js Worker Version Mismatch Fix

## The Problem

If you see this error in the console:

```
The API version "5.4.296" does not match the Worker version "5.3.93".
```

This means the `pdfjs-dist` package version doesn't match the PDF.js worker file in `public/pdf.worker.min.js`.

## Why This Happens

- The `pdfjs-dist` package gets updated when you run `npm install` or `npm update`
- The worker file in `public/pdf.worker.min.js` is a static file that doesn't auto-update
- PDF.js requires the worker file version to exactly match the package version

## The Solution

### Automatic Fix (Recommended)

The `postinstall` script in `package.json` automatically updates the worker file after every `npm install`:

```json
{
  "scripts": {
    "postinstall": "node update-pdf-worker.js"
  }
}
```

### Manual Fix

If you need to update the worker file manually:

```bash
node update-pdf-worker.js
```

Or copy it directly:

```bash
# Windows PowerShell
Copy-Item "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" "public\pdf.worker.min.js" -Force

# Mac/Linux
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
```

## How It Works

The `update-pdf-worker.js` script:

1. Locates the worker file from `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
2. Copies it to `public/pdf.worker.min.js`
3. Ensures the versions match

## Verification

After running the script, you should see:

```
✅ PDF.js worker updated successfully!
   Source: node_modules/pdfjs-dist/build/pdf.worker.min.mjs
   Destination: public/pdf.worker.min.js
   Size: 1021.69 KB
```

## When to Update

Update the worker file whenever:

- You run `npm install`
- You update `pdfjs-dist` package
- You clone the repo for the first time
- You see a version mismatch error

## Prevention

The `postinstall` script should handle this automatically, but if you encounter issues:

1. Check that `update-pdf-worker.js` exists in your project root
2. Verify the `postinstall` script is in `package.json`
3. Make sure `pdfjs-dist` is installed in `node_modules`

## Deployment Note

For Vercel/Netlify deployments:

- The `postinstall` script runs automatically during build
- The worker file will be correctly updated before the build starts
- No manual intervention needed

## Troubleshooting

### Error: "Source worker file not found"

```bash
npm install pdfjs-dist
node update-pdf-worker.js
```

### Script doesn't run after npm install

Check that `package.json` includes:
```json
"postinstall": "node update-pdf-worker.js"
```

### Still seeing version mismatch

1. Delete `node_modules` and `package-lock.json`
2. Run `npm install`
3. Verify the worker file was updated:
   ```bash
   dir public\pdf.worker.min.js  # Windows
   ls -lh public/pdf.worker.min.js  # Mac/Linux
   ```

## Related Files

- `update-pdf-worker.js` - The update script
- `public/pdf.worker.min.js` - The worker file (gets updated)
- `package.json` - Contains the `postinstall` script
- `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` - Source worker file

## Version Conflict Resolution

### Issue: Multiple pdfjs-dist Versions

If you see version mismatch errors in either direction (API ≠ Worker), check for multiple versions:

```bash
npm ls pdfjs-dist
```

**Example of the problem**:
```
bidi@0.1.0
+-- pdfjs-dist@5.4.296          ← Direct dependency
`-- react-pdf@10.1.0
  `-- pdfjs-dist@5.3.93         ← react-pdf's dependency (conflict!)
```

### Solution: Pin to react-pdf's Version

Since `react-pdf` has a peer dependency on a specific `pdfjs-dist` version, we must match it:

1. Check react-pdf's required version:
   ```bash
   npm ls pdfjs-dist
   ```

2. Update `package.json` to match:
   ```json
   {
     "dependencies": {
       "pdfjs-dist": "5.3.93",  // Match react-pdf's version
       "react-pdf": "^10.1.0"
     }
   }
   ```

3. Reinstall:
   ```bash
   npm install
   ```

4. Verify deduplication:
   ```bash
   npm ls pdfjs-dist
   # Should show "deduped" for react-pdf's dependency
   ```

The `postinstall` script automatically updates the worker file to match.

## Version History

| Date | pdfjs-dist Version | Worker Version | Status | Notes |
|------|-------------------|----------------|--------|-------|
| Oct 12, 2025 (final) | 5.3.93 | 5.3.93 | ✅ Fixed | Pinned to react-pdf's version |
| Oct 12, 2025 (attempt 1) | 5.4.296 | 5.4.296 | ⚠️ Conflict | react-pdf used 5.3.93 |
| Before fix | 5.4.296 | 5.3.93 | ❌ Mismatch | Worker outdated |

---

**Status**: ✅ Fixed  
**Last Updated**: October 12, 2025

