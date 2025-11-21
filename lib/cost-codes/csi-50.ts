// CSI 50-Division MasterFormat Cost Codes
// Simplified for AI context

export interface CostCode {
  division: string
  code: string
  description: string
  fullCode: string
}

export const COST_CODES: CostCode[] = [
  // 01 - General Requirements
  { division: '01', code: '000', description: 'General Requirements', fullCode: '01 00 00' },
  
  // 02 - Existing Conditions
  { division: '02', code: '000', description: 'Existing Conditions', fullCode: '02 00 00' },
  { division: '02', code: '400', description: 'Demolition', fullCode: '02 40 00' },
  
  // 03 - Concrete
  { division: '03', code: '000', description: 'Concrete', fullCode: '03 00 00' },
  { division: '03', code: '300', description: 'Cast-in-Place Concrete', fullCode: '03 30 00' },
  
  // 04 - Masonry
  { division: '04', code: '000', description: 'Masonry', fullCode: '04 00 00' },
  
  // 05 - Metals
  { division: '05', code: '000', description: 'Metals', fullCode: '05 00 00' },
  { division: '05', code: '100', description: 'Structural Metal Framing', fullCode: '05 10 00' },
  
  // 06 - Wood, Plastics, and Composites
  { division: '06', code: '000', description: 'Wood, Plastics, and Composites', fullCode: '06 00 00' },
  { division: '06', code: '100', description: 'Rough Carpentry', fullCode: '06 10 00' },
  { division: '06', code: '200', description: 'Finish Carpentry', fullCode: '06 20 00' },
  
  // 07 - Thermal and Moisture Protection
  { division: '07', code: '000', description: 'Thermal and Moisture Protection', fullCode: '07 00 00' },
  { division: '07', code: '200', description: 'Thermal Protection', fullCode: '07 20 00' },
  { division: '07', code: '500', description: 'Membrane Roofing', fullCode: '07 50 00' },
  
  // 08 - Openings
  { division: '08', code: '000', description: 'Openings', fullCode: '08 00 00' },
  { division: '08', code: '100', description: 'Doors and Frames', fullCode: '08 10 00' },
  { division: '08', code: '500', description: 'Windows', fullCode: '08 50 00' },
  
  // 09 - Finishes
  { division: '09', code: '000', description: 'Finishes', fullCode: '09 00 00' },
  { division: '09', code: '200', description: 'Plaster and Gypsum Board', fullCode: '09 20 00' },
  { division: '09', code: '300', description: 'Tiling', fullCode: '09 30 00' },
  { division: '09', code: '600', description: 'Flooring', fullCode: '09 60 00' },
  { division: '09', code: '900', description: 'Painting and Coating', fullCode: '09 90 00' },
  
  // 10 - Specialties
  { division: '10', code: '000', description: 'Specialties', fullCode: '10 00 00' },
  
  // 11 - Equipment
  { division: '11', code: '000', description: 'Equipment', fullCode: '11 00 00' },
  
  // 12 - Furnishings
  { division: '12', code: '000', description: 'Furnishings', fullCode: '12 00 00' },
  
  // 21 - Fire Suppression
  { division: '21', code: '000', description: 'Fire Suppression', fullCode: '21 00 00' },
  
  // 22 - Plumbing
  { division: '22', code: '000', description: 'Plumbing', fullCode: '22 00 00' },
  
  // 23 - HVAC
  { division: '23', code: '000', description: 'Heating, Ventilating, and Air Conditioning (HVAC)', fullCode: '23 00 00' },
  
  // 26 - Electrical
  { division: '26', code: '000', description: 'Electrical', fullCode: '26 00 00' },
  
  // 27 - Communications
  { division: '27', code: '000', description: 'Communications', fullCode: '27 00 00' },
  
  // 31 - Earthwork
  { division: '31', code: '000', description: 'Earthwork', fullCode: '31 00 00' },
  
  // 32 - Exterior Improvements
  { division: '32', code: '000', description: 'Exterior Improvements', fullCode: '32 00 00' },
  
  // 33 - Utilities
  { division: '33', code: '000', description: 'Utilities', fullCode: '33 00 00' }
]

export const PROMPT_TEXT = `
CSI 50-DIVISION COST CODE REFERENCE (MASTERFORMAT):
Use these standard MasterFormat divisions and codes:

DIVISION 02 - EXISTING CONDITIONS:
- 02 40 00: Demolition

DIVISION 03 - CONCRETE:
- 03 30 00: Cast-in-Place Concrete

DIVISION 04 - MASONRY:
- 04 20 00: Unit Masonry

DIVISION 05 - METALS:
- 05 10 00: Structural Metal Framing
- 05 50 00: Metal Fabrications

DIVISION 06 - WOOD, PLASTICS, COMPOSITES:
- 06 10 00: Rough Carpentry
- 06 20 00: Finish Carpentry
- 06 40 00: Architectural Woodwork

DIVISION 07 - THERMAL AND MOISTURE PROTECTION:
- 07 20 00: Thermal Protection (Insulation)
- 07 50 00: Membrane Roofing
- 07 60 00: Flashing and Sheet Metal
- 07 90 00: Joint Protection

DIVISION 08 - OPENINGS:
- 08 10 00: Doors and Frames
- 08 50 00: Windows

DIVISION 09 - FINISHES:
- 09 20 00: Plaster and Gypsum Board
- 09 30 00: Tiling
- 09 60 00: Flooring
- 09 90 00: Painting and Coating

DIVISION 22 - PLUMBING:
- 22 10 00: Plumbing Piping
- 22 40 00: Plumbing Fixtures

DIVISION 23 - HVAC:
- 23 30 00: HVAC Air Distribution
- 23 80 00: Decentralized HVAC Equipment

DIVISION 26 - ELECTRICAL:
- 26 20 00: Low-Voltage Electrical Transmission
- 26 50 00: Lighting

DIVISION 31 - EARTHWORK:
- 31 20 00: Earth Moving

DIVISION 32 - EXTERIOR IMPROVEMENTS:
- 32 10 00: Bases, Ballasts, and Paving
- 32 90 00: Planting
`

