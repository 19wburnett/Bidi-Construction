// Procore Default Cost Codes Utility
// Parsed from Procore_Default_Cost_Codes.csv

export interface ProcoreCostCode {
  division: string
  code: string
  description: string
  fullCode: string // e.g., "3,300"
}

// Comprehensive Procore cost codes organized by division
export const COST_CODES: ProcoreCostCode[] = [
  // Division 1 - General Requirements
  { division: '1', code: '0', description: 'General Requirements', fullCode: '1,0' },
  { division: '1', code: '500', description: 'Temporary Facilities and Controls', fullCode: '1,500' },
  { division: '1', code: '740', description: 'Cleaning', fullCode: '1,740' },
  
  // Division 2 - Site Construction
  { division: '2', code: '0', description: 'Site Construction', fullCode: '2,0' },
  { division: '2', code: '200', description: 'Site Preparation', fullCode: '2,200' },
  { division: '2', code: '220', description: 'Site Demolition', fullCode: '2,220' },
  { division: '2', code: '230', description: 'Site Clearing', fullCode: '2,230' },
  { division: '2', code: '240', description: 'Dewatering', fullCode: '2,240' },
  { division: '2', code: '300', description: 'Earthwork', fullCode: '2,300' },
  { division: '2', code: '310', description: 'Grading', fullCode: '2,310' },
  { division: '2', code: '311', description: 'Final Grading', fullCode: '2,311' },
  { division: '2', code: '312', description: 'Rough Grading', fullCode: '2,312' },
  { division: '2', code: '315', description: 'Excavation', fullCode: '2,315' },
  { division: '2', code: '316', description: 'Backfilling', fullCode: '2,316' },
  { division: '2', code: '317', description: 'Select Borrow', fullCode: '2,317' },
  { division: '2', code: '320', description: 'Excavation and Fill', fullCode: '2,320' },
  { division: '2', code: '362', description: 'Termite Control', fullCode: '2,362' },
  { division: '2', code: '370', description: 'Erosion and Sedimentation Control', fullCode: '2,370' },
  { division: '2', code: '621', description: 'Foundation Drainage Piping', fullCode: '2,621' },
  { division: '2', code: '625', description: 'Retaining Wall Drainage Piping', fullCode: '2,625' },
  { division: '2', code: '750', description: 'Concrete Pads and Walks', fullCode: '2,750' },
  { division: '2', code: '770', description: 'Curb and Gutters', fullCode: '2,770' },
  { division: '2', code: '812', description: 'Drip Irrigation', fullCode: '2,812' },
  { division: '2', code: '813', description: 'Lawn Sprinkling and Irrigation', fullCode: '2,813' },
  { division: '2', code: '820', description: 'Fences and Gates', fullCode: '2,820' },
  { division: '2', code: '825', description: 'Wood Fences and Gates', fullCode: '2,825' },
  { division: '2', code: '830', description: 'Retaining Walls', fullCode: '2,830' },
  { division: '2', code: '900', description: 'Landscaping', fullCode: '2,900' },
  { division: '2', code: '915', description: 'Mulch', fullCode: '2,915' },
  { division: '2', code: '917', description: 'Soil Preparation', fullCode: '2,917' },
  { division: '2', code: '919', description: 'Topsoil', fullCode: '2,919' },
  { division: '2', code: '923', description: 'Seeding and Soil Supplements', fullCode: '2,923' },
  { division: '2', code: '924', description: 'Sodding', fullCode: '2,924' },
  { division: '2', code: '930', description: 'Exterior Plants', fullCode: '2,930' },
  
  // Division 3 - Concrete
  { division: '3', code: '0', description: 'Concrete', fullCode: '3,0' },
  { division: '3', code: '50', description: 'Concrete Subcontractor', fullCode: '3,50' },
  { division: '3', code: '100', description: 'Concrete Reinforcement', fullCode: '3,100' },
  { division: '3', code: '210', description: 'Cast-In-Place Concrete', fullCode: '3,210' },
  { division: '3', code: '230', description: 'Anchor Bolts', fullCode: '3,230' },
  { division: '3', code: '300', description: 'Footings', fullCode: '3,300' },
  { division: '3', code: '310', description: 'Expansion Joints', fullCode: '3,310' },
  { division: '3', code: '320', description: 'Slab Foundations', fullCode: '3,320' },
  { division: '3', code: '330', description: 'Poured Concrete Basement Walls', fullCode: '3,330' },
  { division: '3', code: '350', description: 'Concrete Finishing', fullCode: '3,350' },
  { division: '3', code: '400', description: 'Precast Concrete', fullCode: '3,400' },
  { division: '3', code: '540', description: 'Cementitious Underlayments', fullCode: '3,540' },
  
  // Division 4 - Masonry
  { division: '4', code: '0', description: 'Masonry', fullCode: '4,0' },
  { division: '4', code: '50', description: 'Basic Masonry Materials and Methods', fullCode: '4,50' },
  { division: '4', code: '200', description: 'Masonry Units', fullCode: '4,200' },
  { division: '4', code: '400', description: 'Stone', fullCode: '4,400' },
  { division: '4', code: '700', description: 'Simulated Masonry', fullCode: '4,700' },
  
  // Division 5 - Metals
  { division: '5', code: '0', description: 'Metals', fullCode: '5,0' },
  { division: '5', code: '50', description: 'Basic Metal Materials and Methods', fullCode: '5,50' },
  { division: '5', code: '100', description: 'Structural Metals', fullCode: '5,100' },
  { division: '5', code: '200', description: 'Metal Joists', fullCode: '5,200' },
  { division: '5', code: '300', description: 'Metal Deck', fullCode: '5,300' },
  { division: '5', code: '400', description: 'Cold-Formed Metal Framing', fullCode: '5,400' },
  { division: '5', code: '500', description: 'Metal Fabrications', fullCode: '5,500' },
  { division: '5', code: '700', description: 'Ornamental Metal', fullCode: '5,700' },
  
  // Division 6 - Wood and Plastics
  { division: '6', code: '0', description: 'Wood and Plastics', fullCode: '6,0' },
  { division: '6', code: '50', description: 'Basic Wood and Plastic Materials and Methods', fullCode: '6,50' },
  { division: '6', code: '100', description: 'Rough Carpentry', fullCode: '6,100' },
  { division: '6', code: '200', description: 'Finish Carpentry', fullCode: '6,200' },
  { division: '6', code: '400', description: 'Architectural Woodwork', fullCode: '6,400' },
  { division: '6', code: '500', description: 'Structural Plastics', fullCode: '6,500' },
  
  // Division 7 - Thermal and Moisture Protection
  { division: '7', code: '0', description: 'Thermal and Moisture Protection', fullCode: '7,0' },
  { division: '7', code: '100', description: 'Damproofing and Waterproofing', fullCode: '7,100' },
  { division: '7', code: '200', description: 'Thermal Protection - Insulation', fullCode: '7,200' },
  { division: '7', code: '300', description: 'Shingles, Roof Tiles, and Roof Coverings', fullCode: '7,300' },
  { division: '7', code: '400', description: 'Roofing and Siding Panels', fullCode: '7,400' },
  { division: '7', code: '500', description: 'Membrane Roofing', fullCode: '7,500' },
  { division: '7', code: '600', description: 'Flashing and Sheet Metal', fullCode: '7,600' },
  { division: '7', code: '700', description: 'Roof Specialties and Accessories', fullCode: '7,700' },
  { division: '7', code: '800', description: 'Fire and Smoke Protection', fullCode: '7,800' },
  { division: '7', code: '900', description: 'Joint Sealers', fullCode: '7,900' },
  
  // Division 8 - Doors and Windows
  { division: '8', code: '0', description: 'Doors and Windows', fullCode: '8,0' },
  { division: '8', code: '100', description: 'Doors', fullCode: '8,100' },
  { division: '8', code: '200', description: 'Wood and Plastic Doors', fullCode: '8,200' },
  { division: '8', code: '300', description: 'Specialty Doors', fullCode: '8,300' },
  { division: '8', code: '400', description: 'Entrances and Storefronts', fullCode: '8,400' },
  { division: '8', code: '500', description: 'Windows', fullCode: '8,500' },
  { division: '8', code: '600', description: 'Skylights', fullCode: '8,600' },
  { division: '8', code: '700', description: 'Hardware', fullCode: '8,700' },
  { division: '8', code: '800', description: 'Glazing', fullCode: '8,800' },
  
  // Division 9 - Finishes
  { division: '9', code: '0', description: 'Finishes', fullCode: '9,0' },
  { division: '9', code: '100', description: 'Metal Support Assemblies', fullCode: '9,100' },
  { division: '9', code: '250', description: 'Gypsum Wallboard', fullCode: '9,250' },
  { division: '9', code: '300', description: 'Tile', fullCode: '9,300' },
  { division: '9', code: '400', description: 'Terrazzo', fullCode: '9,400' },
  { division: '9', code: '500', description: 'Ceilings', fullCode: '9,500' },
  { division: '9', code: '600', description: 'Flooring', fullCode: '9,600' },
  { division: '9', code: '680', description: 'Carpet', fullCode: '9,680' },
  { division: '9', code: '700', description: 'Wall Finishes', fullCode: '9,700' },
  { division: '9', code: '800', description: 'Acoustical Treatment', fullCode: '9,800' },
  { division: '9', code: '900', description: 'Paints and Coatings', fullCode: '9,900' },
  
  // Division 10 - Specialties
  { division: '10', code: '0', description: 'Specialties', fullCode: '10,0' },
  { division: '10', code: '150', description: 'Compartments and Cubicles', fullCode: '10,150' },
  { division: '10', code: '200', description: 'Louvers and Vents', fullCode: '10,200' },
  { division: '10', code: '240', description: 'Grilles and Screens', fullCode: '10,240' },
  { division: '10', code: '260', description: 'Wall and Corner Guards', fullCode: '10,260' },
  { division: '10', code: '300', description: 'Fireplaces and Stoves', fullCode: '10,300' },
  { division: '10', code: '400', description: 'Identification Devices', fullCode: '10,400' },
  { division: '10', code: '500', description: 'Lockers', fullCode: '10,500' },
  { division: '10', code: '520', description: 'Fire Protection Specialties', fullCode: '10,520' },
  { division: '10', code: '670', description: 'Storage Shelving', fullCode: '10,670' },
  { division: '10', code: '800', description: 'Toilet, Bath, and Laundry Specialties', fullCode: '10,800' },
  { division: '10', code: '820', description: 'Bathroom Accessories', fullCode: '10,820' },
  { division: '10', code: '900', description: 'Wardrobe and Closet Specialties', fullCode: '10,900' },
  
  // Division 11 - Equipment
  { division: '11', code: '0', description: 'Equipment', fullCode: '11,0' },
  { division: '11', code: '400', description: 'Food Service Equipment', fullCode: '11,400' },
  { division: '11', code: '450', description: 'Residential Equipment', fullCode: '11,450' },
  { division: '11', code: '460', description: 'Unit Kitchens', fullCode: '11,460' },
  
  // Division 12 - Furnishings
  { division: '12', code: '0', description: 'Furnishings', fullCode: '12,0' },
  { division: '12', code: '100', description: 'Art', fullCode: '12,100' },
  { division: '12', code: '300', description: 'Manufactured Casework', fullCode: '12,300' },
  { division: '12', code: '400', description: 'Furnishings and Accessories', fullCode: '12,400' },
  { division: '12', code: '500', description: 'Furniture', fullCode: '12,500' },
  
  // Division 13 - Special Construction
  { division: '13', code: '0', description: 'Special Construction', fullCode: '13,0' },
  { division: '13', code: '100', description: 'Lightning Protection', fullCode: '13,100' },
  { division: '13', code: '150', description: 'Swimming Pools', fullCode: '13,150' },
  { division: '13', code: '700', description: 'Security Access and Surveillance', fullCode: '13,700' },
  { division: '13', code: '850', description: 'Detection and Alarm', fullCode: '13,850' },
  { division: '13', code: '900', description: 'Fire Suppression', fullCode: '13,900' },
  
  // Division 15 - Mechanical
  { division: '15', code: '0', description: 'Mechanical', fullCode: '15,0' },
  { division: '15', code: '100', description: 'Plumbing', fullCode: '15,100' },
  { division: '15', code: '200', description: 'Process Piping', fullCode: '15,200' },
  { division: '15', code: '300', description: 'Fire Protection Piping', fullCode: '15,300' },
  { division: '15', code: '400', description: 'Plumbing Fixtures and Equipment', fullCode: '15,400' },
  { division: '15', code: '500', description: 'Heat-Generation Equipment', fullCode: '15,500' },
  { division: '15', code: '600', description: 'Refrigeration Equipment', fullCode: '15,600' },
  { division: '15', code: '700', description: 'Heating, Venting and Air Conditioning', fullCode: '15,700' },
  { division: '15', code: '800', description: 'Air Distribution', fullCode: '15,800' },
  { division: '15', code: '900', description: 'HVAC Instruments and Controls', fullCode: '15,900' },
  
  // Division 16 - Electrical
  { division: '16', code: '0', description: 'Electrical', fullCode: '16,0' },
  { division: '16', code: '100', description: 'Electrical', fullCode: '16,100' },
  { division: '16', code: '200', description: 'Electrical Power', fullCode: '16,200' },
  { division: '16', code: '300', description: 'Transmission and Distribution', fullCode: '16,300' },
  { division: '16', code: '400', description: 'Low-Voltage Distribution', fullCode: '16,400' },
  { division: '16', code: '500', description: 'Lighting', fullCode: '16,500' },
  { division: '16', code: '700', description: 'Communications', fullCode: '16,700' },
  { division: '16', code: '800', description: 'Sound and Video', fullCode: '16,800' },
]

