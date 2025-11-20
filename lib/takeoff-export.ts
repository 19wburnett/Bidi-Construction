import * as XLSX from 'xlsx'
import { TakeoffItem } from '@/components/takeoff-accordion'

interface GroupedData {
  category: string
  subcontractor: string
  items: TakeoffItem[]
  subtotal: number
}

/**
 * Calculate item cost
 */
function calculateItemCost(item: TakeoffItem): number {
  if (item.total_cost !== undefined) return item.total_cost
  if (item.unit_cost !== undefined && item.quantity !== undefined) {
    return item.unit_cost * item.quantity
  }
  return 0
}

/**
 * Group items by category and subcontractor
 */
function groupItems(items: TakeoffItem[]): GroupedData[] {
  const grouped: Record<string, Record<string, TakeoffItem[]>> = {}

  items.forEach(item => {
    if (item.parent_id) return // Skip sub-items

    const category = (item.category || 'Other').trim()
    const subcontractor = item.subcontractor || 'Unassigned'

    if (!grouped[category]) {
      grouped[category] = {}
    }
    if (!grouped[category][subcontractor]) {
      grouped[category][subcontractor] = []
    }
    grouped[category][subcontractor].push(item)
  })

  const result: GroupedData[] = []
  Object.entries(grouped).forEach(([category, subcontractors]) => {
    Object.entries(subcontractors).forEach(([subcontractor, categoryItems]) => {
      const subtotal = categoryItems.reduce((sum, item) => sum + calculateItemCost(item), 0)
      result.push({
        category,
        subcontractor,
        items: categoryItems,
        subtotal
      })
    })
  })

  return result
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Export to CSV
 */
export function exportToCSV(items: TakeoffItem[]): void {
  const grouped = groupItems(items)
  const rows: string[][] = []

  // Header
  rows.push([
    'Category',
    'Subcontractor',
    'Item Name',
    'Description',
    'Quantity',
    'Unit',
    'Unit Cost',
    'Total Cost',
    'Location',
    'Page',
    'Cost Code',
    'Notes'
  ])

  // Data rows
  grouped.forEach(group => {
    group.items.forEach(item => {
      rows.push([
        group.category,
        group.subcontractor,
        item.name || '',
        item.description || '',
        String(item.quantity || 0),
        item.unit || '',
        item.unit_cost !== undefined ? formatCurrency(item.unit_cost) : '',
        formatCurrency(calculateItemCost(item)),
        item.location || '',
        item.bounding_box?.page ? String(item.bounding_box.page) : '',
        item.cost_code || '',
        item.notes || ''
      ])
    })

    // Subtotal row
    rows.push([
      group.category,
      group.subcontractor,
      '',
      `Subtotal: ${group.subcontractor}`,
      '',
      '',
      '',
      formatCurrency(group.subtotal),
      '',
      '',
      '',
      ''
    ])
  })

  // Overall total
  const overallTotal = items.reduce((sum, item) => sum + calculateItemCost(item), 0)
  rows.push([
    '',
    '',
    '',
    'TOTAL',
    '',
    '',
    '',
    formatCurrency(overallTotal),
    '',
    '',
    '',
    ''
  ])

  // Convert to CSV
  const csvContent = rows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `takeoff-export-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export to Excel
 */
export function exportToExcel(items: TakeoffItem[]): void {
  const grouped = groupItems(items)
  const rows: any[][] = []

  // Header
  rows.push([
    'Category',
    'Subcontractor',
    'Item Name',
    'Description',
    'Quantity',
    'Unit',
    'Unit Cost',
    'Total Cost',
    'Location',
    'Page',
    'Cost Code',
    'Notes'
  ])

  // Data rows with grouping
  grouped.forEach(group => {
    // Category header row (if first item in category)
    const categoryStart = rows.length
    let categoryTotal = 0

    group.items.forEach(item => {
      const itemCost = calculateItemCost(item)
      categoryTotal += itemCost

      rows.push([
        group.category,
        group.subcontractor,
        item.name || '',
        item.description || '',
        item.quantity || 0,
        item.unit || '',
        item.unit_cost || 0,
        itemCost,
        item.location || '',
        item.bounding_box?.page || '',
        item.cost_code || '',
        item.notes || ''
      ])
    })

    // Subcontractor subtotal row
    rows.push([
      group.category,
      group.subcontractor,
      '',
      `Subtotal: ${group.subcontractor}`,
      '',
      '',
      '',
      group.subtotal,
      '',
      '',
      '',
      ''
    ])
  })

  // Overall total
  const overallTotal = items.reduce((sum, item) => sum + calculateItemCost(item), 0)
  rows.push([
    '',
    '',
    '',
    'TOTAL',
    '',
    '',
    '',
    overallTotal,
    '',
    '',
    '',
    ''
  ])

  // Create workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Category
    { wch: 20 }, // Subcontractor
    { wch: 30 }, // Item Name
    { wch: 40 }, // Description
    { wch: 12 }, // Quantity
    { wch: 10 }, // Unit
    { wch: 15 }, // Unit Cost
    { wch: 15 }, // Total Cost
    { wch: 20 }, // Location
    { wch: 8 },  // Page
    { wch: 12 }, // Cost Code
    { wch: 30 }  // Notes
  ]

  // Style subtotal and total rows (bold)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let row = 0; row <= range.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 3 }) // Description column
    const cell = ws[cellAddress]
    if (cell && (cell.v?.toString().includes('Subtotal') || cell.v === 'TOTAL')) {
      // Mark row for styling (actual styling would require xlsx-style or similar)
      // For now, we'll just ensure the data is correct
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Takeoff')
  XLSX.writeFile(wb, `takeoff-export-${new Date().toISOString().split('T')[0]}.xlsx`)
}



