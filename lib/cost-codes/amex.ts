// AMEX Cost Codes
// Provided by user

export interface CostCode {
  division: string
  code: string
  description: string
  fullCode: string
}

export const COST_CODES: CostCode[] = [
  // 01 - General Conditions
  { division: '01', code: '000', description: 'General Conditions', fullCode: '01 000' },
  { division: '01', code: '010', description: 'VP Labor', fullCode: '01 010' },
  { division: '01', code: '011', description: 'VP Auto', fullCode: '01 011' },
  { division: '01', code: '012', description: 'VP Travel', fullCode: '01 012' },
  { division: '01', code: '013', description: 'VP Other', fullCode: '01 013' },
  { division: '01', code: '020', description: 'General Super Labor', fullCode: '01 020' },
  { division: '01', code: '021', description: 'General Super Auto', fullCode: '01 021' },
  { division: '01', code: '023', description: 'General Super Travel', fullCode: '01 023' },
  { division: '01', code: '024', description: 'General Super Other', fullCode: '01 024' },
  { division: '01', code: '030', description: 'PM Labor', fullCode: '01 030' },
  { division: '01', code: '031', description: 'PM Auto', fullCode: '01 031' },
  { division: '01', code: '032', description: 'PM Travel', fullCode: '01 032' },
  { division: '01', code: '033', description: 'PM Other', fullCode: '01 033' },
  { division: '01', code: '040', description: 'Super Labor', fullCode: '01 040' },
  { division: '01', code: '041', description: 'Super Auto', fullCode: '01 041' },
  { division: '01', code: '042', description: 'Super Travel', fullCode: '01 042' },
  { division: '01', code: '043', description: 'Super Other', fullCode: '01 043' },
  { division: '01', code: '050', description: 'A Super Labor', fullCode: '01 050' },
  { division: '01', code: '051', description: 'A Super Auto', fullCode: '01 051' },
  { division: '01', code: '052', description: 'A Super Travel', fullCode: '01 052' },
  { division: '01', code: '053', description: 'A Super Other', fullCode: '01 053' },
  { division: '01', code: '060', description: 'Project Engineer Labor', fullCode: '01 060' },
  { division: '01', code: '061', description: 'Project Engineer Auto', fullCode: '01 061' },
  { division: '01', code: '062', description: 'Project Engineer Travel', fullCode: '01 062' },
  { division: '01', code: '063', description: 'Project Engineer Other', fullCode: '01 063' },
  { division: '01', code: '070', description: 'Admin Asst Labor', fullCode: '01 070' },
  { division: '01', code: '071', description: 'Admin Asst Auto', fullCode: '01 071' },
  { division: '01', code: '072', description: 'Admin Asst Travel', fullCode: '01 072' },
  { division: '01', code: '073', description: 'Admin Asst Other', fullCode: '01 073' },
  { division: '01', code: '080', description: 'Project Coordinator Labor', fullCode: '01 080' },
  { division: '01', code: '081', description: 'Project Coordinator Auto', fullCode: '01 081' },
  { division: '01', code: '082', description: 'Project Coordinator Travel', fullCode: '01 082' },
  { division: '01', code: '083', description: 'Project Coordinator Other', fullCode: '01 083' },
  { division: '01', code: '090', description: 'Project Estimator Labor', fullCode: '01 090' },
  { division: '01', code: '091', description: 'Project Estimator Auto', fullCode: '01 091' },
  { division: '01', code: '092', description: 'Project Estimator Travel', fullCode: '01 092' },
  { division: '01', code: '093', description: 'Project Estimator Other', fullCode: '01 093' },
  { division: '01', code: '101', description: 'Temporary Housing', fullCode: '01 101' },
  { division: '01', code: '102', description: 'Fuel', fullCode: '01 102' },
  { division: '01', code: '103', description: 'Office Trailers', fullCode: '01 103' },
  { division: '01', code: '104', description: 'Office Supplies', fullCode: '01 104' },
  { division: '01', code: '105', description: 'Storage Sheds & Bins', fullCode: '01 105' },
  { division: '01', code: '106', description: 'Phone/Fax/Computer Lines', fullCode: '01 106' },
  { division: '01', code: '107', description: 'Temp Power-Use /Meter', fullCode: '01 107' },
  { division: '01', code: '108', description: 'Temp Power Distribution', fullCode: '01 108' },
  { division: '01', code: '109', description: 'Water-Consumption/Meter', fullCode: '01 109' },
  { division: '01', code: '110', description: 'Water-Distribution', fullCode: '01 110' },
  { division: '01', code: '111', description: 'Drinking Water', fullCode: '01 111' },
  { division: '01', code: '112', description: 'Temp Sanitary Facilities', fullCode: '01 112' },
  { division: '01', code: '113', description: 'Traffic Barricades & Fences', fullCode: '01 113' },
  { division: '01', code: '114', description: 'Onsite Computer', fullCode: '01 114' },
  { division: '01', code: '115', description: 'Onsite Fax/Copy Machines', fullCode: '01 115' },
  { division: '01', code: '118', description: 'Trash Contain & Dump Fees', fullCode: '01 118' },
  { division: '01', code: '119', description: 'Trash Chute', fullCode: '01 119' },
  { division: '01', code: '120', description: 'Move-In & Move Out', fullCode: '01 120' },
  { division: '01', code: '121', description: 'Misc. Drayage & Deliveries', fullCode: '01 121' },
  { division: '01', code: '122', description: 'Project Scheduling', fullCode: '01 122' },
  { division: '01', code: '123', description: 'Postage & Couriers', fullCode: '01 123' },
  { division: '01', code: '124', description: 'Printing & Blue Printing', fullCode: '01 124' },
  { division: '01', code: '125', description: 'Progress Photographs', fullCode: '01 125' },
  { division: '01', code: '126', description: 'As-Built Record Drawings', fullCode: '01 126' },
  { division: '01', code: '127', description: 'Construction Signs', fullCode: '01 127' },
  { division: '01', code: '128', description: 'Costs Prior to Contract', fullCode: '01 128' },
  { division: '01', code: '131', description: 'General Safety', fullCode: '01 131' },
  { division: '01', code: '133', description: 'Misc. Equipment & Tools', fullCode: '01 133' },
  { division: '01', code: '134', description: 'Quality Assur/Peer Review', fullCode: '01 134' },
  { division: '01', code: '135', description: 'Interim Project Clean-Up', fullCode: '01 135' },
  { division: '01', code: '136', description: 'Dewatering of misc Water', fullCode: '01 136' },
  { division: '01', code: '137', description: 'Temp Weather Protection', fullCode: '01 137' },
  { division: '01', code: '138', description: 'Watchmen/Security', fullCode: '01 138' },
  { division: '01', code: '139', description: 'Off Site Staging/Work Area', fullCode: '01 139' },
  { division: '01', code: '140', description: 'Marketing, RFP, RFQ Costs', fullCode: '01 140' },
  { division: '01', code: '200', description: 'BIM Coordination', fullCode: '01 200' },
  { division: '01', code: '510', description: 'Crane Rental and Operator', fullCode: '01 510' },
  { division: '01', code: '520', description: 'Dual Cage Rental', fullCode: '01 520' },
  { division: '01', code: '530', description: 'Hoist Operator', fullCode: '01 530' },
  { division: '01', code: '540', description: 'Temp Trash Chutes', fullCode: '01 540' },
  { division: '01', code: '550', description: 'Jobsite Laborer', fullCode: '01 550' },
  
  // 02 - Site Construction
  { division: '02', code: '050', description: 'Profesional Survey Services', fullCode: '02 050' },
  { division: '02', code: '100', description: 'Demolition', fullCode: '02 100' },
  { division: '02', code: '200', description: 'Earthwork', fullCode: '02 200' },
  { division: '02', code: '210', description: 'Subsurface Investigation', fullCode: '02 210' },
  { division: '02', code: '220', description: 'Site Clean Up', fullCode: '02 220' },
  { division: '02', code: '240', description: 'Dewatering', fullCode: '02 240' },
  { division: '02', code: '250', description: 'Shoring and Pinning', fullCode: '02 250' },
  { division: '02', code: '300', description: 'Grading', fullCode: '02 300' },
  { division: '02', code: '360', description: 'Soil Treatment', fullCode: '02 360' },
  { division: '02', code: '370', description: 'Erosion & Sedimentation Control', fullCode: '02 370' },
  { division: '02', code: '400', description: 'Utility Services', fullCode: '02 400' },
  { division: '02', code: '405', description: 'Site Utilities', fullCode: '02 405' },
  { division: '02', code: '408', description: 'Site Electrical', fullCode: '02 408' },
  { division: '02', code: '410', description: 'Site Gas', fullCode: '02 410' },
  { division: '02', code: '440', description: 'Chain Link Fence', fullCode: '02 440' },
  { division: '02', code: '450', description: 'Wood Fencing', fullCode: '02 450' },
  { division: '02', code: '460', description: 'Other Fencing', fullCode: '02 460' },
  { division: '02', code: '470', description: 'CMU Fence', fullCode: '02 470' },
  { division: '02', code: '480', description: 'Foundation Walls', fullCode: '02 480' },
  { division: '02', code: '495', description: 'Instrumentation & Monitoring', fullCode: '02 495' },
  { division: '02', code: '500', description: 'A/C Paving', fullCode: '02 500' },
  { division: '02', code: '510', description: 'Off Site Paving', fullCode: '02 510' },
  { division: '02', code: '515', description: 'Unit Pavers', fullCode: '02 515' },
  { division: '02', code: '520', description: 'Paving Specialties', fullCode: '02 520' },
  { division: '02', code: '530', description: 'Site Signage', fullCode: '02 530' },
  { division: '02', code: '550', description: 'Site Signage', fullCode: '02 550' },
  { division: '02', code: '580', description: 'Site Concrete', fullCode: '02 580' },
  { division: '02', code: '600', description: 'Stripping, Guard Rails & Bollards', fullCode: '02 600' },
  { division: '02', code: '610', description: 'Bollards', fullCode: '02 610' },
  { division: '02', code: '630', description: 'Ponds & Reservoirs', fullCode: '02 630' },
  { division: '02', code: '650', description: 'Foundation Drains', fullCode: '02 650' },
  { division: '02', code: '670', description: 'Constructed Wetlands-Bio-Retention', fullCode: '02 670' },
  { division: '02', code: '740', description: 'Offsite Utilities', fullCode: '02 740' },
  { division: '02', code: '760', description: 'Seal Coat', fullCode: '02 760' },
  { division: '02', code: '790', description: 'Athletic & Recreational Surfaces', fullCode: '02 790' },
  { division: '02', code: '795', description: 'Playfield Equipment & Structures', fullCode: '02 795' },
  { division: '02', code: '800', description: 'Site Work', fullCode: '02 800' },
  { division: '02', code: '815', description: 'Fountains', fullCode: '02 815' },
  { division: '02', code: '820', description: 'Gate Operators', fullCode: '02 820' },
  { division: '02', code: '830', description: 'Site Furnishings', fullCode: '02 830' },
  { division: '02', code: '840', description: 'Walls & Gates', fullCode: '02 840' },
  { division: '02', code: '880', description: 'Fence Screening', fullCode: '02 880' },
  { division: '02', code: '895', description: 'Monuments & Markers', fullCode: '02 895' },
  { division: '02', code: '900', description: 'Planting & Irrigation', fullCode: '02 900' },
  
  // 03 - Concrete
  { division: '03', code: '050', description: 'Masic Concrete Materials & Methods', fullCode: '03 050' },
  { division: '03', code: '100', description: 'Concrete Forms & Accessories', fullCode: '03 100' },
  { division: '03', code: '120', description: 'Architectual PreCast Concrete', fullCode: '03 120' },
  { division: '03', code: '200', description: 'Concrete Reinforcement', fullCode: '03 200' },
  { division: '03', code: '300', description: 'Cast In Place Concrete', fullCode: '03 300' },
  { division: '03', code: '360', description: 'Concrete Finishes', fullCode: '03 360' },
  { division: '03', code: '400', description: 'Precast Concrete', fullCode: '03 400' },
  { division: '03', code: '470', description: 'Tilt Up Precast Concrete', fullCode: '03 470' },
  { division: '03', code: '500', description: 'Cementitious Decks & Underlayment', fullCode: '03 500' },
  { division: '03', code: '600', description: 'Grouts', fullCode: '03 600' },
  { division: '03', code: '900', description: 'Concrete Restoration & Cleaning', fullCode: '03 900' },

  // 04 - Masonry
  { division: '04', code: '000', description: 'Masonry', fullCode: '04 000' },
  { division: '04', code: '400', description: 'Stone Veneer', fullCode: '04 400' },
  { division: '04', code: '900', description: 'Masonry Restoration & Cleaning', fullCode: '04 900' },

  // 05 - Metals
  { division: '05', code: '100', description: 'Structural Metals', fullCode: '05 100' },
  { division: '05', code: '200', description: 'Metal Joist', fullCode: '05 200' },
  { division: '05', code: '300', description: 'Metal Deck', fullCode: '05 300' },
  { division: '05', code: '400', description: 'Prefabricated Metal Buildings', fullCode: '05 400' },
  { division: '05', code: '410', description: 'Prefabricated Metal Bldgs Installation Only', fullCode: '05 410' },
  { division: '05', code: '510', description: 'Metal Stairs/Ladder', fullCode: '05 510' },
  { division: '05', code: '580', description: 'Metal Canopies', fullCode: '05 580' },
  { division: '05', code: '700', description: 'Misc. Metal', fullCode: '05 700' },
  { division: '05', code: '800', description: 'Expansion Control', fullCode: '05 800' },
  { division: '05', code: '900', description: 'Metal Restoration & Cleaning', fullCode: '05 900' },

  // 06 - Wood & Plastics
  { division: '06', code: '050', description: 'Basic Materials & Methods', fullCode: '06 050' },
  { division: '06', code: '100', description: 'Rough Carpentry', fullCode: '06 100' },
  { division: '06', code: '160', description: 'Wood Sheathing', fullCode: '06 160' },
  { division: '06', code: '190', description: 'Wood Trusses', fullCode: '06 190' },
  { division: '06', code: '200', description: 'Finish Carpentry', fullCode: '06 200' },
  { division: '06', code: '260', description: 'Board Paneling', fullCode: '06 260' },
  { division: '06', code: '400', description: 'Architectural Woodwork', fullCode: '06 400' },
  { division: '06', code: '450', description: 'Standing & Running Trim', fullCode: '06 450' },
  { division: '06', code: '500', description: 'Structural Plastics', fullCode: '06 500' },
  { division: '06', code: '600', description: 'Plastic Fabricators', fullCode: '06 600' },
  { division: '06', code: '900', description: 'Wood & Plastic Restoration', fullCode: '06 900' },

  // 07 - Thermal & Moisture Protection
  { division: '07', code: '050', description: 'Basic Materials & Methods', fullCode: '07 050' },
  { division: '07', code: '100', description: 'Waterproofing', fullCode: '07 100' },
  { division: '07', code: '180', description: 'Traffic Coatings', fullCode: '07 180' },
  { division: '07', code: '185', description: 'Water Repellents', fullCode: '07 185' },
  { division: '07', code: '190', description: 'Vapor & Air Barrier', fullCode: '07 190' },
  { division: '07', code: '200', description: 'Thermal Protection', fullCode: '07 200' },
  { division: '07', code: '220', description: 'Roof & Deck Insulation', fullCode: '07 220' },
  { division: '07', code: '240', description: 'EIFS (Exterior Insulation & Finish Systems)', fullCode: '07 240' },
  { division: '07', code: '250', description: 'Fireproofing', fullCode: '07 250' },
  { division: '07', code: '300', description: 'Shingles, Roof Tiles, & Misc Roof Coverings', fullCode: '07 300' },
  { division: '07', code: '400', description: 'Roofing & Siding Panels', fullCode: '07 400' },
  { division: '07', code: '430', description: 'Composite Panels', fullCode: '07 430' },
  { division: '07', code: '500', description: 'Membrane Roofing', fullCode: '07 500' },
  { division: '07', code: '550', description: 'Metal Roofing', fullCode: '07 550' },
  { division: '07', code: '600', description: 'Flashing & Sheet Metal', fullCode: '07 600' },
  { division: '07', code: '700', description: 'Roof Specials/Assessors', fullCode: '07 700' },
  { division: '07', code: '800', description: 'Skylight', fullCode: '07 800' },
  { division: '07', code: '840', description: 'Firestopping', fullCode: '07 840' },
  { division: '07', code: '870', description: 'Smoke Containment Barriers', fullCode: '07 870' },
  { division: '07', code: '900', description: 'Joint Sealers/Caulking', fullCode: '07 900' },

  // 08 - Doors & Windows
  { division: '08', code: '050', description: 'Basic Materials & Methods', fullCode: '08 050' },
  { division: '08', code: '100', description: 'Doors, Frames, Hardware', fullCode: '08 100' },
  { division: '08', code: '160', description: 'Install Doors & Frames', fullCode: '08 160' },
  { division: '08', code: '190', description: 'Access Doors', fullCode: '08 190' },
  { division: '08', code: '200', description: 'Wood & Plastic Doors', fullCode: '08 200' },
  { division: '08', code: '250', description: 'Overhead/Rolling/Coil Doors', fullCode: '08 250' },
  { division: '08', code: '300', description: 'Specialty Doors', fullCode: '08 300' },
  { division: '08', code: '400', description: 'Storefront Doors', fullCode: '08 400' },
  { division: '08', code: '460', description: 'Automatic Entrance Doors', fullCode: '08 460' },
  { division: '08', code: '500', description: 'Windows', fullCode: '08 500' },
  { division: '08', code: '600', description: 'Skylights', fullCode: '08 600' },
  { division: '08', code: '700', description: 'Hardware', fullCode: '08 700' },
  { division: '08', code: '800', description: 'Glazing', fullCode: '08 800' },
  { division: '08', code: '900', description: 'Glazed Curtain wall', fullCode: '08 900' },

  // 09 - Finishes
  { division: '09', code: '050', description: 'Basic Materials & Methods', fullCode: '09 050' },
  { division: '09', code: '100', description: 'Metal Studs & Drywall', fullCode: '09 100' },
  { division: '09', code: '200', description: 'Lath & Plaster', fullCode: '09 200' },
  { division: '09', code: '250', description: 'Gypsum Board', fullCode: '09 250' },
  { division: '09', code: '300', description: 'Ceramic Tile', fullCode: '09 300' },
  { division: '09', code: '330', description: 'Quarry Tile', fullCode: '09 330' },
  { division: '09', code: '350', description: 'Stone Countertops', fullCode: '09 350' },
  { division: '09', code: '400', description: 'Terrazo', fullCode: '09 400' },
  { division: '09', code: '500', description: 'Ceilings', fullCode: '09 500' },
  { division: '09', code: '510', description: 'Acoustical Ceilings', fullCode: '09 510' },
  { division: '09', code: '600', description: 'Flooring', fullCode: '09 600' },
  { division: '09', code: '640', description: 'Wood Flooring', fullCode: '09 640' },
  { division: '09', code: '650', description: 'Resilient Flooring', fullCode: '09 650' },
  { division: '09', code: '655', description: 'Resilient Base', fullCode: '09 655' },
  { division: '09', code: '660', description: 'Concrete Sealer', fullCode: '09 660' },
  { division: '09', code: '670', description: 'Epoxy Flooring', fullCode: '09 670' },
  { division: '09', code: '680', description: 'Carpet', fullCode: '09 680' },
  { division: '09', code: '690', description: 'Flooring Restoration', fullCode: '09 690' },
  { division: '09', code: '700', description: 'Wall Finishes', fullCode: '09 700' },
  { division: '09', code: '800', description: 'Specialty Coatings', fullCode: '09 800' },
  { division: '09', code: '900', description: 'Painting', fullCode: '09 900' },
  { division: '09', code: '950', description: 'Wall Coatings', fullCode: '09 950' },
  { division: '09', code: '955', description: 'Acoustical Wall Panels', fullCode: '09 955' },
  { division: '09', code: '990', description: 'Paint Restoration', fullCode: '09 990' },

  // 10 - Specialties
  { division: '10', code: '100', description: 'Chalkboards &Tack Boards', fullCode: '10 100' },
  { division: '10', code: '150', description: 'Compartments & Cubicles', fullCode: '10 150' },
  { division: '10', code: '200', description: 'Louvers & Vents', fullCode: '10 200' },
  { division: '10', code: '210', description: 'Wall Louvers', fullCode: '10 210' },
  { division: '10', code: '240', description: 'Grilles & Screens', fullCode: '10 240' },
  { division: '10', code: '250', description: 'Service Walls', fullCode: '10 250' },
  { division: '10', code: '260', description: 'Wall & Corner Guards', fullCode: '10 260' },
  { division: '10', code: '270', description: 'Access Flooring', fullCode: '10 270' },
  { division: '10', code: '290', description: 'Pest Control', fullCode: '10 290' },
  { division: '10', code: '300', description: 'Fireplaces & Stoves', fullCode: '10 300' },
  { division: '10', code: '340', description: 'Manufactored Exterior Specialties', fullCode: '10 340' },
  { division: '10', code: '350', description: 'Flagpoles', fullCode: '10 350' },
  { division: '10', code: '400', description: 'Signage/Identifying Devices', fullCode: '10 400' },
  { division: '10', code: '430', description: 'Exterior Signage', fullCode: '10 430' },
  { division: '10', code: '450', description: 'Pedestrian Control Devices', fullCode: '10 450' },
  { division: '10', code: '500', description: 'Lockers', fullCode: '10 500' },
  { division: '10', code: '520', description: 'Fire Protection Specialties', fullCode: '10 520' },
  { division: '10', code: '530', description: 'Protective Covers', fullCode: '10 530' },
  { division: '10', code: '550', description: 'Postal Specialties', fullCode: '10 550' },
  { division: '10', code: '600', description: 'Partitions', fullCode: '10 600' },
  { division: '10', code: '610', description: 'Folding Gates', fullCode: '10 610' },
  { division: '10', code: '650', description: 'Operable Partitions', fullCode: '10 650' },
  { division: '10', code: '670', description: 'Storage Shelving', fullCode: '10 670' },
  { division: '10', code: '700', description: 'Exteriro Protection', fullCode: '10 700' },
  { division: '10', code: '705', description: 'Exterior Sun Control Devices', fullCode: '10 705' },
  { division: '10', code: '800', description: 'Toilet & Bath Accessories', fullCode: '10 800' },
  { division: '10', code: '900', description: 'Wardrobe & Closet Specialties', fullCode: '10 900' },

  // 11 - Equipment
  { division: '11', code: '010', description: 'Maintenance Equipment', fullCode: '11 010' },
  { division: '11', code: '020', description: 'Security & Vault Equipment', fullCode: '11 020' },
  { division: '11', code: '030', description: 'Teller & Service Equipment', fullCode: '11 030' },
  { division: '11', code: '040', description: 'Ecclesiastical Equipment', fullCode: '11 040' },
  { division: '11', code: '050', description: 'Library Equipment', fullCode: '11 050' },
  { division: '11', code: '060', description: 'Theater and Stage Equipment', fullCode: '11 060' },
  { division: '11', code: '070', description: 'Instrumental Equipment', fullCode: '11 070' },
  { division: '11', code: '080', description: 'Registration Equipment', fullCode: '11 080' },
  { division: '11', code: '090', description: 'Checkroom Equipment', fullCode: '11 090' },
  { division: '11', code: '100', description: 'Mercantile Equipment', fullCode: '11 100' },
  { division: '11', code: '110', description: 'Commercial Laundry & Dry Cleaning Equip', fullCode: '11 110' },
  { division: '11', code: '120', description: 'Vending Equipment', fullCode: '11 120' },
  { division: '11', code: '130', description: 'Audio-Visual Equipment', fullCode: '11 130' },
  { division: '11', code: '140', description: 'Vehicle Service Equipment', fullCode: '11 140' },
  { division: '11', code: '150', description: 'Parking Control Equipment', fullCode: '11 150' },
  { division: '11', code: '152', description: 'Golf Carts', fullCode: '11 152' },
  { division: '11', code: '154', description: 'Gate Controls', fullCode: '11 154' },
  { division: '11', code: '156', description: 'Vehicle Detailing Equipment', fullCode: '11 156' },
  { division: '11', code: '160', description: 'Loading Dock Equipment', fullCode: '11 160' },
  { division: '11', code: '170', description: 'Waste Handling Equipment', fullCode: '11 170' },
  { division: '11', code: '190', description: 'Detention Equipment', fullCode: '11 190' },
  { division: '11', code: '200', description: 'Water Supply & Treatment Equipment', fullCode: '11 200' },
  { division: '11', code: '280', description: 'Hydraulic Gates and Valves', fullCode: '11 280' },
  { division: '11', code: '300', description: 'Fluid Waste Treatment & Disposal Equip', fullCode: '11 300' },
  { division: '11', code: '400', description: 'Food Service Equipment', fullCode: '11 400' },
  { division: '11', code: '450', description: 'Refrigeration Equipment', fullCode: '11 450' },
  { division: '11', code: '460', description: 'Residential Equipment', fullCode: '11 460' },
  { division: '11', code: '470', description: 'Darkroom Equipment', fullCode: '11 470' },
  { division: '11', code: '480', description: 'Athletic Equipment', fullCode: '11 480' },
  { division: '11', code: '500', description: 'Industrial Equipment', fullCode: '11 500' },
  { division: '11', code: '600', description: 'Labatory Equipment', fullCode: '11 600' },
  { division: '11', code: '650', description: 'Planetarium Equipment', fullCode: '11 650' },
  { division: '11', code: '660', description: 'Observatory Equipment', fullCode: '11 660' },
  { division: '11', code: '700', description: 'Medical Equipment', fullCode: '11 700' },
  { division: '11', code: '750', description: 'Dental Equipment', fullCode: '11 750' },
  { division: '11', code: '780', description: 'Mortuary Equipment', fullCode: '11 780' },
  { division: '11', code: '800', description: 'Office Equipment', fullCode: '11 800' },
  { division: '11', code: '850', description: 'Navigation Equipment', fullCode: '11 850' },
  { division: '11', code: '870', description: 'Agricultural Equipment', fullCode: '11 870' },
  { division: '11', code: '900', description: 'Other Equipment', fullCode: '11 900' },

  // 12 - Furnishings
  { division: '12', code: '050', description: 'Fabrics', fullCode: '12 050' },
  { division: '12', code: '100', description: 'Artwork', fullCode: '12 100' },
  { division: '12', code: '300', description: 'Manufactured Casework', fullCode: '12 300' },
  { division: '12', code: '500', description: 'Window Treatment', fullCode: '12 500' },
  { division: '12', code: '600', description: 'Furniture & Accessories', fullCode: '12 600' },
  { division: '12', code: '670', description: 'Rugs & Mats', fullCode: '12 670' },
  { division: '12', code: '700', description: 'Multiple Seating', fullCode: '12 700' },
  { division: '12', code: '800', description: 'Interior Plants & Planters', fullCode: '12 800' },
  { division: '12', code: '900', description: 'Furnishings Repair & Restoration', fullCode: '12 900' },

  // 13 - Special Construction
  { division: '13', code: '010', description: 'Air-Supported Structures', fullCode: '13 010' },
  { division: '13', code: '020', description: 'Building Modules', fullCode: '13 020' },
  { division: '13', code: '030', description: 'Special Purpose Rooms', fullCode: '13 030' },
  { division: '13', code: '080', description: 'Sound, Vibratb, Seismic Cntl', fullCode: '13 080' },
  { division: '13', code: '090', description: 'Radiation Protection', fullCode: '13 090' },
  { division: '13', code: '100', description: 'Lightning Protection', fullCode: '13 100' },
  { division: '13', code: '110', description: 'Cathodic Protection', fullCode: '13 110' },
  { division: '13', code: '120', description: 'Pre Engineered Structures', fullCode: '13 120' },
  { division: '13', code: '150', description: 'Swimming Pools', fullCode: '13 150' },
  { division: '13', code: '160', description: 'Aquariums', fullCode: '13 160' },
  { division: '13', code: '165', description: 'Aquatic Park Facilities', fullCode: '13 165' },
  { division: '13', code: '170', description: 'Tubs & Pools', fullCode: '13 170' },
  { division: '13', code: '175', description: 'Ice Rinks', fullCode: '13 175' },
  { division: '13', code: '185', description: 'Kennels & Animal Shelters', fullCode: '13 185' },
  { division: '13', code: '190', description: 'Site-Constructed Incinerators', fullCode: '13 190' },
  { division: '13', code: '200', description: 'Storage Tanks', fullCode: '13 200' },
  { division: '13', code: '220', description: 'Filter Underdrains & Media', fullCode: '13 220' },
  { division: '13', code: '230', description: 'Digester Covers & Appurtenances', fullCode: '13 230' },
  { division: '13', code: '240', description: 'Oxygenation Systems', fullCode: '13 240' },
  { division: '13', code: '260', description: 'Sludge Conditioning Systems', fullCode: '13 260' },
  { division: '13', code: '280', description: 'Hazardous Material Remediation', fullCode: '13 280' },
  { division: '13', code: '400', description: 'Measurement & Control Instrumentation', fullCode: '13 400' },
  { division: '13', code: '500', description: 'Recording Instrumentation', fullCode: '13 500' },
  { division: '13', code: '550', description: 'Transportation Control Instrumentation', fullCode: '13 550' },
  { division: '13', code: '600', description: 'Solar Energy Systems', fullCode: '13 600' },
  { division: '13', code: '700', description: 'Wind Energy Systems', fullCode: '13 700' },
  { division: '13', code: '800', description: 'Building Automation Sys', fullCode: '13 800' },
  { division: '13', code: '900', description: 'Fire Suppression', fullCode: '13 900' },

  // 14 - Conveying Systems
  { division: '14', code: '100', description: 'Dump waiters', fullCode: '14 100' },
  { division: '14', code: '130', description: 'Elevator Cab Interiors', fullCode: '14 130' },
  { division: '14', code: '150', description: 'Cab Protection', fullCode: '14 150' },
  { division: '14', code: '200', description: 'Elevators', fullCode: '14 200' },
  { division: '14', code: '210', description: 'Hydraulic Elevators', fullCode: '14 210' },
  { division: '14', code: '300', description: 'Escalators and Moving Walks', fullCode: '14 300' },
  { division: '14', code: '310', description: 'Escalators', fullCode: '14 310' },
  { division: '14', code: '420', description: 'Handicap Lifts', fullCode: '14 420' },
  { division: '14', code: '550', description: 'Material Handling Systems', fullCode: '14 550' },
  { division: '14', code: '600', description: 'Hoists and Cranes', fullCode: '14 600' },
  { division: '14', code: '700', description: 'Turntables', fullCode: '14 700' },
  { division: '14', code: '800', description: 'Scaffolding', fullCode: '14 800' },
  { division: '14', code: '900', description: 'Transportation', fullCode: '14 900' },

  // 15 - Mechanical
  { division: '15', code: '050', description: 'Basic Mechanical Materials & Methods', fullCode: '15 050' },
  { division: '15', code: '300', description: 'Fire Protection', fullCode: '15 300' },
  { division: '15', code: '400', description: 'Plumbing', fullCode: '15 400' },
  { division: '15', code: '500', description: 'HVAC', fullCode: '15 500' },
  { division: '15', code: '955', description: 'Building Systems Control', fullCode: '15 955' },
  { division: '15', code: '990', description: 'Test/Adj/Balance', fullCode: '15 990' },

  // 16 - Electrical
  { division: '16', code: '050', description: 'Basic Elec Mtls & Methods', fullCode: '16 050' },
  { division: '16', code: '100', description: 'Electrical Power', fullCode: '16 100' },
  { division: '16', code: '500', description: 'Lighting', fullCode: '16 500' },
  { division: '16', code: '600', description: 'Special Systems', fullCode: '16 600' },
  { division: '16', code: '610', description: 'Emergency Generator', fullCode: '16 610' },
  { division: '16', code: '700', description: 'Communications', fullCode: '16 700' },
  { division: '16', code: '710', description: 'Fire Alarm System', fullCode: '16 710' },
  { division: '16', code: '715', description: 'Security Alarm System', fullCode: '16 715' },
  { division: '16', code: '720', description: 'Phone System', fullCode: '16 720' },
  { division: '16', code: '730', description: 'CATV System', fullCode: '16 730' },
  { division: '16', code: '740', description: 'Sound & Communication System', fullCode: '16 740' },
  { division: '16', code: '750', description: 'Data System', fullCode: '16 750' },
  { division: '16', code: '900', description: 'Temporary Power', fullCode: '16 900' },

  // 17 - Cleaning
  { division: '17', code: '000', description: 'Interim Cleaning', fullCode: '17 000' },
  { division: '17', code: '100', description: 'Final Cleaning', fullCode: '17 100' },

  // 20 - Fees & Assessments
  { division: '20', code: '001', description: 'Contractor Fee', fullCode: '20 001' },
  { division: '20', code: '002', description: 'Contingency', fullCode: '20 002' },
  { division: '20', code: '003', description: 'Development Fee', fullCode: '20 003' },
  { division: '20', code: '010', description: 'C.U.P Submittal/Processing', fullCode: '20 010' },
  { division: '20', code: '020', description: 'Enviro Impact Study & Mit', fullCode: '20 020' },
  { division: '20', code: '030', description: 'Survey & Topo Mapping', fullCode: '20 030' },
  { division: '20', code: '040', description: 'Hazardous Survey', fullCode: '20 040' },
  { division: '20', code: '050', description: 'ALTA Survey', fullCode: '20 050' },
  { division: '20', code: '090', description: 'Architectural & Construction Admin', fullCode: '20 090' },
  { division: '20', code: '220', description: 'Electric Utility Design Fees', fullCode: '20 220' },
  { division: '20', code: '240', description: 'Specialty Consultants', fullCode: '20 240' },
  { division: '20', code: '260', description: 'DESIGN SERVICES', fullCode: '20 260' },
  { division: '20', code: '280', description: 'Plan Check Fees', fullCode: '20 280' },
  { division: '20', code: '290', description: 'City/County Fees', fullCode: '20 290' },
  { division: '20', code: '300', description: 'Fire', fullCode: '20 300' },
  { division: '20', code: '310', description: 'Health Department', fullCode: '20 310' },
  { division: '20', code: '340', description: 'Grading', fullCode: '20 340' },
  { division: '20', code: '480', description: 'Encroach/Traffic Permits', fullCode: '20 480' },
  { division: '20', code: '500', description: 'Builders Risk Insurance', fullCode: '20 500' },
  { division: '20', code: '520', description: 'General Liability', fullCode: '20 520' },
  { division: '20', code: '530', description: "Haz. Mat'l Rem & Abate", fullCode: '20 530' },
  { division: '20', code: '540', description: 'Wetlands Set Aside/Mit', fullCode: '20 540' },
  { division: '20', code: '550', description: 'Endangered Species Mit', fullCode: '20 550' },
  { division: '20', code: '570', description: 'FF & E', fullCode: '20 570' },
  { division: '20', code: '630', description: 'Printing & Reprographics', fullCode: '20 630' },
  { division: '20', code: '640', description: 'Testing & Inspection Fees', fullCode: '20 640' },
  { division: '20', code: '670', description: 'Owners Representative', fullCode: '20 670' },

  // 21 - Professional Services
  { division: '21', code: '000', description: 'Professional Services', fullCode: '21 000' },
  { division: '21', code: '001', description: 'Geotechnical Services', fullCode: '21 001' },
  { division: '21', code: '010', description: 'Landscape Design', fullCode: '21 010' },
  { division: '21', code: '030', description: 'Structural Engineering', fullCode: '21 030' },
  { division: '21', code: '035', description: 'Civil Engineering', fullCode: '21 035' },
  { division: '21', code: '040', description: 'Interior Design', fullCode: '21 040' },
  { division: '21', code: '050', description: 'Mechanical Engineering', fullCode: '21 050' },
  { division: '21', code: '060', description: 'Electrical Engineering', fullCode: '21 060' },
  { division: '21', code: '070', description: 'Plumbing Design', fullCode: '21 070' },
  { division: '21', code: '080', description: 'Fire Protection Engineering', fullCode: '21 080' },
  { division: '21', code: '090', description: 'TelCo/Data Design', fullCode: '21 090' },
  { division: '21', code: '100', description: 'Audio/Visual Consultant', fullCode: '21 100' },
  { division: '21', code: '120', description: 'Survey & Topo Mapping', fullCode: '21 120' },
  { division: '21', code: '121', description: 'Hazardous Survey', fullCode: '21 121' },
  { division: '21', code: '123', description: 'ALTA Survey', fullCode: '21 123' },
  { division: '21', code: '260', description: 'DESIGN SERVICES', fullCode: '21 260' },
]

