'use client'

interface FallingBlocksLoaderProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function FallingBlocksLoader({ 
  text = 'Loading...', 
  size = 'md' 
}: FallingBlocksLoaderProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  const blockSizeClasses = {
    sm: 'h-1 w-1',
    md: 'h-1.5 w-1.5',
    lg: 'h-2 w-2'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`relative ${sizeClasses[size]} mb-4`}>
        {/* Falling blocks animation */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Block 1 */}
          <div 
            className={`${blockSizeClasses[size]} bg-orange rounded-sm animate-bounce`}
            style={{
              animationDelay: '0s',
              animationDuration: '1s',
              animationIterationCount: 'infinite'
            }}
          />
          {/* Block 2 */}
          <div 
            className={`${blockSizeClasses[size]} bg-orange rounded-sm animate-bounce mt-1`}
            style={{
              animationDelay: '0.2s',
              animationDuration: '1s',
              animationIterationCount: 'infinite'
            }}
          />
          {/* Block 3 */}
          <div 
            className={`${blockSizeClasses[size]} bg-orange rounded-sm animate-bounce mt-1`}
            style={{
              animationDelay: '0.4s',
              animationDuration: '1s',
              animationIterationCount: 'infinite'
            }}
          />
          {/* Block 4 */}
          <div 
            className={`${blockSizeClasses[size]} bg-orange rounded-sm animate-bounce mt-1`}
            style={{
              animationDelay: '0.6s',
              animationDuration: '1s',
              animationIterationCount: 'infinite'
            }}
          />
          {/* Block 5 */}
          <div 
            className={`${blockSizeClasses[size]} bg-orange rounded-sm animate-bounce mt-1`}
            style={{
              animationDelay: '0.8s',
              animationDuration: '1s',
              animationIterationCount: 'infinite'
            }}
          />
        </div>
        
        {/* Construction-themed background elements */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-full h-full border-2 border-gray-300 rounded-sm"></div>
        </div>
      </div>
      
      <p className={`text-black ${textSizeClasses[size]}`}>{text}</p>
    </div>
  )
}
