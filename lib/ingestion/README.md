# Ingestion System Implementation

This directory contains the core ingestion and chunking implementation.

## Files

- `pdf-text-extractor.ts` - Extracts text per page using pdf2json
- `pdf-image-extractor.ts` - Renders pages as PNG images using pdfjs-dist + canvas
- `sheet-index-builder.ts` - Analyzes text to extract sheet metadata
- `chunking-engine.ts` - Generates chunks with overlap and safeguards

## Dependencies

Note: `canvas` requires native bindings. If you encounter build issues:

1. **macOS**: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
2. **Linux**: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
3. **Windows**: Use `canvas` prebuilt binaries or consider alternatives

For serverless environments (Vercel, etc.), you may need to use a different approach or deploy to a Docker container with canvas dependencies.

## Usage

See `lib/ingestion-engine.ts` for the main orchestration function.

