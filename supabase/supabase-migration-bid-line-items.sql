-- Migration for bid line items (detailed cost breakdowns)
-- This allows bids to have itemized breakdowns of costs

-- Create bid_line_items table
CREATE TABLE IF NOT EXISTS bid_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL, -- Order of items (1, 2, 3...)
  description TEXT NOT NULL,
  category TEXT, -- e.g., 'labor', 'materials', 'equipment', 'permits', 'other'
  quantity NUMERIC(10, 2),
  unit TEXT, -- e.g., 'sq ft', 'hours', 'each', 'lump sum'
  unit_price NUMERIC(10, 2),
  amount NUMERIC(10, 2) NOT NULL, -- Total for this line item
  notes TEXT, -- Additional details about this line item
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for fast lookup by bid
CREATE INDEX IF NOT EXISTS idx_bid_line_items_bid_id ON bid_line_items(bid_id);

-- Add index for ordering items
CREATE INDEX IF NOT EXISTS idx_bid_line_items_order ON bid_line_items(bid_id, item_number);

-- Add comments for documentation
COMMENT ON TABLE bid_line_items IS 'Line-by-line cost breakdowns for bids';
COMMENT ON COLUMN bid_line_items.item_number IS 'Order of the item in the bid breakdown (1, 2, 3...)';
COMMENT ON COLUMN bid_line_items.category IS 'Category of the line item (labor, materials, equipment, permits, other)';
COMMENT ON COLUMN bid_line_items.quantity IS 'Quantity of units (if applicable)';
COMMENT ON COLUMN bid_line_items.unit IS 'Unit of measurement (sq ft, hours, each, lump sum)';
COMMENT ON COLUMN bid_line_items.unit_price IS 'Price per unit (if applicable)';
COMMENT ON COLUMN bid_line_items.amount IS 'Total amount for this line item';

-- Create function to calculate total from line items
CREATE OR REPLACE FUNCTION calculate_bid_total_from_line_items(p_bid_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM bid_line_items
  WHERE bid_id = p_bid_id;
$$ LANGUAGE sql STABLE;

-- Create function to update bid_amount from line items
CREATE OR REPLACE FUNCTION update_bid_amount_from_line_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the bid_amount in bids table to match sum of line items
  UPDATE bids
  SET bid_amount = calculate_bid_total_from_line_items(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.bid_id
      ELSE NEW.bid_id
    END
  )
  WHERE id = CASE 
    WHEN TG_OP = 'DELETE' THEN OLD.bid_id
    ELSE NEW.bid_id
  END;
  
  RETURN CASE 
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update bid_amount when line items change
DROP TRIGGER IF EXISTS trigger_update_bid_amount ON bid_line_items;
CREATE TRIGGER trigger_update_bid_amount
  AFTER INSERT OR UPDATE OR DELETE ON bid_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_bid_amount_from_line_items();

-- Example data structure for reference:
-- INSERT INTO bid_line_items (bid_id, item_number, description, category, quantity, unit, unit_price, amount) VALUES
-- ('bid-uuid', 1, 'Foundation excavation and prep', 'labor', 40, 'hours', 85.00, 3400.00),
-- ('bid-uuid', 2, 'Concrete materials', 'materials', 15, 'cubic yards', 120.00, 1800.00),
-- ('bid-uuid', 3, 'Rebar and reinforcement', 'materials', 1, 'lump sum', 800.00, 800.00),
-- ('bid-uuid', 4, 'Equipment rental', 'equipment', 3, 'days', 350.00, 1050.00),
-- ('bid-uuid', 5, 'Permits and inspections', 'permits', 1, 'lump sum', 500.00, 500.00);
