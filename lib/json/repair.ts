/**
 * Bulletproof JSON Repair & Extraction
 * 
 * Handles malformed JSON from LLMs by:
 * - Stripping code fences
 * - Removing leading/trailing prose
 * - Fixing trailing commas
 * - Rebalancing brackets/braces
 * - Extracting items and quality_analysis even from broken JSON
 */

export interface ExtractedPayload {
  items: any[]
  quality_analysis: any
  repaired: boolean
  notes?: string
}

/**
 * Strip markdown code fences
 */
function stripCodeFences(text: string): string {
  // Remove ```json or ``` wrappers
  text = text.replace(/^```(?:json)?\s*/i, '')
  text = text.replace(/\s*```$/i, '')
  return text.trim()
}

/**
 * Remove leading/trailing prose before/after JSON
 */
function removeProse(text: string): string {
  // Find first { and last }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return text
  }
  
  return text.substring(firstBrace, lastBrace + 1)
}

/**
 * Fix trailing commas
 */
function fixTrailingCommas(text: string): string {
  // Remove trailing commas before } or ]
  text = text.replace(/,(\s*[}\]])/g, '$1')
  return text
}

/**
 * Fix missing commas between objects in arrays
 */
function fixMissingCommas(text: string): string {
  // Fix }"{" pattern (missing comma between objects)
  text = text.replace(/}\s*"\{/g, '},{"')
  // Fix }"{ (missing comma, object without quotes)
  text = text.replace(/}\s*\{/g, '},{')
  // Fix ]"[" pattern
  text = text.replace(/\]\s*"\[/g, '"],"[')
  // Fix ]"[ pattern
  text = text.replace(/\]\s*\[/g, '],[')
  return text
}

/**
 * Rebalance brackets and braces (basic)
 */
function rebalanceBrackets(text: string): string {
  let openBraces = 0
  let openBrackets = 0
  let fixed = ''
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    
    if (char === '{') {
      openBraces++
      fixed += char
    } else if (char === '}') {
      if (openBraces > 0) {
        openBraces--
        fixed += char
      }
      // Skip extra closing braces
    } else if (char === '[') {
      openBrackets++
      fixed += char
    } else if (char === ']') {
      if (openBrackets > 0) {
        openBrackets--
        fixed += char
      }
      // Skip extra closing brackets
    } else {
      fixed += char
    }
  }
  
  // Close any remaining open brackets/braces
  while (openBrackets > 0) {
    fixed += ']'
    openBrackets--
  }
  while (openBraces > 0) {
    fixed += '}'
    openBraces--
  }
  
  return fixed
}

/**
 * Convert single quotes to double quotes (carefully)
 */
function fixQuotes(text: string): string {
  // Only fix quotes around keys and string values, not inside strings
  // This is tricky - we'll do a simple pass for common cases
  text = text.replace(/'(\w+)':/g, '"$1":') // Key names
  text = text.replace(/: '([^']*)'/g, (match, content) => {
    // Don't fix if it contains escaped quotes or special chars that suggest it's meant to be single-quoted
    if (content.includes('"') || content.includes('\\')) {
      return match
    }
    return `: "${content}"`
  })
  return text
}

/**
 * Remove BOM and other unicode issues
 */
function cleanUnicode(text: string): string {
  // Remove BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1)
  }
  // Remove other problematic characters
  text = text.replace(/\u200B/g, '') // Zero-width space
  text = text.replace(/\uFEFF/g, '') // BOM
  return text
}

/**
 * Extract items array from broken JSON
 */
