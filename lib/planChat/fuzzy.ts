/**
 * Fuzzy matching utilities for matching takeoff items to question targets.
 */

/**
 * Normalizes a string for comparison (lowercase, strip special chars, handle plurals)
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Strips plural endings for better matching (simple heuristic)
 */
export function stripPlural(str: string): string {
  if (str.length <= 3) return str
  if (str.endsWith('ies')) return str.slice(0, -3) + 'y'
  if (str.endsWith('es') && str.length > 4) return str.slice(0, -2)
  if (str.endsWith('s') && str.length > 3) return str.slice(0, -1)
  return str
}

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Calculates similarity score between two strings (0-1, where 1 is identical)
 */
export function similarityScore(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1
  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLen
}

// Common construction term synonyms
const TERM_SYNONYMS: Record<string, string[]> = {
  'roof': ['roof', 'roofing', 'shingle', 'shingles', 'asphalt', 'tile', 'membrane', 'covering'],
  'window': ['window', 'windows', 'glazing', 'fenestration'],
  'door': ['door', 'doors', 'entry', 'entries'],
  'wall': ['wall', 'walls', 'partition', 'partitions'],
  'floor': ['floor', 'flooring', 'slab', 'concrete floor'],
  'foundation': ['foundation', 'footing', 'footings', 'concrete foundation'],
}

/**
 * Expands targets with synonyms
 */
function expandTargets(targets: string[]): string[] {
  const expanded = new Set<string>()
  for (const target of targets) {
    expanded.add(target.toLowerCase())
    // Check for synonyms
    for (const [key, synonyms] of Object.entries(TERM_SYNONYMS)) {
      if (target.toLowerCase().includes(key) || synonyms.some(s => target.toLowerCase().includes(s))) {
        synonyms.forEach(s => expanded.add(s))
        expanded.add(key)
      }
    }
  }
  return Array.from(expanded)
}

/**
 * Checks if a string includes any of the target keywords (with fuzzy matching)
 */
export function matchesTargets(
  text: string | null | undefined,
  targets: string[],
  threshold = 0.7
): boolean {
  if (!text || targets.length === 0) return false

  const expandedTargets = expandTargets(targets)
  const normalizedText = normalizeString(text)
  const textWords = normalizedText.split(/\s+/).filter((w) => w.length > 2)

  for (const target of expandedTargets) {
    const normalizedTarget = normalizeString(target)
    const targetWords = normalizedTarget.split(/\s+/).filter((w) => w.length > 2)

    // Exact substring match
    if (normalizedText.includes(normalizedTarget)) {
      return true
    }

    // Check if any target word is in the text
    for (const targetWord of targetWords) {
      const strippedTarget = stripPlural(targetWord)
      for (const textWord of textWords) {
        const strippedText = stripPlural(textWord)
        if (strippedText.includes(strippedTarget) || strippedTarget.includes(strippedText)) {
          return true
        }
        // Fuzzy match with similarity threshold
        if (similarityScore(strippedText, strippedTarget) >= threshold) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Scores how well an item matches the targets (0-1)
 */
export function scoreMatch(
  itemText: string | null | undefined,
  targets: string[],
  threshold = 0.6
): number {
  if (!itemText || targets.length === 0) return 0

  const expandedTargets = expandTargets(targets)
  const normalizedText = normalizeString(itemText)
  const textWords = normalizedText.split(/\s+/).filter((w) => w.length > 2)
  let maxScore = 0

  for (const target of expandedTargets) {
    const normalizedTarget = normalizeString(target)
    const targetWords = normalizedTarget.split(/\s+/).filter((w) => w.length > 2)

    // Exact substring match gets highest score
    if (normalizedText.includes(normalizedTarget)) {
      maxScore = Math.max(maxScore, 1.0)
      continue
    }

    // Check word-by-word matches
    for (const targetWord of targetWords) {
      const strippedTarget = stripPlural(targetWord)
      for (const textWord of textWords) {
        const strippedText = stripPlural(textWord)
        if (strippedText === strippedTarget) {
          maxScore = Math.max(maxScore, 1.0)
        } else if (strippedText.includes(strippedTarget) || strippedTarget.includes(strippedText)) {
          maxScore = Math.max(maxScore, 0.8)
        } else {
          const sim = similarityScore(strippedText, strippedTarget)
          if (sim >= threshold) {
            maxScore = Math.max(maxScore, sim)
          }
        }
      }
    }
  }

  return maxScore
}

