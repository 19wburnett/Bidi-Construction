/**
 * COMPREHENSIVE TAKEOFF TEMPLATE
 * 
 * This template ensures all AI models check for every category and item type.
 * Models must verify each category exists in the plan, and if not, document why it's excluded.
 * 
 * Goal: COMPREHENSIVE coverage - each model finds different items, we aggregate ALL findings.
 */

export interface TakeoffTemplateCategory {
  category: string
  subcategories: TakeoffTemplateSubcategory[]
  mandatory: boolean // If false, models can exclude if all agree it doesn't apply
  notes: string
}

export interface TakeoffTemplateSubcategory {
  name: string
  items: string[] // Example item names/descriptions
  units: string[] // Common units (LF, SF, CF, CY, EA, etc.)
  notes: string
}

export const TAKEOFF_TEMPLATE: TakeoffTemplateCategory[] = [
  {
    category: 'structural',
    mandatory: true,
    notes: 'Foundation, framing, slabs, structural steel',
    subcategories: [
      {
        name: 'Earthwork',
        items: [
          'Excavation to subgrade',
          'Over-excavation & recompaction',
          'Subgrade proof-roll & compaction',
          'Imported structural fill',
          'Export/haul of unsuitable material',
          'Backfill & compaction',
          'Cut/fill balance'
        ],
        units: ['CY', 'SF', 'CF'],
        notes: 'Check foundation plans and site plans'
      },
      {
        name: 'Foundation',
        items: [
          'Concrete footings (continuous & pads)',
          'Foundation walls',
          'Foundation formwork',
          'Foundation rebar',
          'Anchor bolts',
          'Termite pretreatment',
          'Foundation waterproofing/damp-proofing',
          'Perimeter drainage',
          'Foundation insulation'
        ],
        units: ['CY', 'SF', 'LF', 'LB', 'EA'],
        notes: 'Check foundation layout plans, details, and sections'
      },
      {
        name: 'Slab',
        items: [
          'Slab on grade concrete',
          'Vapor barrier',
          'WWF or fiber reinforcement',
          'Slab edge insulation',
          'Sawcut contraction joints',
          'Dowels and keyways at joints',
          'Slab thickening/reinforcement at loads'
        ],
        units: ['CY', 'SF', 'LF', 'LB'],
        notes: 'Check floor plans and slab details'
      },
      {
        name: 'Framing',
        items: [
          'Structural steel columns/beams',
          'Wood framing (studs, plates, headers)',
          'Cold-formed metal framing',
          'Trusses',
          'Rafters & joists',
          'Girts & purlins',
          'Blocking & bridging',
          'Metal deck',
          'Parapet framing',
          'Fasteners & connectors'
        ],
        units: ['TON', 'LF', 'SF', 'EA', 'LB'],
        notes: 'Check framing plans, sections, and details. Include all structural elements.'
      },
      {
        name: 'Reinforcement',
        items: [
          'Rebar (foundation, slab, walls)',
          'Post-tensioning',
          'Welded wire fabric',
          'Steel fibers',
          'Stirrups & ties'
        ],
        units: ['LB', 'SF', 'LF', 'EA'],
        notes: 'Check structural details and rebar schedules'
      }
    ]
  },
  {
    category: 'exterior',
    mandatory: true,
    notes: 'Roofing, cladding, openings, waterproofing, sitework',
    subcategories: [
      {
        name: 'Roofing',
        items: [
          'Roof membrane (TPO, EPDM, modified bitumen)',
          'Roof insulation',
          'Cover board',
          'Metal roofing (standing seam, corrugated)',
          'Roof edge metal & flashing',
          'Roof drains & scuppers',
          'Gutters & downspouts',
          'Roof hatches & access',
          'Roof walkway pads',
          'Parapet caps'
        ],
        units: ['SF', 'SQ', 'LF', 'EA'],
        notes: 'Check roof plans and details'
      },
      {
        name: 'Waterproofing',
        items: [
          'Perimeter drainage mat',
          'Damp-proofing',
          'Foundation waterproofing',
          'Below-grade waterproofing',
          'Flashing & sealants'
        ],
        units: ['LF', 'SF'],
        notes: 'Check foundation and wall details'
      },
      {
        name: 'Cladding',
        items: [
          'Metal wall panels',
          'Brick/stone/masonry',
          'Stucco/EIFS',
          'Siding (fiber cement, vinyl, wood)',
          'Trim & flashings',
          'Corner details',
          'Closure strips'
        ],
        units: ['SF', 'LF'],
        notes: 'Check elevations and wall sections'
      },
      {
        name: 'Openings',
        items: [
          'Windows',
          'Doors (entry, overhead, sliding)',
          'Storefront & glazing',
          'Door hardware',
          'Window frames & hardware',
          'Weather seals',
          'Overhead door operators'
        ],
        units: ['EA', 'SF', 'LF'],
        notes: 'Check door/window schedules and elevations'
      },
      {
        name: 'Sealants',
        items: [
          'Exterior sealants',
          'Backer rod',
          'Joint sealants'
        ],
        units: ['LF'],
        notes: 'Check details and specifications'
      }
    ]
  },
  {
    category: 'interior',
    mandatory: true,
    notes: 'Partitions, ceilings, walls, insulation',
    subcategories: [
      {
        name: 'Walls',
        items: [
          'Interior wall framing (wood/metal studs)',
          'Gypsum board (GWB)',
          'Acoustic insulation',
          'Sound batt insulation',
          'Fire-rated assemblies',
          'Vapor barriers'
        ],
        units: ['LF', 'SF', 'EA'],
        notes: 'Check floor plans and wall details'
      },
      {
        name: 'Ceilings',
        items: [
          'Acoustic ceiling tile',
          'Ceiling grid',
          'Suspended ceiling',
          'Gypsum board ceilings',
          'Access panels'
        ],
        units: ['SF', 'EA'],
        notes: 'Check reflected ceiling plans'
      },
      {
        name: 'Insulation',
        items: [
          'Wall insulation (batt, spray, rigid)',
          'Ceiling insulation',
          'Floor insulation',
          'Thermal barriers'
        ],
        units: ['SF', 'CF'],
        notes: 'Check sections and specifications'
      }
    ]
  },
  {
    category: 'mep',
    mandatory: true,
    notes: 'Mechanical, Electrical, Plumbing systems',
    subcategories: [
      {
        name: 'Plumbing',
        items: [
          'Plumbing fixtures (toilets, sinks, faucets)',
          'Water heaters',
          'Backflow preventers',
          'Water service & distribution',
          'Drainage & waste systems',
          'Vent systems',
          'Grease interceptors',
          'Roof drains & storm',
          'Grab bars & accessories',
          'Toilet partitions'
        ],
        units: ['EA', 'LF'],
        notes: 'Check plumbing plans and fixture schedules'
      },
      {
        name: 'HVAC',
        items: [
          'HVAC equipment (units, furnaces, boilers)',
          'Ductwork & fittings',
          'Vents & grilles',
          'Thermostats & controls',
          'Unit heaters',
          'Exhaust fans',
          'Make-up air units',
          'Refrigeration systems'
        ],
        units: ['EA', 'LF', 'SF'],
        notes: 'Check mechanical plans and schedules'
      },
      {
        name: 'Electrical',
        items: [
          'Electrical panels & gear',
          'Lighting fixtures (interior & exterior)',
          'Exit signs',
          'Receptacles & switches',
          'Branch conduit & wire',
          'Occupancy sensors & controls',
          'Data/low voltage rough-in',
          'Security systems',
          'Fire alarm systems',
          'Emergency lighting',
          'Site lighting'
        ],
        units: ['EA', 'LF', 'LS'],
        notes: 'Check electrical plans, schedules, and details'
      }
    ]
  },
  {
    category: 'finishes',
    mandatory: true,
    notes: 'Flooring, paint, trim, millwork',
    subcategories: [
      {
        name: 'Flooring',
        items: [
          'Floor covering (carpet, LVT, tile, concrete)',
          'Base (rubber, vinyl, wood)',
          'Floor preparation',
          'Adhesives & underlayment'
        ],
        units: ['SF', 'LF'],
        notes: 'Check floor plans and finish schedules'
      },
      {
        name: 'Paint',
        items: [
          'Interior paint (walls, ceilings, trim)',
          'Exterior paint',
          'Primers',
          'Specialty coatings'
        ],
        units: ['SF', 'LF'],
        notes: 'Check specifications and finish schedules'
      },
      {
        name: 'Trim',
        items: [
          'Base molding',
          'Crown molding',
          'Casing & trim',
          'Corner guards'
        ],
        units: ['LF'],
        notes: 'Check details and specifications'
      },
      {
        name: 'Floor/Wall',
        items: [
          'Ceramic/porcelain tile',
          'Natural stone',
          'Thinset & grout',
          'Waterproof membranes'
        ],
        units: ['SF'],
        notes: 'Check tile layouts and details'
      },
      {
        name: 'Accessories',
        items: [
          'Toilet accessories',
          'Mirrors',
          'Shelving',
          'Signage'
        ],
        units: ['EA', 'SF'],
        notes: 'Check finish schedules'
      }
    ]
  },
  {
    category: 'other',
    mandatory: false,
    notes: 'Sitework, life safety, miscellaneous',
    subcategories: [
      {
        name: 'Sitework',
        items: [
          'Asphalt paving',
          'Concrete paving & sidewalks',
          'Aggregate base course',
          'Curb & gutter',
          'ADA ramps',
          'Parking lot striping',
          'Site signage',
          'Wheel stops',
          'Bollards',
          'Fencing',
          'Gates',
          'Landscaping',
          'Irrigation'
        ],
        units: ['SF', 'LF', 'EA', 'CY', 'LS'],
        notes: 'Check site/civil plans'
      },
      {
        name: 'Life Safety',
        items: [
          'Fire alarm systems',
          'Fire extinguishers',
          'Egress signage',
          'Emergency lighting',
          'Smoke detectors'
        ],
        units: ['EA', 'LS'],
        notes: 'Check life safety plans and code requirements'
      }
    ]
  }
]

