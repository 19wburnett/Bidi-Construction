import React from 'react'

export function TireTrackPattern() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Tire track pattern - repeating tread marks */}
      <g opacity="0.6">
        {/* Left track */}
        <g transform="translate(30, 0)">
          {Array.from({ length: 8 }).map((_, i) => (
            <g key={i} transform={`translate(0, ${i * 25})`}>
              <rect x="0" y="0" width="20" height="4" fill="currentColor" rx="2"/>
              <rect x="5" y="8" width="10" height="6" fill="currentColor" rx="1"/>
              <rect x="2" y="16" width="16" height="3" fill="currentColor" rx="1"/>
            </g>
          ))}
        </g>
        
        {/* Right track */}
        <g transform="translate(150, 0)">
          {Array.from({ length: 8 }).map((_, i) => (
            <g key={i} transform={`translate(0, ${i * 25})`}>
              <rect x="0" y="0" width="20" height="4" fill="currentColor" rx="2"/>
              <rect x="5" y="8" width="10" height="6" fill="currentColor" rx="1"/>
              <rect x="2" y="16" width="16" height="3" fill="currentColor" rx="1"/>
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}

export function BackgroundPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-orange-50/60 dark:from-black dark:via-black dark:to-orange-950/40"></div>
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange via-orange to-transparent"></div>
      
      {/* Tire track patterns - visible but subtle */}
      <div className="absolute top-32 left-10 w-80 h-80 opacity-[0.12] rotate-12 text-gray-500">
        <TireTrackPattern />
      </div>
      <div className="absolute top-[500px] right-20 w-64 h-64 opacity-[0.12] -rotate-45 text-gray-500">
        <TireTrackPattern />
      </div>
      <div className="absolute bottom-96 left-1/4 w-72 h-72 opacity-[0.10] rotate-[30deg] text-orange">
        <TireTrackPattern />
      </div>
      <div className="absolute bottom-40 right-1/3 w-56 h-56 opacity-[0.12] -rotate-12 text-gray-500">
        <TireTrackPattern />
      </div>
      
      {/* Gradient orbs for depth */}
      <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-gradient-radial from-orange/12 to-transparent blur-3xl"></div>
      <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-gradient-radial from-gray-500/12 to-transparent blur-3xl"></div>
      <div className="absolute top-2/3 left-1/3 w-80 h-80 bg-gradient-radial from-orange/10 to-transparent blur-2xl"></div>
      
      {/* Additional diagonal accent lines */}
      <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange/15 to-transparent"></div>
      <div className="absolute bottom-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-500/15 to-transparent"></div>
      
      {/* Dot pattern for texture */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle, rgba(235, 80, 35, 0.04) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>
    </div>
  )
}

