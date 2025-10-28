import { createClient } from '@/lib/supabase'

export interface Drawing {
  id: string
  type: 'rectangle' | 'circle' | 'line' | 'comment' | 'pencil'
  geometry: {
    x: number
    y: number
    width?: number
    height?: number
    radius?: number
    points?: number[] // For lines: [x1, y1, x2, y2, ...]
  }
  style: {
    color: string
    strokeWidth: number
    opacity?: number
  }
  pageNumber: number
  // For comments
  label?: string
  notes?: string
  noteType?: 'requirement' | 'concern' | 'suggestion' | 'other'
  category?: string
  location?: string
  layerName?: string
  zIndex?: number
  isVisible?: boolean
  isLocked?: boolean
  // User tracking
  userId?: string
  userName?: string
  createdAt?: string
}

// Ensure default values for drawings
export const DEFAULT_DRAWING_VISIBILITY = true

export interface PlanDrawingRecord {
  id: string
  plan_id: string
  user_id: string
  page_number: number
  drawing_type?: string
  geometry?: any
  style?: any
  label?: string | null
  notes?: string | null
  layer_name?: string | null
  is_visible?: boolean | null
  is_locked?: boolean | null
  z_index?: number | null
  measurement_data?: any
  created_at: string
  updated_at: string
}

export class DrawingPersistence {
  private supabase = createClient()
  private planId: string
  private userId: string
  private saveTimeout: NodeJS.Timeout | null = null

  constructor(planId: string, userId: string) {
    if (!planId || !userId) {
      throw new Error('DrawingPersistence requires valid planId and userId')
    }
    this.planId = planId
    this.userId = userId
    console.log('DrawingPersistence initialized:', { planId, userId })
  }

  async loadDrawings(): Promise<Drawing[]> {
    try {
      const { data, error } = await this.supabase
        .from('plan_drawings')
        .select('*')
        .eq('plan_id', this.planId)
        .eq('user_id', this.userId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading drawings:', error)
        return []
      }

      if (!data || data.length === 0) {
        return []
      }

      return data.map(record => this.recordToDrawing(record))
    } catch (error) {
      console.error('Error loading drawings:', error)
      return []
    }
  }

