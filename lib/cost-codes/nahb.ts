// NAHB Residential Cost Codes
// Simplified for AI context

export interface CostCode {
  division: string
  code: string
  description: string
  fullCode: string
}

export const COST_CODES: CostCode[] = [
  // 1000 - Preparation
  { division: '1000', code: '1100', description: 'Plans and Permits', fullCode: '1100' },
  { division: '1000', code: '1200', description: 'Engineering and Layout', fullCode: '1200' },
  { division: '1000', code: '1300', description: 'Temporary Utilities', fullCode: '1300' },
  { division: '1000', code: '1400', description: 'Site Preparation', fullCode: '1400' },
  
  // 2000 - Foundation
  { division: '2000', code: '2100', description: 'Excavation and Backfill', fullCode: '2100' },
  { division: '2000', code: '2200', description: 'Footings and Walls', fullCode: '2200' },
  { division: '2000', code: '2300', description: 'Concrete Slab', fullCode: '2300' },
  { division: '2000', code: '2400', description: 'Waterproofing', fullCode: '2400' },
  
  // 3000 - Framing
  { division: '3000', code: '3100', description: 'Framing Labor', fullCode: '3100' },
  { division: '3000', code: '3200', description: 'Framing Material', fullCode: '3200' },
  { division: '3000', code: '3300', description: 'Trusses', fullCode: '3300' },
  { division: '3000', code: '3400', description: 'Sheathing', fullCode: '3400' },
  
  // 4000 - Exterior
  { division: '4000', code: '4100', description: 'Roofing', fullCode: '4100' },
  { division: '4000', code: '4200', description: 'Siding', fullCode: '4200' },
  { division: '4000', code: '4300', description: 'Brick and Masonry', fullCode: '4300' },
  { division: '4000', code: '4400', description: 'Windows and Exterior Doors', fullCode: '4400' },
  
  // 5000 - Utilities
  { division: '5000', code: '5100', description: 'Plumbing Rough-In', fullCode: '5100' },
  { division: '5000', code: '5200', description: 'HVAC Rough-In', fullCode: '5200' },
  { division: '5000', code: '5300', description: 'Electrical Rough-In', fullCode: '5300' },
  
  // 6000 - Finishes
  { division: '6000', code: '6100', description: 'Insulation', fullCode: '6100' },
  { division: '6000', code: '6200', description: 'Drywall', fullCode: '6200' },
  { division: '6000', code: '6300', description: 'Interior Trim', fullCode: '6300' },
  { division: '6000', code: '6400', description: 'Painting', fullCode: '6400' },
  { division: '6000', code: '6500', description: 'Flooring', fullCode: '6500' },
  { division: '6000', code: '6600', description: 'Cabinets and Countertops', fullCode: '6600' },
  
  // 7000 - Systems Final
  { division: '7000', code: '7100', description: 'Plumbing Trim', fullCode: '7100' },
  { division: '7000', code: '7200', description: 'HVAC Trim', fullCode: '7200' },
  { division: '7000', code: '7300', description: 'Electrical Trim', fullCode: '7300' },
  { division: '7000', code: '7400', description: 'Appliances', fullCode: '7400' },
  
  // 8000 - Landscaping and Outdoor
  { division: '8000', code: '8100', description: 'Grading and Drainage', fullCode: '8100' },
  { division: '8000', code: '8200', description: 'Landscaping', fullCode: '8200' },
  { division: '8000', code: '8300', description: 'Decks and Patios', fullCode: '8300' },
  { division: '8000', code: '8400', description: 'Fencing', fullCode: '8400' }
]

export const PROMPT_TEXT = `
NAHB RESIDENTIAL COST CODE REFERENCE:
Use these standardized NAHB cost codes for residential construction:

2000 - FOUNDATION:
- 2100: Excavation and Backfill
- 2200: Footings and Walls
- 2300: Concrete Slab
- 2400: Waterproofing

3000 - FRAMING:
- 3100: Framing Labor
- 3200: Framing Material
- 3300: Trusses
- 3400: Sheathing

4000 - EXTERIOR:
- 4100: Roofing
- 4200: Siding
- 4300: Brick and Masonry
- 4400: Windows and Exterior Doors

5000 - UTILITIES ROUGH:
- 5100: Plumbing Rough-In
- 5200: HVAC Rough-In
- 5300: Electrical Rough-In

6000 - FINISHES:
- 6100: Insulation
- 6200: Drywall
- 6300: Interior Trim
- 6400: Painting
- 6500: Flooring
- 6600: Cabinets and Countertops

7000 - UTILITIES TRIM:
- 7100: Plumbing Trim
- 7200: HVAC Trim
- 7300: Electrical Trim
- 7400: Appliances

8000 - OUTDOOR:
- 8100: Grading and Drainage
- 8200: Landscaping
- 8300: Decks and Patios
`