export const PROMPT_TEXT = `
AMEX COST CODE REFERENCE:
Use these specific AMEX cost codes for categorization:

DIVISION 02 - SITE:
- 02 100: Demolition
- 02 200: Earthwork
- 02 300: Grading
- 02 500: A/C Paving
- 02 580: Site Concrete
- 02 900: Planting & Irrigation

DIVISION 03 - CONCRETE:
- 03 200: Concrete Reinforcement
- 03 300: Cast In Place Concrete
- 03 400: Precast Concrete
- 03 500: Cementitious Decks & Underlayment
- 03 600: Grouts

DIVISION 05 - METALS:
- 05 100: Structural Metals
- 05 300: Metal Deck
- 05 510: Metal Stairs/Ladder
- 05 700: Misc. Metal

DIVISION 06 - WOOD:
- 06 100: Rough Carpentry
- 06 200: Finish Carpentry
- 06 400: Architectural Woodwork

DIVISION 07 - THERMAL/MOISTURE:
- 07 100: Waterproofing
- 07 200: Thermal Protection
- 07 300: Shingles, Roof Tiles, & Misc Roof Coverings
- 07 400: Roofing & Siding Panels
- 07 500: Membrane Roofing
- 07 600: Flashing & Sheet Metal

DIVISION 08 - DOORS/WINDOWS:
- 08 100: Doors, Frames, Hardware
- 08 500: Windows
- 08 700: Hardware
- 08 800: Glazing

DIVISION 09 - FINISHES:
- 09 100: Metal Studs & Drywall
- 09 250: Gypsum Board
- 09 300: Ceramic Tile
- 09 500: Ceilings
- 09 600: Flooring
- 09 900: Painting

DIVISION 15 - MECHANICAL:
- 15 400: Plumbing
- 15 500: HVAC
- 15 300: Fire Protection

DIVISION 16 - ELECTRICAL:
- 16 100: Electrical Power
- 16 500: Lighting
- 16 700: Communications
`

