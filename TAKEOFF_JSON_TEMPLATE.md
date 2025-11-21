# Takeoff JSON Template

This document describes the JSON structure expected for takeoff items in the spreadsheet component.

## Minimal Required Structure

```json
{
  "items": [
    {
      "name": "2x4 Stud Framing",
      "description": "Interior wall framing with 2x4 studs at 16\" OC",
      "quantity": 150.5,
      "unit": "LF",
      "category": "structural",
      "subcontractor": "Framing"
    }
  ]
}
```

## Full Structure with All Fields

```json
{
  "items": [
    {
      "id": "optional-uuid-or-generated",
      "name": "2x4 Stud Framing",
      "description": "Interior wall framing with 2x4 studs at 16\" OC",
      "quantity": 150.5,
      "unit": "LF",
      "unit_cost": 2.50,
      "total_cost": 376.25,
      "category": "structural",
      "subcategory": "Framing",
      "subcontractor": "Framing",
      "cost_code": "06-10-00",
      "cost_code_description": "Rough Carpentry",
      "location": "Interior partitions, Kitchen area",
      "notes": "Standard grade lumber",
      "dimensions": "20' x 30'",
      "bounding_box": {
        "page": 1,
        "x": 0.25,
        "y": 0.30,
        "width": 0.15,
        "height": 0.10
      },
      "confidence": 0.95,
      "parent_id": "optional-parent-item-id",
      "user_created": false,
      "user_modified": false
    }
  ],
  "summary": {
    "total_items": 1,
    "categories": {},
    "subcategories": {},
    "total_area_sf": 0,
    "plan_scale": "1/4\" = 1'-0\"",
    "confidence": "high",
    "notes": "Overall observations"
  }
}
```

## Field Descriptions

### Required Fields
- **name** (string): Item name (e.g., "2x4 Stud Framing")
- **description** (string): Detailed description
- **quantity** (number): Quantity amount
- **unit** (string): Unit of measurement - one of: `LF`, `SF`, `CF`, `CY`, `EA`, `SQ`
- **category** (string): One of: `structural`, `exterior`, `interior`, `mep`, `finishes`, `other`

### Optional Fields
- **id** (string): Unique identifier (auto-generated if not provided)
- **unit_cost** (number): Cost per unit
- **total_cost** (number): Total cost (calculated as quantity × unit_cost if not provided)
- **subcategory** (string): Subcategory name (e.g., "Wall Types", "Fixtures")
- **subcontractor** (string): Trade Type (e.g., "Electrical", "Plumbing", "Framing", "Concrete")
- **cost_code** (string): Procore cost code (e.g., "06-10-00", "3,300")
- **cost_code_description** (string): Description of the cost code
- **location** (string): Location reference (e.g., "North Wall", "Kitchen", "Sheet A1.2")
- **notes** (string): Additional notes
- **dimensions** (string): Original dimensions from plan (e.g., "20' x 30'")
- **bounding_box** (object): Location on PDF page
  - **page** (number): Page number (1-indexed)
  - **x** (number): X coordinate (0-1 normalized)
  - **y** (number): Y coordinate (0-1 normalized)
  - **width** (number): Width (0-1 normalized)
  - **height** (number): Height (0-1 normalized)
- **confidence** (number): Confidence score (0-1)
- **parent_id** (string): ID of parent item for sub-items
- **user_created** (boolean): Whether item was created by user
- **user_modified** (boolean): Whether item was modified by user

## Alternative Field Names (Auto-Mapped)

The component automatically maps these alternative field names:

- `item_name` → `name`
- `item_description` → `description`
- `location_reference` → `location`
- `detection_coordinates` → `bounding_box`
- `plan_page_number` → `bounding_box.page`

## Categories

Valid category values:
- `structural` - Foundation, framing, structural steel
- `exterior` - Siding, windows, doors, roofing
- `interior` - Interior walls, doors, flooring, ceilings
- `mep` - Mechanical, Electrical, Plumbing
- `finishes` - Paint, tile, hardware, appliances
- `other` - Site work, landscaping, specialties

## Units

Valid unit values:
- `LF` - Linear Feet
- `SF` - Square Feet
- `CF` - Cubic Feet
- `CY` - Cubic Yards
- `EA` - Each
- `SQ` - Square (100 SF for roofing)

## Example: Current Format (Flat Array - Backwards Compatible)

