/**
 * Performance optimization utilities for the Bidi Construction app
 */

// Debounce function to limit the rate of function calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle function to ensure function is called at most once per interval
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Memoization for expensive calculations
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()
  
  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args)
    
    if (cache.has(key)) {
      return cache.get(key)
    }
    
    const result = func(...args)
    cache.set(key, result)
    return result
  }) as T
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map()
  
  static startTimer(label: string): () => void {
    const start = performance.now()
    
    return () => {
      const end = performance.now()
      const duration = end - start
      
      if (!this.measurements.has(label)) {
        this.measurements.set(label, [])
      }
      
      const measurements = this.measurements.get(label)!
      measurements.push(duration)
      
      // Keep only last 100 measurements
      if (measurements.length > 100) {
        measurements.shift()
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`)
      }
    }
  }
  
  static getAverageTime(label: string): number {
    const measurements = this.measurements.get(label)
    if (!measurements || measurements.length === 0) return 0
    
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length
  }
  
  static getAllMeasurements(): Record<string, number[]> {
    return Object.fromEntries(this.measurements)
  }
  
  static clearMeasurements(): void {
    this.measurements.clear()
  }
}

// Database query optimization helpers
export const DatabaseOptimizations = {
  // Batch multiple queries into a single request
  batchQueries: async <T>(
    queries: (() => Promise<T>)[]
  ): Promise<T[]> => {
    return Promise.all(queries.map(query => query()))
  },
  
  // Optimize Supabase queries by reducing data transfer
  optimizeQuery: (selectFields: string[], limit?: number) => {
    let query = selectFields.join(', ')
    if (limit) {
      query += ` LIMIT ${limit}`
    }
    return query
  },
  
  // Cache frequently accessed data
  cache: new Map<string, { data: any; timestamp: number; ttl: number }>(),
  
  setCache: (key: string, data: any, ttlMs: number = 300000) => { // 5 min default
    DatabaseOptimizations.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  },
  
  getCache: (key: string): any | null => {
    const cached = DatabaseOptimizations.cache.get(key)
    if (!cached) return null
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl
    if (isExpired) {
      DatabaseOptimizations.cache.delete(key)
      return null
    }
    
    return cached.data
  },
  
  clearCache: (key?: string) => {
    if (key) {
      DatabaseOptimizations.cache.delete(key)
    } else {
      DatabaseOptimizations.cache.clear()
    }
  }
}

// Component optimization helpers
export const ComponentOptimizations = {
  // Prevent unnecessary re-renders with shallow comparison
  shallowEqual: <T>(obj1: T, obj2: T): boolean => {
    if (obj1 === obj2) return true
    
    if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
      return false
    }
    
    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    
    if (keys1.length !== keys2.length) return false
    
    for (const key of keys1) {
      if (!keys2.includes(key) || obj1[key as keyof T] !== obj2[key as keyof T]) {
        return false
      }
    }
    
    return true
  },
  
  // Create stable references for React dependencies
  createStableRef: <T>(value: T): (() => T) => {
    let stableValue = value
    return () => stableValue
  }
}
