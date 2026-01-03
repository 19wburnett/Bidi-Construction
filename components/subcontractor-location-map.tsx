'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false }) as any
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false }) as any
const Rectangle = dynamic(() => import('react-leaflet').then(mod => mod.Rectangle), { ssr: false }) as any
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false }) as any

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'

interface SubcontractorLocationMapProps {
  location: string
  serviceRadius?: number | null
}

// State name to abbreviation mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY',
}

const STATE_ABBREVS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
])

// State bounds for viewport (lat/lng pairs for Leaflet)
const STATE_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  'UT': [[36.9979, -114.0529], [42.0016, -109.0452]],
  'CA': [[32.5288, -124.4096], [42.0095, -114.1312]],
  'TX': [[25.8371, -106.6456], [36.5007, -93.5083]],
  'FL': [[24.5210, -87.6348], [31.0009, -80.0314]],
  'NY': [[40.4774, -79.7626], [45.0159, -71.8562]],
  'AZ': [[31.3322, -114.8186], [37.0043, -109.0452]],
  'CO': [[36.9926, -109.0452], [41.0034, -102.0415]],
  'NV': [[35.0019, -120.0057], [42.0022, -114.0420]],
  'OR': [[41.9918, -124.5662], [46.2920, -116.4633]],
  'WA': [[45.5435, -124.7631], [49.0024, -116.9182]],
  'ID': [[41.9881, -117.2430], [49.0011, -111.0435]],
  'MT': [[44.3579, -116.0500], [49.0011, -104.0391]],
  'WY': [[40.9947, -111.0546], [45.0059, -104.0531]],
  'NM': [[31.3322, -109.0502], [37.0003, -103.0020]],
  'OK': [[33.6158, -103.0026], [37.0022, -94.4307]],
  'KS': [[36.9930, -102.0517], [40.0032, -94.5884]],
  'NE': [[39.9999, -104.0531], [43.0017, -95.3083]],
  'SD': [[42.4797, -104.0577], [45.9455, -96.4366]],
  'ND': [[45.9350, -104.0475], [49.0007, -96.5545]],
  'MN': [[43.4994, -97.2392], [49.3844, -89.4914]],
  'IA': [[40.3754, -96.6397], [43.5012, -90.1406]],
  'MO': [[35.9957, -95.7747], [40.6136, -89.0988]],
  'AR': [[33.0041, -94.6179], [36.4996, -89.7334]],
  'LA': [[28.9286, -94.0431], [33.0195, -88.8170]],
  'MS': [[30.1440, -91.6550], [34.9960, -88.0979]],
  'AL': [[30.1440, -88.4732], [35.0080, -84.8890]],
  'TN': [[34.9829, -90.3103], [36.6781, -81.6469]],
  'KY': [[36.4970, -89.5715], [39.1477, -81.9694]],
  'WV': [[37.2015, -82.6447], [40.6388, -77.7195]],
  'VA': [[36.5407, -83.6754], [39.4666, -75.2422]],
  'NC': [[33.7963, -84.3219], [36.5881, -75.4001]],
  'SC': [[32.0346, -83.3539], [35.2157, -78.5413]],
  'GA': [[30.3557, -85.6051], [35.0006, -80.8401]],
  'ME': [[43.0790, -71.0839], [47.4597, -66.9498]],
  'NH': [[42.6969, -72.5572], [45.3058, -70.6109]],
  'VT': [[42.7269, -73.3431], [45.0166, -71.4646]],
  'MA': [[41.2373, -73.5081], [42.8868, -69.8588]],
  'RI': [[41.0954, -71.8627], [42.0188, -71.1205]],
  'CT': [[40.9509, -73.7277], [42.0505, -71.7872]],
  'NJ': [[38.9285, -75.5593], [41.3574, -73.8850]],
  'DE': [[38.4511, -75.7886], [39.8390, -75.0479]],
  'MD': [[37.8865, -79.4876], [39.7230, -75.0489]],
  'PA': [[39.7198, -80.5199], [42.2699, -74.6895]],
  'OH': [[38.4032, -84.8203], [41.9775, -80.5187]],
  'MI': [[41.6961, -90.4181], [48.3038, -82.1229]],
  'WI': [[42.4919, -92.8881], [47.0806, -86.8235]],
  'IL': [[36.9702, -91.5131], [42.5083, -87.4947]],
  'IN': [[37.7717, -88.0978], [41.7606, -84.7849]],
  'HI': [[18.9104, -160.2474], [22.2282, -154.8068]],
  'AK': [[51.2097, -179.1506], [71.5388, -129.9795]],
}