  async saveDrawings(drawings: Drawing[]): Promise<void> {
    console.log('saveDrawings called with:', { 
      drawingsCount: drawings.length, 
      planId: this.planId, 
      userId: this.userId 
    })
    
    // Debounce saves to avoid too many database calls
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    return new Promise((resolve, reject) => {
      this.saveTimeout = setTimeout(async () => {
        try {
          console.log('Executing saveDrawings timeout callback')
          
          // Delete existing drawings for this plan/user
          const { error: deleteError } = await this.supabase
            .from('plan_drawings')
            .delete()
            .eq('plan_id', this.planId)
            .eq('user_id', this.userId)

          if (deleteError) {
            console.error('Error deleting old drawings:', deleteError)
          }

          // Insert new drawings
          if (drawings.length > 0) {
            const records = drawings.map(drawing => this.drawingToRecord(drawing))
            console.log('Inserting records:', records)
            
            const { error } = await this.supabase
              .from('plan_drawings')
              .insert(records)

            if (error) {
              console.error('Error saving drawings:', error)
              reject(error)
              return
            }
          }
          console.log('Drawings saved successfully')
          resolve()
        } catch (error) {
          console.error('Error saving drawings:', error)
          console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            drawingsCount: drawings.length,
            planId: this.planId,
            userId: this.userId
          })
          reject(error)
        }
      }, 1000) // 1 second debounce
    })
  }

  async saveDrawing(drawing: Drawing): Promise<void> {
    try {
      const record = {
        plan_id: this.planId,
        user_id: this.userId,
        drawing_data: drawing,
        page_number: drawing.pageNumber
      }

      const { error } = await this.supabase
        .from('plan_drawings')
        .insert(record)

      if (error) {
        console.error('Error saving drawing:', error)
      }
    } catch (error) {
      console.error('Error saving drawing:', error)
    }
  }

  async deleteDrawing(drawingId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('plan_drawings')
        .delete()
        .eq('plan_id', this.planId)
        .eq('user_id', this.userId)
        .eq('drawing_data->>id', drawingId)

      if (error) {
        console.error('Error deleting drawing:', error)
      }
    } catch (error) {
      console.error('Error deleting drawing:', error)
    }
  }

  private recordToDrawing(record: any): Drawing {
    // Map record fields to Drawing object
    console.log('Converting record to drawing:', record)
    
    // The actual database schema uses individual columns
    const drawing: Drawing = {
      id: record.id,
      type: (record.drawing_type || 'comment') as Drawing['type'],
      geometry: record.geometry || { x: 0, y: 0 },
      style: record.style || { color: '#3b82f6', strokeWidth: 2, opacity: 1 },
      pageNumber: record.page_number,
      label: record.label,
      notes: record.notes,
      layerName: record.layer_name,
      isVisible: record.is_visible ?? true,
      isLocked: record.is_locked ?? false,
      zIndex: record.z_index || 0,
      // Extract comment metadata from measurement_data JSONB field
      noteType: record.measurement_data?.noteType,
      category: record.measurement_data?.category,
      location: record.measurement_data?.location,
      userId: record.measurement_data?.userId,
      userName: record.measurement_data?.userName,
      createdAt: record.measurement_data?.createdAt
    }
    
    console.log('Converted drawing:', drawing)
    
    return drawing
  }

  private drawingToRecord(drawing: Drawing): any {
    // Map the Drawing to the database schema structure
    // The actual database schema uses individual columns, not drawing_data JSONB
    const record: any = {
      plan_id: this.planId,
      user_id: this.userId,
      page_number: drawing.pageNumber,
      drawing_type: drawing.type,
      geometry: drawing.geometry,
      style: drawing.style,
      label: drawing.label,
      notes: drawing.notes,
      layer_name: drawing.layerName,
      is_visible: drawing.isVisible,
      is_locked: drawing.isLocked,
      z_index: drawing.zIndex || 0,
      // Store comment-specific metadata in measurement_data JSONB field
      measurement_data: {
        noteType: drawing.noteType,
        category: drawing.category,
        location: drawing.location,
        userId: drawing.userId,
        userName: drawing.userName,
        createdAt: drawing.createdAt
      }
    }
    
    return record
  }

  cleanup() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
  }
}

// PDF rendering cache for different resolutions
interface PdfPageCache {
  [pageNumber: number]: {
    [scale: string]: HTMLCanvasElement | SVGElement
  }
}

// Global PDF cache
const pdfCache: { [pdfUrl: string]: { pdf: any; pageCache: PdfPageCache } } = {}

// SVG rendering mode - disabled by default for better performance
let useSvgRendering = false