// Category to Division mapping for AI guidance
export const CATEGORY_DIVISION_MAP = {
  structural: {
    foundation: ['3,300', '3,320', '3,330', '3,100'],
    framing: ['6,100', '5,100', '5,200', '5,400'],
    'structural steel': ['5,100', '5,200', '5,300'],
    'engineered lumber': ['6,100', '6,500']
  },
  exterior: {
    'siding & cladding': ['7,400', '4,200', '4,700'],
    windows: ['8,500', '8,600'],
    'exterior doors': ['8,100', '8,200', '8,300'],
    roofing: ['7,300', '7,400', '7,500', '7,600'],
    'gutters & downspouts': ['7,700'],
    'exterior trim': ['6,200'],
    'decks & porches': ['6,100', '5,500']
  },
  interior: {
    'interior walls': ['9,250', '6,100'],
    'interior doors': ['8,100', '8,200'],
    flooring: ['9,600', '9,680'],
    ceilings: ['9,500'],
    'interior trim': ['6,200', '6,400'],
    stairs: ['6,100', '5,500'],
    'cabinets & millwork': ['6,400', '12,300'],
    countertops: ['12,300']
  },
  mep: {
    electrical: ['16,100', '16,200', '16,400', '16,500', '16,700', '16,800'],
    plumbing: ['15,100', '15,200', '15,400'],
    hvac: ['15,500', '15,600', '15,700', '15,800', '15,900'],
    'fire protection': ['13,850', '13,900', '15,300', '10,520']
  },
  finishes: {
    paint: ['9,900'],
    tile: ['9,300', '9,400'],
    wallcovering: ['9,700'],
    hardware: ['8,700'],
    'mirrors & accessories': ['10,820', '10,800'],
    appliances: ['11,400', '11,450', '11,460']
  },
  other: {
    insulation: ['7,200'],
    weatherproofing: ['7,100', '7,900'],
    'site work': ['2,200', '2,220', '2,230', '2,310', '2,315', '2,316', '2,370'],
    concrete: ['2,750', '3,210'],
    landscaping: ['2,900', '2,915', '2,917', '2,923', '2,924', '2,930'],
    specialties: ['10,300', '10,400', '10,500', '10,670', '10,900']
  }
}

