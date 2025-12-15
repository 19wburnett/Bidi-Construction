import crypto from 'crypto'
import type { TakeoffItem } from './takeoff-matcher'

/**
 * Generate a hash of takeoff items for caching purposes
 */
export function hashTakeoffItems(takeoffItems: TakeoffItem[]): string {
  // Sort items by id to ensure consistent hashing
  const sorted = [...takeoffItems].sort((a, b) => a.id.localeCompare(b.id))
  
  // Create a string representation of the items
  const itemsString = sorted.map(item => 
    `${item.id}:${item.description}:${item.quantity}:${item.unit}:${item.unit_cost || 0}`
  ).join('|')
  
  // Generate SHA-256 hash
  return crypto.createHash('sha256').update(itemsString).digest('hex')
}

/**
 * Sort bid IDs for consistent hashing
 */
export function sortBidIds(bidIds: string[]): string[] {
  return [...bidIds].sort()
}


