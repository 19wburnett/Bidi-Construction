# Bid Line Items Feature

## Overview
This feature allows bids to include detailed line-by-line cost breakdowns, providing transparency and helping general contractors compare quotes more effectively.

## Database Schema

### Table: `bid_line_items`
Stores individual line items for each bid.

**Columns:**
- `id` - UUID, primary key
- `bid_id` - UUID, foreign key to bids table
- `item_number` - Integer, order of items (1, 2, 3...)
- `description` - Text, description of the line item
- `category` - Text, category (labor, materials, equipment, permits, other)
- `quantity` - Numeric(10,2), quantity of units
- `unit` - Text, unit of measurement (sq ft, hours, each, lump sum)
- `unit_price` - Numeric(10,2), price per unit
- `amount` - Numeric(10,2), total for this line item **[REQUIRED]**
- `notes` - Text, additional details
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Auto-Calculation Feature

The migration includes a trigger that **automatically updates** `bids.bid_amount` to match the sum of all line items whenever line items are added, updated, or deleted.

```sql
-- The bid_amount will always equal the sum of line item amounts
SELECT calculate_bid_total_from_line_items('bid-uuid');
```

## Example Usage

### Adding Line Items via SQL

```sql
INSERT INTO bid_line_items (bid_id, item_number, description, category, quantity, unit, unit_price, amount) 
VALUES
  -- Labor
  ('bid-uuid', 1, 'Foundation excavation and prep', 'labor', 40, 'hours', 85.00, 3400.00),
  ('bid-uuid', 2, 'Concrete pouring and finishing', 'labor', 24, 'hours', 95.00, 2280.00),
  
  -- Materials
  ('bid-uuid', 3, 'Concrete materials', 'materials', 15, 'cubic yards', 120.00, 1800.00),
  ('bid-uuid', 4, 'Rebar and reinforcement', 'materials', 1, 'lump sum', 800.00, 800.00),
  
  -- Equipment
  ('bid-uuid', 5, 'Excavator rental', 'equipment', 2, 'days', 450.00, 900.00),
  ('bid-uuid', 6, 'Concrete mixer rental', 'equipment', 1, 'day', 200.00, 200.00),
  
  -- Permits
  ('bid-uuid', 7, 'Building permit', 'permits', 1, 'lump sum', 500.00, 500.00);

-- bid_amount will automatically be updated to 9,880.00
```

### Common Categories

- **labor** - Labor costs (often by hours)
- **materials** - Material costs (lumber, concrete, etc.)
- **equipment** - Equipment rental or usage
- **permits** - Permits and inspections
- **other** - Miscellaneous costs

## UI Display

The `BidLineItemsDisplay` component shows:

1. **Grouped by Category** - Items organized by category with subtotals
2. **Detailed Breakdown** - Each line item shows:
   - Item number and description
   - Quantity and unit (if applicable)
   - Unit price (if applicable)
   - Total amount
   - Notes (if any)
3. **Total Calculation** - Shows grand total
4. **Validation Warning** - Alerts if line items total doesn't match bid_amount

## Integration with AI Email Parsing

When parsing emails from subcontractors, the AI can extract line items from:
- Tables in emails
- Attached PDFs with itemized quotes
- Formatted text breakdowns

Example email patterns to detect:
```
Labor:
- Site preparation: $2,500
- Installation: $5,000

Materials:
- Premium fixtures: $3,200
- Pipes and fittings: $800

Total: $11,500
```

## Future Enhancements

Potential additions:
- [ ] Allow GCs to add/edit line items manually
- [ ] Export line items to CSV/Excel
- [ ] Compare line items across multiple bids side-by-side
- [ ] Track which items are approved/rejected
- [ ] Add markup/margin calculations
- [ ] Link line items to project phases/milestones

## Migration Instructions

1. Run the migration in Supabase SQL Editor:
   ```sql
   -- Copy and paste contents of supabase-migration-bid-line-items.sql
   ```

2. The system will automatically:
   - Create the `bid_line_items` table
   - Set up indexes for performance
   - Create the auto-calculation trigger
   - Add helpful SQL functions

3. Start adding line items to bids, and they'll display automatically in the UI!

## Testing

To test with sample data:
```sql
-- Find a bid ID
SELECT id FROM bids LIMIT 1;

-- Add some test line items (replace 'your-bid-id' with actual UUID)
INSERT INTO bid_line_items (bid_id, item_number, description, category, amount) VALUES
  ('your-bid-id', 1, 'Labor costs', 'labor', 5000.00),
  ('your-bid-id', 2, 'Materials', 'materials', 3000.00),
  ('your-bid-id', 3, 'Equipment rental', 'equipment', 1000.00);

-- Check that bid_amount was updated
SELECT bid_amount FROM bids WHERE id = 'your-bid-id';
-- Should show 9000.00
```


