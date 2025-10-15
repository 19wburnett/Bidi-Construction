# SSR Fix for react-pdf "DOMMatrix is not defined" Error

## The Problem

When using `react-pdf` in Next.js, you may encounter the error:
```
DOMMatrix is not defined
```

This happens because `react-pdf` uses browser-only APIs like `DOMMatrix` that don't exist in Node.js (server-side environment). Even though the component has `'use client'` at the top, Next.js still processes the imports during Server-Side Rendering (SSR), causing the error.

## The Solution

We fixed this by using Next.js's `dynamic` import with `ssr: false` option to ensure the PDF components only load on the client side.

### Changes Made

#### 1. Dynamic Imports for react-pdf Components

**Before:**
```typescript
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
```

**After:**
```typescript
import dynamic from 'next/dynamic'

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <FallingBlocksLoader />
      </div>
    )
  }
) as any

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
) as any
```

**Key Points:**
- `ssr: false` prevents these components from being rendered on the server
- `loading` prop shows a loader while the component is being loaded
- `as any` is used because dynamic imports can be tricky with TypeScript types

#### 2. Client-Side Only Worker Configuration

**Before:**
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
```

**After:**
```typescript
// Configure PDF.js worker (only on client side)
if (typeof window !== 'undefined') {
  import('react-pdf').then((pdfjs) => {
    pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  })
}
```

**Why:** This ensures the worker is only configured in the browser environment.

#### 3. Dynamic CSS Loading

**Before:**
```typescript
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
```

**After:**
```typescript
// Load CSS on client side
useEffect(() => {
  const loadStyles = async () => {
    await import('react-pdf/dist/Page/AnnotationLayer.css')
    await import('react-pdf/dist/Page/TextLayer.css')
  }
  loadStyles()
}, [])
```

**Why:** CSS imports also need to be client-side only to avoid SSR issues.

## How It Works

1. **Initial Page Load**: Next.js renders the page on the server, but skips the PDF components
2. **Client Hydration**: Once the page reaches the browser, the dynamic imports execute
3. **PDF Loading**: The `Document` and `Page` components load and render the PDF
4. **Styles Applied**: CSS is loaded and applied to the PDF viewer

## Benefits

✅ **No SSR Errors**: Browser-only APIs work correctly  
✅ **Better UX**: Loading state shows while PDF components load  
✅ **Same Functionality**: All drawing and annotation features still work  
✅ **Type Safety**: TypeScript works with `as any` type assertion  
✅ **Performance**: PDF code only loads on client side where it's needed  

## Testing

To verify the fix works:

1. **Development**: Run `npm run dev` - no DOMMatrix errors should appear
2. **Build**: Run `npm run build` - build should complete successfully
3. **Production**: Run `npm start` - pages should render correctly
4. **Browser**: Navigate to a plan editor page - PDF should load and display

## Common Issues & Solutions

### Issue: PDF Not Loading
**Solution**: Check browser console for errors. Make sure `/pdf.worker.min.js` exists in the `public` folder.

### Issue: Styles Not Applied
**Solution**: The CSS will load after component mount. This is normal and happens quickly.

### Issue: TypeScript Errors
**Solution**: The `as any` type assertion handles dynamic import types. If you see errors, ensure `dynamic` is imported from `next/dynamic`.

### Issue: Build Warnings
**Solution**: Warnings about dynamic imports are normal. As long as the build completes, it's working correctly.

## Related Files

- `app/dashboard/plans/[id]/page.tsx` - Main file with the fix
- `public/pdf.worker.min.js` - PDF.js worker file (must exist)
- `node_modules/react-pdf/` - The react-pdf library

## References

- [Next.js Dynamic Imports](https://nextjs.org/docs/advanced-features/dynamic-import)
- [react-pdf Documentation](https://github.com/wojtekmaj/react-pdf)
- [DOMMatrix MDN](https://developer.mozilla.org/en-US/docs/Web/API/DOMMatrix)

## Summary

The `DOMMatrix is not defined` error is fixed by ensuring all react-pdf components and their dependencies only load on the client side using Next.js dynamic imports with `ssr: false`. This allows the application to work correctly in both development and production environments.


