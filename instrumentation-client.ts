import posthog from "posthog-js"

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    capture_pageview: false, // Disable automatic pageview capture
    capture_pageleave: true,
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    
    // Disable session recordings to prevent 413 errors
    disable_session_recording: true,
    
    // Rate limiting and batching configuration
    batch_events: true, // Batch events to reduce API calls
    batch_size: 5, // Smaller batch size to prevent payload issues
    batch_flush_interval_ms: 10000, // Flush batch every 10 seconds
    
    // Compression settings
    compression: 'gzip-js',
    
    // Error handling
    on_xhr_error: (failedRequest) => {
      // Handle different error types
      if (failedRequest.status === 413) {
        console.warn('PostHog payload too large, skipping event')
        return false // Don't retry 413 errors
      }
      if (failedRequest.status === 429) {
        console.warn('PostHog rate limit exceeded, events will be retried')
        return false // Don't retry immediately
      }
      if (failedRequest.status === 0) {
        console.warn('PostHog CORS error, skipping event')
        return false // Don't retry CORS errors
      }
      return true // Retry other errors
    },
    
    // Disable problematic features that cause large payloads
    disable_surveys: true,
    disable_toolbar: true,
    
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") console.log("PostHog loaded")
      
      // Disable session recordings programmatically as backup
      posthog.sessionRecording?.stop()
    }
  });
}
