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
        // Only use basic, guaranteed valid options
        persistence: 'localStorage',
        cross_subdomain_cookie: false,
        secure_cookie: false,
        disable_session_recording: true,
        disable_surveys: true
      });
    } catch (error) {
      console.warn('PostHog initialization failed (likely blocked by ad blocker):', error)
    }
  }
}
