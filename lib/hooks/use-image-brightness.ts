'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect if an image is generally dark or light.
 * Useful for determining text contrast.
 */
export function useImageBrightness(imageUrl: string | null | undefined) {
  const [isDark, setIsDark] = useState<boolean>(true) // Default to dark (white text) for safety

  useEffect(() => {
    if (!imageUrl) {
      setIsDark(true) // Default for orange gradient
      return
    }

    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = imageUrl

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // We only need a tiny version to get the average
        canvas.width = 10
        canvas.height = 10

        ctx.drawImage(img, 0, 0, 10, 10)
        const imageData = ctx.getImageData(0, 0, 10, 10)
        const data = imageData.data

        let totalBrightness = 0
        for (let i = 0; i < data.length; i += 4) {
          // Standard luminance formula
          const brightness = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
          totalBrightness += brightness
        }

        const avgBrightness = totalBrightness / (data.length / 4)
        // 128 is the middle point of 0-255
        setIsDark(avgBrightness < 140) // Slightly biased towards dark to keep white text more often
      } catch (e) {
        console.warn('Could not detect image brightness due to CORS or other error', e)
        setIsDark(true)
      }
    }

    img.onerror = () => {
      setIsDark(true)
    }
  }, [imageUrl])

  return isDark
}