/**
 * Find a cost code by searching for keyword matches
 */
export function findCostCode(
  itemName: string,
  category?: string,
  subcategory?: string
): ProcoreCostCode | null {
  const searchTerm = itemName.toLowerCase()
  
  // Try to find by exact or partial match
  const match = COST_CODES.find(code => 
    code.description.toLowerCase().includes(searchTerm) ||
    searchTerm.includes(code.description.toLowerCase())
  )
  
  if (match) return match
  
  // If we have category and subcategory, try to find from the mapping
  if (category && subcategory) {
    const categoryMap = CATEGORY_DIVISION_MAP[category.toLowerCase() as keyof typeof CATEGORY_DIVISION_MAP]
    if (categoryMap) {
      const subcatMap = categoryMap[subcategory.toLowerCase() as keyof typeof categoryMap]
      if (subcatMap && subcatMap.length > 0) {
        return COST_CODES.find(code => code.fullCode === subcatMap[0]) || null
      }
    }
  }
  
  return null
}

/**
 * Get all cost codes for a specific division
 */
export function getCostCodesByDivision(division: string): ProcoreCostCode[] {
  return COST_CODES.filter(code => code.division === division)
}

/**
 * Get relevant cost codes for the AI prompt
 */
export function getRelevantCostCodesForPrompt(): string {
  return `
PROCORE COST CODE REFERENCE:
Use these standardized cost codes for categorization:

DIVISION 2 - SITE CONSTRUCTION:
- 2,310: Grading
- 2,315: Excavation
- 2,316: Backfilling
- 2,750: Concrete Pads and Walks
- 2,900: Landscaping

DIVISION 3 - CONCRETE:
- 3,100: Concrete Reinforcement
- 3,210: Cast-In-Place Concrete
- 3,300: Footings
- 3,320: Slab Foundations
- 3,330: Poured Concrete Basement Walls

DIVISION 5 - METALS:
- 5,100: Structural Metals
- 5,200: Metal Joists
- 5,300: Metal Deck
- 5,400: Cold-Formed Metal Framing
- 5,500: Metal Fabrications

DIVISION 6 - WOOD:
- 6,100: Rough Carpentry (framing, joists, rafters, studs, sheathing)
- 6,200: Finish Carpentry (trim, molding, baseboards)
- 6,400: Architectural Woodwork (cabinets, built-ins)

DIVISION 7 - THERMAL/MOISTURE:
- 7,100: Damproofing and Waterproofing
- 7,200: Thermal Protection - Insulation
- 7,300: Shingles, Roof Tiles, and Roof Coverings
- 7,400: Roofing and Siding Panels
- 7,600: Flashing and Sheet Metal
- 7,700: Roof Specialties and Accessories

DIVISION 8 - DOORS/WINDOWS:
- 8,100: Doors (general)
- 8,200: Wood and Plastic Doors
- 8,300: Specialty Doors
- 8,500: Windows
- 8,700: Hardware

DIVISION 9 - FINISHES:
- 9,250: Gypsum Wallboard (drywall)
- 9,300: Tile
- 9,500: Ceilings
- 9,600: Flooring
- 9,680: Carpet
- 9,700: Wall Finishes
- 9,900: Paints and Coatings

DIVISION 10 - SPECIALTIES:
- 10,300: Fireplaces and Stoves
- 10,520: Fire Protection Specialties
- 10,820: Bathroom Accessories

DIVISION 11 - EQUIPMENT:
- 11,400: Food Service Equipment
- 11,450: Residential Equipment (appliances)

DIVISION 12 - FURNISHINGS:
- 12,300: Manufactured Casework (cabinets, countertops)

DIVISION 13 - SPECIAL CONSTRUCTION:
- 13,850: Detection and Alarm
- 13,900: Fire Suppression

DIVISION 15 - MECHANICAL:
- 15,100: Plumbing
- 15,300: Fire Protection Piping
- 15,400: Plumbing Fixtures and Equipment
- 15,500: Heat-Generation Equipment
- 15,700: Heating, Venting and Air Conditioning
- 15,800: Air Distribution

DIVISION 16 - ELECTRICAL:
- 16,100: Electrical (general)
- 16,200: Electrical Power
- 16,400: Low-Voltage Distribution
- 16,500: Lighting
- 16,700: Communications
`
}