/**
 * Generate template instructions for AI prompts
 * Keep concise to avoid token limits and JSON truncation
 */
export function generateTemplateInstructions(): string {
  return `

TAKEOFF TEMPLATE CHECKLIST - Check ALL categories below:

MANDATORY (must verify all exist or document why excluded):
${TAKEOFF_TEMPLATE.filter(c => c.mandatory).map(cat => 
  `${cat.category.toUpperCase()}: ${cat.subcategories.map(sc => sc.name).join(', ')}`
).join(' | ')}

OPTIONAL (can exclude if all models agree):
${TAKEOFF_TEMPLATE.filter(c => !c.mandatory).map(cat => 
  `${cat.category.toUpperCase()}: ${cat.subcategories.map(sc => sc.name).join(', ')}`
).join(' | ')}

KEY CATEGORIES & SUB-CATEGORIES:
${TAKEOFF_TEMPLATE.map(cat => 
  `${cat.category.toUpperCase()} -> ${cat.subcategories.map(sc => 
    `${sc.name} (${sc.units.join('/')})`
  ).join(', ')}`
).join('\n')}

TEMPLATE RULES:
1. Check EVERY category above - if missing, note why in quality_analysis.completeness
2. Extract items from ALL applicable subcategories
3. Use proper units: ${Array.from(new Set(TAKEOFF_TEMPLATE.flatMap(c => c.subcategories.flatMap(sc => sc.units)))).join(', ')}
4. Be specific: "2x6 Exterior Wall Framing" not just "framing"
5. Include quantities calculated from visible dimensions
6. Minimum items: 5 pages=20-50, 10 pages=40-100, 19 pages=80-200

If you return fewer items than expected, you're missing categories!
`
}
