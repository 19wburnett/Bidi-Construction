import {
  DoorOpen,
  Square,
  Plug,
  Lightbulb,
  Power,
  ToggleLeft,
  Droplet,
  Waves,
  Wind,
  Flame,
  Thermometer,
  AlertCircle,
  Building2,
  Hammer,
  Home,
  Sofa,
  Refrigerator,
  Microwave,
  Utensils,
  Wrench,
  Fence,
  TreePine,
  Car,
  Circle,
  type LucideIcon
} from 'lucide-react'

export interface ItemTypeDefinition {
  id: string
  label: string
  category: 'structural' | 'exterior' | 'interior' | 'mep' | 'finishes' | 'other'
  icon: LucideIcon
  color: string
}

// Comprehensive item type definitions organized by category
export const ITEM_TYPES: ItemTypeDefinition[] = [
  // Doors
  { id: 'door_interior', label: 'Interior Door', category: 'interior', icon: DoorOpen, color: '#8b5cf6' },
  { id: 'door_exterior', label: 'Exterior Door', category: 'exterior', icon: DoorOpen, color: '#6366f1' },
  { id: 'door_sliding', label: 'Sliding Door', category: 'exterior', icon: DoorOpen, color: '#6366f1' },
  { id: 'door_double', label: 'Double Door', category: 'exterior', icon: DoorOpen, color: '#6366f1' },
  { id: 'door_garage', label: 'Garage Door', category: 'exterior', icon: DoorOpen, color: '#6366f1' },
  { id: 'door_pocket', label: 'Pocket Door', category: 'interior', icon: DoorOpen, color: '#8b5cf6' },
  { id: 'door_bifold', label: 'Bifold Door', category: 'interior', icon: DoorOpen, color: '#8b5cf6' },

  // Windows
  { id: 'window_standard', label: 'Standard Window', category: 'exterior', icon: Square, color: '#3b82f6' },
  { id: 'window_bay', label: 'Bay Window', category: 'exterior', icon: Square, color: '#3b82f6' },
  { id: 'window_casement', label: 'Casement Window', category: 'exterior', icon: Square, color: '#3b82f6' },
  { id: 'window_double_hung', label: 'Double-Hung Window', category: 'exterior', icon: Square, color: '#3b82f6' },
  { id: 'window_awning', label: 'Awning Window', category: 'exterior', icon: Square, color: '#3b82f6' },

  // Electrical MEP
  { id: 'outlet_standard', label: 'Standard Outlet', category: 'mep', icon: Plug, color: '#f59e0b' },
  { id: 'outlet_gfci', label: 'GFCI Outlet', category: 'mep', icon: Plug, color: '#f59e0b' },
  { id: 'outlet_usb', label: 'USB Outlet', category: 'mep', icon: Plug, color: '#f59e0b' },
  { id: 'outlet_220v', label: '220V Outlet', category: 'mep', icon: Plug, color: '#f59e0b' },
  { id: 'switch_single', label: 'Single-Pole Switch', category: 'mep', icon: ToggleLeft, color: '#f59e0b' },
  { id: 'switch_3way', label: '3-Way Switch', category: 'mep', icon: ToggleLeft, color: '#f59e0b' },
  { id: 'switch_dimmer', label: 'Dimmer Switch', category: 'mep', icon: ToggleLeft, color: '#f59e0b' },
  { id: 'light_recessed', label: 'Recessed Light', category: 'mep', icon: Lightbulb, color: '#f59e0b' },
  { id: 'light_pendant', label: 'Pendant Light', category: 'mep', icon: Lightbulb, color: '#f59e0b' },
  { id: 'light_sconce', label: 'Sconce', category: 'mep', icon: Lightbulb, color: '#f59e0b' },
  { id: 'light_track', label: 'Track Light', category: 'mep', icon: Lightbulb, color: '#f59e0b' },
  { id: 'light_chandelier', label: 'Chandelier', category: 'mep', icon: Lightbulb, color: '#f59e0b' },
  { id: 'panel_electrical', label: 'Electrical Panel', category: 'mep', icon: Power, color: '#f59e0b' },
  { id: 'panel_sub', label: 'Sub-Panel', category: 'mep', icon: Power, color: '#f59e0b' },
  { id: 'conduit', label: 'Conduit Run', category: 'mep', icon: Circle, color: '#f59e0b' },
  { id: 'light_emergency', label: 'Emergency Light', category: 'mep', icon: AlertCircle, color: '#f59e0b' },

  // Plumbing MEP
  { id: 'fixture_sink', label: 'Sink', category: 'mep', icon: Droplet, color: '#06b6d4' },
  { id: 'fixture_toilet', label: 'Toilet', category: 'mep', icon: Droplet, color: '#06b6d4' },
  { id: 'fixture_shower', label: 'Shower', category: 'mep', icon: Waves, color: '#06b6d4' },
  { id: 'fixture_bathtub', label: 'Bathtub', category: 'mep', icon: Droplet, color: '#06b6d4' },
  { id: 'fixture_urinal', label: 'Urinal', category: 'mep', icon: Droplet, color: '#06b6d4' },
  { id: 'faucet_kitchen', label: 'Kitchen Faucet', category: 'mep', icon: Droplet, color: '#06b6d4' },
  { id: 'faucet_bathroom', label: 'Bathroom Faucet', category: 'mep', icon: Droplet, color: '#06b6d4' },
  { id: 'valve_shutoff', label: 'Shut-Off Valve', category: 'mep', icon: Circle, color: '#06b6d4' },
  { id: 'valve_mixing', label: 'Mixing Valve', category: 'mep', icon: Circle, color: '#06b6d4' },
  { id: 'drain', label: 'Drain', category: 'mep', icon: Circle, color: '#06b6d4' },
  { id: 'cleanout', label: 'Cleanout', category: 'mep', icon: Circle, color: '#06b6d4' },
  { id: 'water_heater', label: 'Water Heater', category: 'mep', icon: Flame, color: '#06b6d4' },
  { id: 'water_softener', label: 'Water Softener', category: 'mep', icon: Droplet, color: '#06b6d4' },

  // Mechanical/HVAC MEP
  { id: 'vent_supply', label: 'Supply Vent', category: 'mep', icon: Wind, color: '#10b981' },
  { id: 'vent_return', label: 'Return Vent', category: 'mep', icon: Wind, color: '#10b981' },
  { id: 'vent_exhaust', label: 'Exhaust Vent', category: 'mep', icon: Wind, color: '#10b981' },
  { id: 'ductwork', label: 'Ductwork', category: 'mep', icon: Circle, color: '#10b981' },
  { id: 'hvac_furnace', label: 'Furnace', category: 'mep', icon: Flame, color: '#10b981' },
  { id: 'hvac_ac', label: 'Air Conditioner', category: 'mep', icon: Wind, color: '#10b981' },
  { id: 'hvac_heat_pump', label: 'Heat Pump', category: 'mep', icon: Wind, color: '#10b981' },
  { id: 'thermostat', label: 'Thermostat', category: 'mep', icon: Thermometer, color: '#10b981' },
  { id: 'diffuser', label: 'Diffuser', category: 'mep', icon: Wind, color: '#10b981' },
  { id: 'grille', label: 'Grille', category: 'mep', icon: Wind, color: '#10b981' },

  // Fire Protection
  { id: 'sprinkler', label: 'Sprinkler', category: 'mep', icon: Droplet, color: '#ef4444' },
  { id: 'smoke_detector', label: 'Smoke Detector', category: 'mep', icon: AlertCircle, color: '#ef4444' },
  { id: 'fire_alarm', label: 'Fire Alarm', category: 'mep', icon: AlertCircle, color: '#ef4444' },
  { id: 'co_detector', label: 'CO Detector', category: 'mep', icon: AlertCircle, color: '#ef4444' },
  { id: 'fire_exit', label: 'Fire Exit', category: 'mep', icon: DoorOpen, color: '#ef4444' },

  // Structural
  { id: 'footing', label: 'Footing', category: 'structural', icon: Building2, color: '#78716c' },
  { id: 'foundation_wall', label: 'Foundation Wall', category: 'structural', icon: Building2, color: '#78716c' },
  { id: 'pier', label: 'Pier', category: 'structural', icon: Building2, color: '#78716c' },
  { id: 'column', label: 'Column', category: 'structural', icon: Building2, color: '#78716c' },
  { id: 'beam', label: 'Beam', category: 'structural', icon: Building2, color: '#78716c' },
  { id: 'stud', label: 'Stud', category: 'structural', icon: Hammer, color: '#78716c' },
  { id: 'joist', label: 'Joist', category: 'structural', icon: Hammer, color: '#78716c' },
  { id: 'rafter', label: 'Rafter', category: 'structural', icon: Hammer, color: '#78716c' },
  { id: 'header', label: 'Header', category: 'structural', icon: Hammer, color: '#78716c' },
  { id: 'steel_beam', label: 'Structural Steel Beam', category: 'structural', icon: Building2, color: '#78716c' },
  { id: 'steel_column', label: 'Structural Steel Column', category: 'structural', icon: Building2, color: '#78716c' },

  // Exterior
  { id: 'roofing_shingle', label: 'Roofing Shingle', category: 'exterior', icon: Home, color: '#059669' },
  { id: 'roofing_flashing', label: 'Flashing', category: 'exterior', icon: Home, color: '#059669' },
  { id: 'roofing_vent', label: 'Roof Vent', category: 'exterior', icon: Home, color: '#059669' },
  { id: 'gutter', label: 'Gutter', category: 'exterior', icon: Circle, color: '#059669' },
  { id: 'downspout', label: 'Downspout', category: 'exterior', icon: Circle, color: '#059669' },
  { id: 'siding', label: 'Siding', category: 'exterior', icon: Home, color: '#059669' },
  { id: 'trim_fascia', label: 'Fascia', category: 'exterior', icon: Home, color: '#059669' },
  { id: 'trim_soffit', label: 'Soffit', category: 'exterior', icon: Home, color: '#059669' },
  { id: 'deck', label: 'Deck', category: 'exterior', icon: Home, color: '#059669' },
  { id: 'railing', label: 'Railing', category: 'exterior', icon: Circle, color: '#059669' },
  { id: 'stairs_exterior', label: 'Exterior Stairs', category: 'exterior', icon: Circle, color: '#059669' },

  // Interior
  { id: 'wall_interior', label: 'Interior Wall', category: 'interior', icon: Building2, color: '#8b5cf6' },
  { id: 'flooring_hardwood', label: 'Hardwood Flooring', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'flooring_tile', label: 'Tile Flooring', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'flooring_carpet', label: 'Carpet', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'flooring_lvt', label: 'LVT Flooring', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'ceiling_drywall', label: 'Drywall Ceiling', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'ceiling_suspended', label: 'Suspended Ceiling', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'ceiling_acoustic', label: 'Acoustic Ceiling', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'trim_baseboard', label: 'Baseboard', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'trim_casing', label: 'Casing', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'trim_crown', label: 'Crown Molding', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'stairs_interior', label: 'Interior Stairs', category: 'interior', icon: Circle, color: '#8b5cf6' },
  { id: 'cabinet_kitchen', label: 'Kitchen Cabinet', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'cabinet_bathroom', label: 'Bathroom Vanity', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'cabinet_builtin', label: 'Built-in Cabinet', category: 'interior', icon: Home, color: '#8b5cf6' },
  { id: 'countertop', label: 'Countertop', category: 'interior', icon: Home, color: '#8b5cf6' },

  // Appliances
  { id: 'appliance_range', label: 'Range', category: 'finishes', icon: Utensils, color: '#ec4899' },
  { id: 'appliance_refrigerator', label: 'Refrigerator', category: 'finishes', icon: Refrigerator, color: '#ec4899' },
  { id: 'appliance_dishwasher', label: 'Dishwasher', category: 'finishes', icon: Waves, color: '#ec4899' },
  { id: 'appliance_microwave', label: 'Microwave', category: 'finishes', icon: Microwave, color: '#ec4899' },
  { id: 'appliance_washer', label: 'Washer', category: 'finishes', icon: Waves, color: '#ec4899' },
  { id: 'appliance_dryer', label: 'Dryer', category: 'finishes', icon: Waves, color: '#ec4899' },
  { id: 'appliance_disposal', label: 'Disposal', category: 'finishes', icon: Circle, color: '#ec4899' },

  // Hardware & Accessories
  { id: 'hardware_door', label: 'Door Hardware', category: 'finishes', icon: Wrench, color: '#ec4899' },
  { id: 'mirror', label: 'Mirror', category: 'finishes', icon: Circle, color: '#ec4899' },
  { id: 'medicine_cabinet', label: 'Medicine Cabinet', category: 'finishes', icon: Home, color: '#ec4899' },
  { id: 'towel_bar', label: 'Towel Bar', category: 'finishes', icon: Circle, color: '#ec4899' },
  { id: 'tp_holder', label: 'Toilet Paper Holder', category: 'finishes', icon: Circle, color: '#ec4899' },

  // Site Work
  { id: 'parking', label: 'Parking Space', category: 'other', icon: Car, color: '#6b7280' },
  { id: 'landscaping', label: 'Landscaping', category: 'other', icon: TreePine, color: '#6b7280' },
  { id: 'utilities', label: 'Utilities', category: 'other', icon: Circle, color: '#6b7280' },
  { id: 'fencing', label: 'Fencing', category: 'other', icon: Fence, color: '#6b7280' },
  { id: 'walkway', label: 'Walkway', category: 'other', icon: Circle, color: '#6b7280' },
  { id: 'driveway', label: 'Driveway', category: 'other', icon: Circle, color: '#6b7280' },
  { id: 'patio', label: 'Patio', category: 'other', icon: Home, color: '#6b7280' },
]

// Helper function to get item type by ID
export function getItemTypeById(id: string): ItemTypeDefinition | undefined {
  return ITEM_TYPES.find(type => type.id === id)
}

// Helper function to get item types by category
export function getItemTypesByCategory(category: ItemTypeDefinition['category']): ItemTypeDefinition[] {
  return ITEM_TYPES.filter(type => type.category === category)
}

// Helper function to search item types
export function searchItemTypes(query: string): ItemTypeDefinition[] {
  const lowerQuery = query.toLowerCase()
  return ITEM_TYPES.filter(type => 
    type.label.toLowerCase().includes(lowerQuery) ||
    type.id.toLowerCase().includes(lowerQuery)
  )
}

// Category labels for display
export const CATEGORY_LABELS: Record<ItemTypeDefinition['category'], string> = {
  structural: 'Structural',
  exterior: 'Exterior',
  interior: 'Interior',
  mep: 'MEP',
  finishes: 'Finishes',
  other: 'Other'
}

