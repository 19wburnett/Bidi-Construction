/**
 * Update PDF.js Worker File
 * 
 * This script copies the correct PDF.js worker from node_modules to public/
 * Run this whenever you update the pdfjs-dist package to ensure version compatibility.
 * 
 * Usage: node update-pdf-worker.js
 */

const fs = require('fs')
const path = require('path')

const source = path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const dest = path.join(__dirname, 'public', 'pdf.worker.min.js')

try {
  // Check if source exists
  if (!fs.existsSync(source)) {
    console.error('❌ Error: Source worker file not found at:', source)
    console.error('Make sure pdfjs-dist is installed: npm install pdfjs-dist')
    process.exit(1)
  }

  // Copy the file
  fs.copyFileSync(source, dest)
  
  const stats = fs.statSync(dest)
  console.log('✅ PDF.js worker updated successfully!')
  console.log(`   Source: ${source}`)
  console.log(`   Destination: ${dest}`)
  console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`)
  console.log('')
  console.log('The worker file now matches your installed pdfjs-dist version.')
  
} catch (error) {
  console.error('❌ Error updating worker file:', error.message)
  process.exit(1)
}