```json
[
  {
    "name": "Excavation and Backfill",
    "unit": "CY",
    "notes": "Includes trenching for foundation and site drainage per plan P-1 and P-2.",
    "category": "structural",
    "location": "Entire building footprint and surrounding grade",
    "quantity": 1691,
    "cost_code": "31 20 00",
    "unit_cost": 15,
    "confidence": 0.9,
    "dimensions": "Approx. 5,072 SF footprint x 9 ft depth = 1,691 CY",
    "description": "Excavate for full basement with stepped footings and window wells as shown on foundation plan.",
    "subcategory": "earthwork",
    "bounding_box": {
      "x": 0.15,
      "y": 0.35,
      "page": 2,
      "width": 0.65,
      "height": 0.4
    },
    "cost_code_description": "Earth Moving"
  },
  {
    "name": "Footings",
    "unit": "LF",
    "category": "structural",
    "quantity": 400,
    "unit_cost": 65,
    "subcategory": "footings"
  }
]
```

**Note**: Items without a `subcontractor` field will automatically appear under "Unassigned" and can be assigned to subcontractors using the spreadsheet UI.

## Example: Multiple Items Organized by Subcontractor

```json
{
  "items": [
    {
      "name": "2x4 Stud Framing",
      "description": "Interior wall framing",
      "quantity": 150,
      "unit": "LF",
      "unit_cost": 2.50,
      "category": "structural",
      "subcategory": "Framing",
      "subcontractor": "ABC Framing Co",
      "location": "Interior partitions"
    },
    {
      "name": "Drywall Installation",
      "description": "1/2\" drywall on interior walls",
      "quantity": 1200,
      "unit": "SF",
      "unit_cost": 1.25,
      "category": "interior",
      "subcategory": "Interior Walls",
      "subcontractor": "XYZ Drywall Inc",
      "location": "All interior walls"
    },
    {
      "name": "Electrical Outlets",
      "description": "Standard 15A outlets",
      "quantity": 25,
      "unit": "EA",
      "unit_cost": 75.00,
      "category": "mep",
      "subcategory": "Electrical",
      "subcontractor": "Unassigned",
      "location": "Throughout building"
    }
  ]
}
```

## Backwards Compatibility

The component supports multiple JSON formats for backwards compatibility:

### Old Format Support

**Wrapped Format:**
```json
{
  "takeoffs": [
    {
      "name": "Item Name",
      "quantity": 100,
      "unit": "LF",
      "category": "structural"
    }
  ]
}
```

**Alternative Field Names (Auto-Mapped):**
- `item_name`, `title`, `label` → `name`
- `item_description`, `details`, `summary` → `description`
- `qty`, `amount`, `count` → `quantity`
- `location_reference`, `location_ref`, `area`, `room`, `zone`, `sheet_reference`, `sheet` → `location`
- `item_type`, `trade_category`, `discipline`, `scope`, `segment`, `group` → `category`
- `sub_category`, `Subcategory`, `scope_detail` → `subcategory`
- `unit_of_measure`, `uom` → `unit`
- `detection_coordinates` → `bounding_box`
- `plan_page_number`, `page_number`, `pageNumber`, `page` → `bounding_box.page`
- `confidence_score` → `confidence`
- `costCode` → `cost_code`
- `costCodeDescription` → `cost_code_description`
- `userCreated` → `user_created`
- `userModified` → `user_modified`
- `parentId` → `parent_id`

**Old Database Format:**
```json
{
  "item_type": "wall",
  "category": "structural",
  "description": "Interior wall framing",
  "quantity": 150,
  "unit": "linear ft",
  "unit_cost": 2.50,
  "location_reference": "Interior partitions",
  "detection_coordinates": {
    "x": 0.25,
    "y": 0.30,
    "width": 0.15,
    "height": 0.10
  },
  "plan_page_number": 1,
  "confidence_score": 0.95
}
```

All of these formats are automatically normalized to the standard format.

## Notes

1. **IDs**: If `id` is not provided, the component will auto-generate one
2. **Subcontractor**: If not provided, items default to "Unassigned" and appear under that group
3. **Total Cost**: If `total_cost` is not provided, it's calculated as `quantity × unit_cost`
4. **Bounding Box**: Coordinates are normalized (0-1) relative to page dimensions
5. **Category**: Must be lowercase (will be capitalized for display)
6. **Backwards Compatible**: The component handles old JSON formats automatically

