-- Migration: Add 'item' to plan_drawings drawing_type check constraint
-- This allows storing tagged construction items (doors, windows, fixtures, etc.)

-- First, drop the existing constraint
ALTER TABLE plan_drawings 
DROP CONSTRAINT IF EXISTS plan_drawings_drawing_type_check;

-- Add the new constraint with 'item' included
ALTER TABLE plan_drawings
ADD CONSTRAINT plan_drawings_drawing_type_check 
CHECK (drawing_type IN ('line', 'rectangle', 'circle', 'polygon', 'measurement', 'annotation', 'area', 'item', 'comment'));

-- Add comment for documentation
COMMENT ON CONSTRAINT plan_drawings_drawing_type_check ON plan_drawings IS 
'Allowed drawing types: line, rectangle, circle, polygon, measurement, annotation, area, item, comment';