function isStateLocation(location: string): { isState: boolean; stateAbbr: string | null } {
  const normalized = location.trim().toLowerCase()
  const upperNormalized = location.trim().toUpperCase()
  
  // Check if it's a state abbreviation
  if (STATE_ABBREVS.has(upperNormalized)) {
    return { isState: true, stateAbbr: upperNormalized }
  }
  
  // Check if it's a state name
  if (STATE_ABBREVIATIONS[normalized]) {
    return { isState: true, stateAbbr: STATE_ABBREVIATIONS[normalized] }
  }
  
  // Check if it contains a state abbreviation (e.g., "Salt Lake City, UT")
  const parts = normalized.split(',').map(p => p.trim())
  for (const part of parts) {
    const upperPart = part.toUpperCase()
    if (STATE_ABBREVS.has(upperPart)) {
      return { isState: false, stateAbbr: upperPart }
    }
    if (STATE_ABBREVIATIONS[part]) {
      return { isState: false, stateAbbr: STATE_ABBREVIATIONS[part] }
    }
  }
  
  return { isState: false, stateAbbr: null }
}

// Internal map component that handles a single map instance
function MapInstance({ 
  mapKey, 
  center, 
  bounds, 
  zoom, 
  isState, 
  stateAbbr, 
  serviceRadius 
}: {
  mapKey: string
  center: [number, number]
  bounds: [[number, number], [number, number]]
  zoom: number
  isState: boolean
  stateAbbr: string | null
  serviceRadius?: number | null
}) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isInitializedRef = useRef(false)
  const [isReady, setIsReady] = useState(false)
  // Generate a truly unique container ID using a combination of key and random string
  const [containerId] = useState(() => 
    `map-container-${mapKey.replace(/[^a-zA-Z0-9]/g, '-')}-${Math.random().toString(36).substr(2, 9)}`
  )

  // Clean up any existing map before rendering
  useEffect(() => {
    const cleanup = async () => {
      if (containerRef.current) {
        const container = containerRef.current
        // Check if container already has a Leaflet map
        if ((container as any)._leaflet_id) {
          try {
            // Import Leaflet to access map instances
            const L = await import('leaflet')
            const leafletId = (container as any)._leaflet_id
            // Try to get and remove existing map
            const existingMap = (L.default as any).Map?.get?.(container) || 
                              (L.default as any).map?._instances?.[leafletId]
            if (existingMap && typeof existingMap.remove === 'function') {
              existingMap.remove()
            }
          } catch (e) {
            // If that fails, just clear the container
            console.warn('Error cleaning up existing map:', e)
          }
          // Clear the leaflet ID
          delete (container as any)._leaflet_id
          // Clear inner HTML
          container.innerHTML = ''
        }
      }
      // Small delay to ensure cleanup is complete before rendering
      await new Promise(resolve => setTimeout(resolve, 0))
      // Mark as ready after cleanup
      setIsReady(true)
    }
    
    setIsReady(false)
    cleanup()
    
    // Cleanup function: properly destroy the map when component unmounts or key changes
    return () => {
      if (mapRef.current) {
        try {
          // Properly remove the Leaflet map instance
          const map = mapRef.current
          if (map && typeof map.remove === 'function') {
            map.remove()
          }
        } catch (e) {
          // Ignore errors during cleanup
          console.warn('Error removing map:', e)
        }
        mapRef.current = null
      }
      // Clear the container's leaflet ID and clean up the DOM
      if (containerRef.current) {
        const container = containerRef.current
        // Remove Leaflet ID
        if ((container as any)._leaflet_id) {
          delete (container as any)._leaflet_id
        }
        // Clear inner HTML to remove any Leaflet-generated elements
        container.innerHTML = ''
      }
      isInitializedRef.current = false
      setIsReady(false)
    }
  }, [mapKey])

  if (!isReady) {
    return (
      <div ref={containerRef} id={containerId} key={containerId} className="w-full h-full flex items-center justify-center bg-gray-100">
        <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div ref={containerRef} id={containerId} key={containerId} className="w-full h-full">
      <MapContainer
        key={`${mapKey}-${containerId}`}
        center={center}
        bounds={bounds}
        zoom={zoom}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        scrollWheelZoom={false}
        whenCreated={(map: any) => {
          // Prevent double initialization
          if (isInitializedRef.current && mapRef.current && mapRef.current !== map) {
            // If we already have a map, remove the new one
            try {
              if (map && typeof map.remove === 'function') {
                map.remove()
              }
            } catch (e) {
              // Ignore errors
            }
            return
          }
          // Store map instance for cleanup
          mapRef.current = map
          isInitializedRef.current = true
        }}
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Draw state boundary */}
      {isState && stateAbbr && STATE_BOUNDS[stateAbbr] && (
        <Rectangle
          bounds={STATE_BOUNDS[stateAbbr]}
          pathOptions={{
            color: '#ff6b35',
            fillColor: '#ff6b35',
            fillOpacity: 0.1,
            weight: 3,
          }}
        />
      )}

      {/* Draw service radius circle */}
      {serviceRadius && (
        <Circle
          center={center}
          radius={serviceRadius * 1609.34} // Convert miles to meters
          pathOptions={{
            color: '#ff6b35',
            fillColor: '#ff6b35',
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
      )}
    </MapContainer>
    </div>
  )
}

export default function SubcontractorLocationMap({
  location,
  serviceRadius,
}: SubcontractorLocationMapProps) {
  const [mounted, setMounted] = useState(false)
  const prevLocationRef = useRef<string>(location)
  const prevServiceRadiusRef = useRef<number | null | undefined>(serviceRadius)
  // Use a stable key that only changes when location or serviceRadius actually changes
  const mapInstanceKey = `map-${location}-${serviceRadius || 'none'}`
  const { isState, stateAbbr } = isStateLocation(location)
  
  // Track mounted state and fix Leaflet icons
  useEffect(() => {
    setMounted(true)
    
    // Fix Leaflet default icon issue (only on client side)
    if (typeof window !== 'undefined') {
      import('leaflet').then((L) => {
        delete (L.default.Icon.Default.prototype as any)._getIconUrl
        L.default.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })
      })
    }
  }, [])
  
  // Update refs when props change (for tracking changes)
  useEffect(() => {
    prevLocationRef.current = location
    prevServiceRadiusRef.current = serviceRadius
  }, [location, serviceRadius])

  // Calculate center and bounds for the map
  const getMapBounds = () => {
    if (isState && stateAbbr && STATE_BOUNDS[stateAbbr]) {
      return STATE_BOUNDS[stateAbbr]
    }
    // Default to Utah if state not found
    return STATE_BOUNDS['UT'] || [[36.9979, -114.0529], [42.0016, -109.0452]]
  }

  const getMapCenter = () => {
    const bounds = getMapBounds()
    const centerLat = (bounds[0][0] + bounds[1][0]) / 2
    const centerLng = (bounds[0][1] + bounds[1][1]) / 2
    return [centerLat, centerLng] as [number, number]
  }

  const bounds = getMapBounds()
  const center = getMapCenter()

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Area
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">Location: {location}</p>
            {serviceRadius && (
              <p>Service radius: {serviceRadius} miles</p>
            )}
          </div>
          <div className="w-full h-64 rounded-lg overflow-hidden border bg-gray-100 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Service Area
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p className="font-medium mb-1">Location: {location}</p>
          {serviceRadius && (
            <p>Service radius: {serviceRadius} miles</p>
          )}
        </div>

        {/* Render map with unique key to force complete remount when location/radius changes */}
        {mounted ? (
          <div 
            key={`map-wrapper-${mapInstanceKey}`}
            className="w-full h-64 rounded-lg overflow-hidden border relative"
            style={{ minHeight: '256px' }}
          >
            <MapInstance
              key={mapInstanceKey}
              mapKey={mapInstanceKey}
              center={center}
              bounds={bounds}
              zoom={isState ? 7 : 10}
              isState={isState}
              stateAbbr={stateAbbr}
              serviceRadius={serviceRadius}
            />
          </div>
        ) : (
          <div className="w-full h-64 rounded-lg overflow-hidden border bg-gray-100 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