// Utility functions for canvas operations
export const canvasUtils = {
  // Set rendering mode (SVG or Canvas)
  setRenderingMode(useSvg: boolean) {
    useSvgRendering = useSvg
  },

  // Convert PDF.js page to SVG element with caching
  async pageToSVG(page: any, scale: number = 2, pdfUrl: string, pageNumber: number): Promise<SVGElement> {
    // Check cache first
    if (pdfCache[pdfUrl]?.pageCache[pageNumber]?.[scale.toString()]) {
      const cached = pdfCache[pdfUrl].pageCache[pageNumber][scale.toString()]
      if (cached instanceof SVGElement) {
        return cached.cloneNode(true) as SVGElement
      }
    }

    const viewport = page.getViewport({ scale })
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', viewport.width.toString())
    svg.setAttribute('height', viewport.height.toString())
    svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    
    // Create SVG context for PDF.js
    const svgContext = {
      svgContext: svg,
      viewport: viewport,
      transform: [1, 0, 0, 1, 0, 0],
      viewportTransform: [1, 0, 0, 1, 0, 0]
    }
    
    try {
      await page.render(svgContext).promise
    } catch (error) {
      console.warn('SVG rendering failed, falling back to canvas:', error)
      // Fallback to canvas if SVG rendering fails
      const canvas = await this.pageToCanvas(page, scale, pdfUrl, pageNumber)
      const img = document.createElement('img')
      img.src = canvas.toDataURL()
      img.setAttribute('width', viewport.width.toString())
      img.setAttribute('height', viewport.height.toString())
      svg.appendChild(img)
    }
    
    // Cache the result
    if (!pdfCache[pdfUrl]) {
      pdfCache[pdfUrl] = { pdf: null, pageCache: {} }
    }
    if (!pdfCache[pdfUrl].pageCache[pageNumber]) {
      pdfCache[pdfUrl].pageCache[pageNumber] = {}
    }
    pdfCache[pdfUrl].pageCache[pageNumber][scale.toString()] = svg.cloneNode(true) as SVGElement
    
    return svg
  },

  // Convert PDF.js page to canvas image with caching
  async pageToCanvas(page: any, scale: number = 2, pdfUrl: string, pageNumber: number): Promise<HTMLCanvasElement> {
    // Check cache first
    if (pdfCache[pdfUrl]?.pageCache[pageNumber]?.[scale.toString()]) {
      const cached = pdfCache[pdfUrl].pageCache[pageNumber][scale.toString()]
      if (cached instanceof HTMLCanvasElement) {
        return cached
      }
    }

    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not get canvas context')
    
    // Enable image smoothing for better quality
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    
    await page.render({
      canvasContext: context,
      viewport
    }).promise
    
    // Cache the result
    if (!pdfCache[pdfUrl]) {
      pdfCache[pdfUrl] = { pdf: null, pageCache: {} }
    }
    if (!pdfCache[pdfUrl].pageCache[pageNumber]) {
      pdfCache[pdfUrl].pageCache[pageNumber] = {}
    }
    pdfCache[pdfUrl].pageCache[pageNumber][scale.toString()] = canvas
    
    return canvas
  },

  // Load PDF and convert all pages to canvas images (optimized for performance)
  async loadPdfImages(pdfUrl: string, baseScale: number = 2): Promise<HTMLCanvasElement[]> {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    
    // Check if PDF is already loaded
    let pdf
    if (pdfCache[pdfUrl]?.pdf) {
      pdf = pdfCache[pdfUrl].pdf
    } else {
      pdf = await pdfjs.getDocument(pdfUrl).promise
      if (!pdfCache[pdfUrl]) {
        pdfCache[pdfUrl] = { pdf, pageCache: {} }
      } else {
        pdfCache[pdfUrl].pdf = pdf
      }
    }
    
    const images: HTMLCanvasElement[] = []
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const canvas = await this.pageToCanvas(page, baseScale, pdfUrl, i)
      images.push(canvas)
    }
    
    return images
  },

  // Load PDF and convert all pages to SVG elements (legacy support)
  async loadPdfImagesSVG(pdfUrl: string, baseScale: number = 2): Promise<(HTMLCanvasElement | SVGElement)[]> {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    
    // Check if PDF is already loaded
    let pdf
    if (pdfCache[pdfUrl]?.pdf) {
      pdf = pdfCache[pdfUrl].pdf
    } else {
      pdf = await pdfjs.getDocument(pdfUrl).promise
      if (!pdfCache[pdfUrl]) {
        pdfCache[pdfUrl] = { pdf, pageCache: {} }
      } else {
        pdfCache[pdfUrl].pdf = pdf
      }
    }
    
    const images: (HTMLCanvasElement | SVGElement)[] = []
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      
      if (useSvgRendering) {
        const svg = await this.pageToSVG(page, baseScale, pdfUrl, i)
        images.push(svg)
      } else {
        const canvas = await this.pageToCanvas(page, baseScale, pdfUrl, i)
        images.push(canvas)
      }
    }
    
    return images
  },

  // Get high-resolution page for zoomed view (Canvas only - optimized)
  async getHighResPage(pdfUrl: string, pageNumber: number, zoomLevel: number): Promise<HTMLCanvasElement> {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    
    // Calculate appropriate scale based on zoom level
    // Base scale is 2, so for zoom levels > 1, we need higher resolution
    const baseScale = 2
    const targetScale = Math.max(baseScale, baseScale * zoomLevel)
    
    // Check cache first
    if (pdfCache[pdfUrl]?.pageCache[pageNumber]?.[targetScale.toString()]) {
      const cached = pdfCache[pdfUrl].pageCache[pageNumber][targetScale.toString()]
      if (cached instanceof HTMLCanvasElement) {
        return cached
      }
    }
    
    // Load PDF if not cached
    let pdf
    if (pdfCache[pdfUrl]?.pdf) {
      pdf = pdfCache[pdfUrl].pdf
    } else {
      pdf = await pdfjs.getDocument(pdfUrl).promise
      if (!pdfCache[pdfUrl]) {
        pdfCache[pdfUrl] = { pdf, pageCache: {} }
      } else {
        pdfCache[pdfUrl].pdf = pdf
      }
    }
    
    const page = await pdf.getPage(pageNumber)
    return await this.pageToCanvas(page, targetScale, pdfUrl, pageNumber)
  },

  // Get high-resolution page for zoomed view (Legacy SVG/Canvas support)
  async getHighResPageLegacy(pdfUrl: string, pageNumber: number, zoomLevel: number): Promise<HTMLCanvasElement | SVGElement> {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    
    // Calculate appropriate scale based on zoom level
    // Base scale is 2, so for zoom levels > 1, we need higher resolution
    const baseScale = 2
    const targetScale = Math.max(baseScale, baseScale * zoomLevel)
    
    // Check cache first
    if (pdfCache[pdfUrl]?.pageCache[pageNumber]?.[targetScale.toString()]) {
      const cached = pdfCache[pdfUrl].pageCache[pageNumber][targetScale.toString()]
      if (cached instanceof SVGElement) {
        return cached.cloneNode(true) as SVGElement
      }
      return cached as HTMLCanvasElement
    }
    
    // Load PDF if not cached
    let pdf
    if (pdfCache[pdfUrl]?.pdf) {
      pdf = pdfCache[pdfUrl].pdf
    } else {
      pdf = await pdfjs.getDocument(pdfUrl).promise
      if (!pdfCache[pdfUrl]) {
        pdfCache[pdfUrl] = { pdf, pageCache: {} }
      } else {
        pdfCache[pdfUrl].pdf = pdf
      }
    }
    
    const page = await pdf.getPage(pageNumber)
    
    if (useSvgRendering) {
      return await this.pageToSVG(page, targetScale, pdfUrl, pageNumber)
    } else {
      return await this.pageToCanvas(page, targetScale, pdfUrl, pageNumber)
    }
  },

  // Clear PDF cache (useful for memory management)
  clearPdfCache(pdfUrl?: string): void {
    if (pdfUrl) {
      delete pdfCache[pdfUrl]
    } else {
      Object.keys(pdfCache).forEach(key => delete pdfCache[key])
    }
  },

  // Get cached PDF document
  getCachedPdf(pdfUrl: string): any {
    return pdfCache[pdfUrl]?.pdf
  },

  // Calculate page number from Y coordinate
  getPageNumber(y: number, pageOffsets: number[]): number {
    for (let i = 0; i < pageOffsets.length; i++) {
      const nextOffset = i < pageOffsets.length - 1 ? pageOffsets[i + 1] : Infinity
      if (y >= pageOffsets[i] && y < nextOffset) {
        return i + 1
      }
    }
    return 1
  },

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX: number, screenY: number, viewport: { zoom: number; panX: number; panY: number }) {
    return {
      x: (screenX - viewport.panX) / viewport.zoom,
      y: (screenY - viewport.panY) / viewport.zoom
    }
  },

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX: number, worldY: number, viewport: { zoom: number; panX: number; panY: number }) {
    return {
      x: worldX * viewport.zoom + viewport.panX,
      y: worldY * viewport.zoom + viewport.panY
    }
  }
}
