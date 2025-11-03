-- Quick query to check how many Utah subcontractors you already have
SELECT 
  COUNT(*) as total_utah_subcontractors,
  COUNT(DISTINCT trade_category) as unique_categories,
  COUNT(DISTINCT website_url) as unique_websites
FROM subcontractors
WHERE location ILIKE '%Utah%';

-- Also check by category breakdown
SELECT 
  trade_category,
  COUNT(*) as count
FROM subcontractors
WHERE location ILIKE '%Utah%'
GROUP BY trade_category
ORDER BY count DESC;


