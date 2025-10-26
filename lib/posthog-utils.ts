import posthog from 'posthog-js'

// Rate limiting for PostHog events
const eventRateLimiter = new Map<string, number>()
const RATE_LIMIT_WINDOW = 1000 // 1 second
const MAX_EVENTS_PER_WINDOW = 5 // Max 5 events per second per event type

/**
 * Safely capture PostHog events with rate limiting and error handling
 */
export function safePostHogCapture(
  eventName: string, 
  properties?: Record<string, any>
): void {
  try {
    // Check rate limiting
    const now = Date.now()
    const lastEventTime = eventRateLimiter.get(eventName) || 0
    
    if (now - lastEventTime < RATE_LIMIT_WINDOW) {
      // Rate limited - skip this event
      console.warn(`PostHog event "${eventName}" rate limited`)
      return
    }

    // Update rate limiter
    eventRateLimiter.set(eventName, now)

    // Limit property size to prevent 413 errors
    const limitedProperties = limitPropertySize(properties)

    // Capture the event
    posthog.capture(eventName, limitedProperties)
  } catch (error) {
    // Silently handle PostHog errors to prevent console spam
    console.warn('PostHog capture error:', error)
  }
}

/**
 * Limit property size to prevent PostHog 413 errors
 */
function limitPropertySize(properties?: Record<string, any>): Record<string, any> | undefined {
  if (!properties) return properties

  const limited: Record<string, any> = {}
  let totalSize = 0
  const MAX_SIZE = 10000 // 10KB limit

  for (const [key, value] of Object.entries(properties)) {
    const serialized = JSON.stringify(value)
    if (totalSize + serialized.length > MAX_SIZE) {
      console.warn(`PostHog property "${key}" skipped due to size limit`)
      break
    }
    
    // Truncate large strings
    if (typeof value === 'string' && value.length > 1000) {
      limited[key] = value.substring(0, 1000) + '...'
    } else {
      limited[key] = value
    }
    
    totalSize += serialized.length
  }

  return limited
}

/**
 * Safely identify users with PostHog
 */
export function safePostHogIdentify(
  distinctId: string, 
  properties?: Record<string, any>
): void {
  try {
    posthog.identify(distinctId, properties)
  } catch (error) {
    console.warn('PostHog identify error:', error)
  }
}

/**
 * Safely set user properties
 */
export function safePostHogSetPersonProperties(
  properties: Record<string, any>
): void {
  try {
    posthog.people.set(properties)
  } catch (error) {
    console.warn('PostHog set person properties error:', error)
  }
}

/**
 * Check if PostHog is loaded and ready
 */
export function isPostHogReady(): boolean {
  try {
    return posthog.__loaded === true
  } catch {
    return false
  }
}

/**
 * Get PostHog instance (for advanced usage)
 */
export function getPostHogInstance() {
  return posthog
}
