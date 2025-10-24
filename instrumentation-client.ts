import posthog from "posthog-js"

if (typeof window !== 'undefined') {
  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: "https://us.i.posthog.com",
      ui_host: "https://us.posthog.com",
      capture_pageview: false, // Disable automatic pageview capture
      capture_pageleave: true,
      capture_exceptions: true,
      debug: process.env.NODE_ENV === "development",
      loaded: (posthog) => {
        if (process.env.NODE_ENV === "development") console.log("PostHog loaded")
      }
    });
  } catch (error) {
    console.warn('PostHog initialization failed (likely blocked by ad blocker):', error)
  }
}
