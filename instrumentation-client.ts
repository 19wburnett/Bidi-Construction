import posthog from "posthog-js"

if (typeof window !== 'undefined') {
  // Check if PostHog key exists and is not blocked
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  
  if (!posthogKey) {
    console.log('PostHog key not found, skipping analytics initialization')
  } else {
    try {
      posthog.init(posthogKey, {
        api_host: "https://us.i.posthog.com",
        ui_host: "https://us.posthog.com",
        capture_pageview: false, // Disable automatic pageview capture
        capture_pageleave: false, // Disable to prevent retry loops
        capture_exceptions: false, // Disable to prevent retry loops
        debug: process.env.NODE_ENV === "development",
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") console.log("PostHog loaded")
        },
        // Use valid PostHog options to prevent retry loops
        persistence: 'localStorage', // Use localStorage instead of cookies
        cross_subdomain_cookie: false, // Disable cross-subdomain tracking
        secure_cookie: false, // Disable secure cookies
        disable_session_recording: true, // Disable session recording
        disable_persistence: false, // Keep persistence but limit it
        disable_surveys: true, // Disable surveys
        disable_toolbar: true, // Disable toolbar
        disable_compression: true, // Disable compression to reduce complexity
        batch_requests: false, // Disable batching
        request_timeout_ms: 5000, // Short timeout to prevent hanging
        on_xhr_error: () => {}, // Silent error handling
        on_request_error: () => {} // Silent error handling
      });
    } catch (error) {
      console.warn('PostHog initialization failed (likely blocked by ad blocker):', error)
    }
  }
}