function extractItemsArray(text: string): any[] {
  const items: any[] = []
  
  // Find "items" key
  const itemsMatch = text.match(/"items"\s*:\s*\[/)
  if (!itemsMatch) {
    return []
  }
  
  let startIdx = itemsMatch.index! + itemsMatch[0].length
  let depth = 1 // We're inside the array
  let braceDepth = 0
  let objStart = startIdx
  let inString = false
  let escapeNext = false
  
  for (let i = startIdx; i < text.length && depth > 0; i++) {
    const char = text[i]
    
    if (escapeNext) {
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      continue
    }
    
    if (char === '"') {
      inString = !inString
      continue
    }
    
    if (inString) continue
    
    if (char === '{') {
      if (braceDepth === 0) {
        objStart = i
      }
      braceDepth++
    } else if (char === '}') {
      braceDepth--
      if (braceDepth === 0) {
        // End of object - try to parse it
        try {
          const objText = text.substring(objStart, i + 1)
          const obj = JSON.parse(objText)
          items.push(obj)
        } catch (e) {
          // Try to repair this single object
          try {
            let objText = text.substring(objStart, i + 1)
            objText = fixTrailingCommas(objText)
            objText = fixQuotes(objText)
            const obj = JSON.parse(objText)
            items.push(obj)
          } catch (e2) {
            // Skip this broken object
            console.warn('Could not parse item object:', text.substring(objStart, Math.min(i + 50, text.length)))
          }
        }
      }
    } else if (char === '[') {
      depth++
    } else if (char === ']') {
      depth--
    }
  }
  
  return items
}

/**
 * Extract quality_analysis object from broken JSON
 */
function extractQualityAnalysis(text: string): any {
  // First, try to find a complete quality_analysis object
  const qaMatch = text.match(/"quality_analysis"\s*:\s*\{/)
  if (!qaMatch) {
    // Look for individual keys and assemble
    const completeness = extractNestedObject(text, 'completeness')
    const consistency = extractNestedObject(text, 'consistency')
    const riskFlags = extractArray(text, 'risk_flags')
    const auditTrail = extractNestedObject(text, 'audit_trail')
    
    if (completeness || consistency || riskFlags || auditTrail) {
      return {
        completeness: completeness || { missing_disciplines: [], missing_sheets: [], notes: '' },
        consistency: consistency || { conflicts: [], unit_mismatches: [], scale_issues: [] },
        risk_flags: riskFlags || [],
        audit_trail: auditTrail || { chunks_covered: '', pages_covered: '', method: '' }
      }
    }
    
    // Fallback minimal structure
    return {
      completeness: { missing_disciplines: [], missing_sheets: [], notes: 'Quality analysis structure not found in response' },
      consistency: { conflicts: [], unit_mismatches: [], scale_issues: [] },
      risk_flags: [],
      audit_trail: { chunks_covered: '', pages_covered: '', method: 'JSON structure not parseable' }
    }
  }
  
  // Extract from complete object
  let startIdx = qaMatch.index! + qaMatch[0].length - 1 // Start at the {
  let braceDepth = 0
  let objStart = startIdx
  
  for (let i = startIdx; i < text.length; i++) {
    const char = text[i]
    
    if (char === '{') {
      if (braceDepth === 0) {
        objStart = i
      }
      braceDepth++
    } else if (char === '}') {
      braceDepth--
      if (braceDepth === 0) {
        try {
          const objText = text.substring(objStart, i + 1)
          return JSON.parse(objText)
        } catch (e) {
          // Try repaired version
          let objText = text.substring(objStart, i + 1)
          objText = fixTrailingCommas(objText)
          objText = fixQuotes(objText)
          try {
            return JSON.parse(objText)
          } catch (e2) {
            // Fall back to minimal
            return {
              completeness: { missing_disciplines: [], missing_sheets: [], notes: 'Could not parse quality_analysis' },
              consistency: { conflicts: [], unit_mismatches: [], scale_issues: [] },
              risk_flags: [],
              audit_trail: { chunks_covered: '', pages_covered: '', method: 'Parse failed' }
            }
          }
        }
      }
    }
  }
  
  // If we get here, return minimal structure
  return {
    completeness: { missing_disciplines: [], missing_sheets: [], notes: 'Incomplete quality_analysis object' },
    consistency: { conflicts: [], unit_mismatches: [], scale_issues: [] },
    risk_flags: [],
    audit_trail: { chunks_covered: '', pages_covered: '', method: 'Extraction incomplete' }
  }
}

/**
 * Extract a nested object by key name
 */
function extractNestedObject(text: string, key: string): any {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*\\{`))
  if (!match) return null
  
  let startIdx = match.index! + match[0].length - 1
  let braceDepth = 0
  
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '{') braceDepth++
    if (text[i] === '}') {
      braceDepth--
      if (braceDepth === 0) {
        try {
          return JSON.parse(text.substring(startIdx, i + 1))
        } catch (e) {
          return null
        }
      }
    }
  }
  
  return null
}

/**
 * Extract an array by key name
 */
function extractArray(text: string, key: string): any[] {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*\\[`))
  if (!match) return []
  
  let startIdx = match.index! + match[0].length
  let depth = 1
  let braceDepth = 0
  let objStart = startIdx
  const items: any[] = []
  let inString = false
  let escapeNext = false
  
  for (let i = startIdx; i < text.length && depth > 0; i++) {
    const char = text[i]
    
    if (escapeNext) {
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      continue
    }
    
    if (char === '"') {
      inString = !inString
      continue
    }
    
    if (inString) continue
    
    if (char === '{') {
      if (braceDepth === 0) objStart = i
      braceDepth++
    } else if (char === '}') {
      braceDepth--
      if (braceDepth === 0) {
        try {
          items.push(JSON.parse(text.substring(objStart, i + 1)))
        } catch (e) {
          // Skip broken item
        }
      }
    } else if (char === '[') {
      depth++
    } else if (char === ']') {
      depth--
    }
  }
  
  return items
}

/**
 * Main extraction function
 */
export function extractAnalysisPayload(raw: string): ExtractedPayload {
  let repaired = false
  const notes: string[] = []
  
  // Step 1: Clean up
  let cleaned = raw.trim()
  cleaned = cleanUnicode(cleaned)
  cleaned = stripCodeFences(cleaned)
  
  // Step 2: Try direct parse
  try {
    const parsed = JSON.parse(cleaned)
    if (parsed.items && Array.isArray(parsed.items)) {
      return {
        items: parsed.items,
        quality_analysis: parsed.quality_analysis || createFallbackQA(),
        repaired: false
      }
    }
  } catch (e) {
    notes.push('Direct JSON parse failed')
    repaired = true
  }
  
  // Step 3: Remove prose and try again
  cleaned = removeProse(cleaned)
  try {
    const parsed = JSON.parse(cleaned)
    if (parsed.items && Array.isArray(parsed.items)) {
      notes.push('Required prose removal')
      return {
        items: parsed.items,
        quality_analysis: parsed.quality_analysis || createFallbackQA(),
        repaired: true
      }
    }
  } catch (e) {
    notes.push('Parse after prose removal failed')
  }
  
  // Step 4: Apply repairs
  cleaned = fixTrailingCommas(cleaned)
  cleaned = fixMissingCommas(cleaned)
  cleaned = fixQuotes(cleaned)
  cleaned = rebalanceBrackets(cleaned)
  
  try {
    const parsed = JSON.parse(cleaned)
    if (parsed.items && Array.isArray(parsed.items)) {
      notes.push('Applied JSON repairs')
      return {
        items: parsed.items,
        quality_analysis: parsed.quality_analysis || createFallbackQA(),
        repaired: true,
        notes: notes.join('; ')
      }
    }
  } catch (e) {
    notes.push('Parse after repairs failed')
  }
  
  // Step 5: Extract items and QA separately
  const items = extractItemsArray(cleaned)
  const quality_analysis = extractQualityAnalysis(cleaned)
  
  if (items.length > 0 || quality_analysis) {
    notes.push('Used partial extraction')
    return {
      items,
      quality_analysis,
      repaired: true,
      notes: notes.join('; ')
    }
  }
  
  // Step 6: Last resort - return empty but valid structure
  notes.push('All extraction methods failed - returning empty structure')
  return {
    items: [],
    quality_analysis: createFallbackQA(),
    repaired: true,
    notes: notes.join('; ')
  }
}

/**
 * Create fallback quality analysis structure
 */
function createFallbackQA(): any {
  return {
    completeness: {
      missing_disciplines: [],
      missing_sheets: [],
      notes: 'Quality analysis not extractable from response'
    },
    consistency: {
      conflicts: [],
      unit_mismatches: [],
      scale_issues: []
    },
    risk_flags: [],
    audit_trail: {
      chunks_covered: '',
      pages_covered: '',
      method: 'Response parsing failed - minimal structure returned'
    }
  }
}

