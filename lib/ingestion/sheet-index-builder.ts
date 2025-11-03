/**
 * Sheet Index Builder
 * Analyzes page text to extract sheet metadata: IDs, types, disciplines, scales
 */

import type { SheetIndex, PageText } from '@/types/ingestion'
import { SheetDiscipline, SheetType } from '@/types/ingestion'

/**
 * Build sheet index from page texts
 */
export async function buildSheetIndex(
  pageTexts: PageText[],
  pdfBuffer: Buffer // Keep for future use (rotation detection)
): Promise<SheetIndex[]> {
  const sheetIndex: SheetIndex[] = []

  for (const pageText of pageTexts) {
    const sheet = await analyzeSheet(pageText, pageTexts.length)
    sheetIndex.push(sheet)
  }

  return sheetIndex
}

/**
 * Analyze a single sheet/page to extract metadata
 */
async function analyzeSheet(
  pageText: PageText,
  totalPages: number
): Promise<SheetIndex> {
  const text = pageText.text.toUpperCase()
  
  // Extract sheet ID (common patterns: A-1, S-2, E-3, etc.)
  const sheetIdMatch = text.match(/([A-Z]+)\s*[-\.]?\s*(\d+)/)
  const sheetId = sheetIdMatch 
    ? `${sheetIdMatch[1]}-${sheetIdMatch[2]}`
    : `PAGE-${pageText.pageNumber}`

  // Detect sheet type
  const sheetType = detectSheetType(text, pageText.pageNumber, totalPages)

  // Detect discipline
  const discipline = detectDiscipline(text, sheetId)

  // Extract scale (common patterns: 1/8" = 1'-0", 1:100, etc.)
  const scaleMatch = text.match(/(\d+\/\d+"?\s*=\s*\d+'?\s*-?\s*\d+")|(1:\d+)|(SCALE[\s:]+[\d/"]+)/i)
  const scale = scaleMatch ? scaleMatch[0] : null
  const scaleRatio = scale ? parseScaleRatio(scale) : null

  // Detect units (imperial vs metric)
  const units = detectUnits(text, scale)

  // Extract title (typically in title block)
  const titleMatch = text.match(/(FLOOR PLAN|ELEVATION|SECTION|DETAIL|SCHEDULE|TITLE|FOUNDATION|SITE PLAN)[\s\w]*/i)
  const title = titleMatch ? titleMatch[0] : `Sheet ${pageText.pageNumber}`

  // Extract keywords
  const keywords = extractKeywords(text)

  return {
    sheet_id: sheetId,
    title,
    discipline,
    scale,
    scale_ratio: scaleRatio,
    units,
    page_no: pageText.pageNumber,
    sheet_type: sheetType,
    rotation: 0, // TODO: Detect rotation from PDF metadata if needed
    has_text_layer: pageText.text.length > 0,
    has_image: true, // Assumed if we're processing
    text_length: pageText.text.length,
    detected_keywords: keywords
  }
}

/**
 * Detect sheet type from text content
 */
function detectSheetType(text: string, pageNum: number, totalPages: number): SheetType {
  const upper = text.toUpperCase()

  if (pageNum === 1 || upper.includes('TITLE') || upper.includes('COVER') || upper.includes('INDEX')) {
    return SheetType.TITLE
  }
  if (upper.includes('FLOOR PLAN') || upper.includes('FLOORPLAN') || upper.includes('FLOOR PLAN')) {
    return SheetType.FLOOR_PLAN
  }
  if (upper.includes('ELEVATION') || upper.includes('ELEV')) {
    return SheetType.ELEVATION
  }
  if (upper.includes('SECTION')) {
    return SheetType.SECTION
  }
  if (upper.includes('DETAIL') || upper.includes('DET') || upper.includes('DTL')) {
    return SheetType.DETAIL
  }
  if (upper.includes('SCHEDULE') || upper.includes('SCH')) {
    return SheetType.SCHEDULE
  }
  if (upper.includes('LEGEND')) {
    return SheetType.LEGEND
  }
  if (upper.includes('SITE PLAN') || upper.includes('SITE')) {
    return SheetType.SITE_PLAN
  }
  if (upper.includes('ROOF PLAN') || upper.includes('ROOF')) {
    return SheetType.ROOF_PLAN
  }

  return SheetType.OTHER
}

/**
 * Detect discipline from text and sheet ID
 */
function detectDiscipline(text: string, sheetId: string): SheetDiscipline {
  const upper = text.toUpperCase()
  const idUpper = sheetId.toUpperCase()

  if (idUpper.startsWith('A-') || upper.includes('ARCHITECTURAL') || upper.includes('ARCH')) {
    return SheetDiscipline.ARCHITECTURAL
  }
  if (idUpper.startsWith('S-') || upper.includes('STRUCTURAL') || upper.includes('STRUCT')) {
    return SheetDiscipline.STRUCTURAL
  }
  if (idUpper.startsWith('E-') || upper.includes('ELECTRICAL') || upper.includes('ELECT')) {
    return SheetDiscipline.ELECTRICAL
  }
  if (idUpper.startsWith('P-') || upper.includes('PLUMBING') || upper.includes('PLUMB')) {
    return SheetDiscipline.PLUMBING
  }
  if (idUpper.startsWith('M-') || upper.includes('MECHANICAL') || upper.includes('HVAC') || upper.includes('HEATING')) {
    return SheetDiscipline.HVAC
  }
  if (idUpper.startsWith('C-') || upper.includes('CIVIL')) {
    return SheetDiscipline.CIVIL
  }
  if (upper.includes('LANDSCAPE') || idUpper.startsWith('L-')) {
    return SheetDiscipline.LANDSCAPE
  }
  if (upper.includes('MEP') || (upper.includes('MECHANICAL') && upper.includes('ELECTRICAL') && upper.includes('PLUMBING'))) {
    return SheetDiscipline.MEP
  }

  return SheetDiscipline.UNKNOWN
}

/**
 * Parse scale string to numeric ratio
 */
function parseScaleRatio(scaleStr: string): number | null {
  // Parse "1/8" = 1'-0"" to 96 (1 inch = 8 feet = 96 inches)
  const imperialMatch = scaleStr.match(/(\d+)\/(\d+)"?\s*=\s*(\d+)'/)
  if (imperialMatch) {
    const num = parseInt(imperialMatch[1])
    const den = parseInt(imperialMatch[2])
    const feet = parseInt(imperialMatch[3])
    return (feet * 12) / (num / den)
  }

  // Parse "1:100" format
  const metricMatch = scaleStr.match(/1:(\d+)/)
  if (metricMatch) {
    return parseInt(metricMatch[1])
  }

  return null
}

/**
 * Detect units (imperial vs metric)
 */
function detectUnits(text: string, scale: string | null): 'imperial' | 'metric' | null {
  const upper = text.toUpperCase()
  
  if (upper.includes("'") || upper.includes('"') || upper.includes('FEET') || upper.includes('INCHES') || scale?.includes('=')) {
    return 'imperial'
  }
  if (upper.includes('MM') || upper.includes('CM') || upper.includes(' METER') || scale?.includes(':')) {
    return 'metric'
  }

  return null
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = []
  const upper = text.toUpperCase()

  const keywordPatterns = [
    'FOUNDATION', 'WALLS', 'ROOF', 'FLOOR', 'CEILING',
    'DOOR', 'WINDOW', 'DOORS', 'WINDOWS',
    'ELECTRICAL', 'PLUMBING', 'HVAC', 'MEP',
    'SCHEDULE', 'LEGEND', 'NOTES', 'SPECIFICATIONS',
    'BEAM', 'COLUMN', 'FOOTING', 'SLAB'
  ]

  keywordPatterns.forEach(pattern => {
    if (upper.includes(pattern)) {
      keywords.push(pattern)
    }
  })

  return Array.from(new Set(keywords)) // Remove duplicates
}

