# AI-Powered Takeoff Analysis System

## Overview

The AI Takeoff Analysis system uses OpenAI's GPT-4 Vision (gpt-4o) to scan construction plans and extract detailed material quantities, measurements, and specifications. This acts as an automated construction estimator that reads PDFs like a professional quantity surveyor.

## How It Works

### 1. PDF Analysis Process

When you click "Analyze" in the Takeoff sidebar:

1. **PDF to Image Conversion**: The system converts PDF pages to high-quality JPEG images (client-side using PDF.js)
   - Renders up to 5 pages at 2x scale for optimal quality
   - Converts each page to base64-encoded JPEG (90% quality)
   - Works entirely in the browser for fast, serverless-friendly processing
2. **Vision Analysis**: Sends the images to OpenAI's Vision API with high-resolution detail setting
3. **AI Processing**: GPT-4o reads all visible text, dimensions, and annotations across all pages
4. **Quantity Extraction**: AI calculates quantities based on visible dimensions
5. **Structured Output**: Returns data in a standardized JSON format
6. **Display**: Results appear in the sidebar with organized breakdowns

### 2. What The AI Extracts

The AI is trained to identify and quantify:

#### **Structural Elements**
- Foundation (concrete footings, slabs - cubic yards)
- Framing lumber (studs, plates, joists, rafters - linear feet)
- Structural steel or beams (sizes and linear feet)
- Columns and posts

#### **Exterior Components**
- Wall area (square feet for siding/cladding)
- Windows (count, sizes, types)
- Doors (count, sizes, types)
- Roofing area (square feet or squares)
- Gutters and downspouts (linear feet)

#### **Interior Finishes**
- Room dimensions and square footage
- Interior walls (linear feet for framing, square feet for drywall)
- Flooring by room (square feet, by type)
- Ceiling area (square feet)
- Interior doors (count and sizes)
- Trim and molding (linear feet)

#### **MEP Systems** (if visible)
- Electrical outlets and switches (count by room)
- Light fixtures (count and types)
- Plumbing fixtures (count: sinks, toilets, tubs, etc.)
- HVAC vents and registers (count)

#### **Other Elements**
- Cabinets (linear feet or count)
- Countertops (linear feet or square feet)
- Tile areas (square feet)
- Paint coverage (square feet by surface type)
- Hardware and accessories

### 3. Data Structure

The AI returns a comprehensive JSON object with:

```json
{
  "items": [
    {
      "name": "2x4 Stud Framing",
      "description": "Standard wall framing studs 16\" o.c.",
      "quantity": 150.5,
      "unit": "LF",
      "location": "North Wall - Main Floor",
      "category": "structural",
      "notes": "Assumes 16\" on-center spacing",
      "dimensions": "8' height x 20' length"
    }
  ],
  "summary": {
    "total_items": 45,
    "categories": {
      "structural": 12,
      "exterior": 8,
      "interior": 15,
      "mep": 7,
      "finishes": 3
    },
    "total_area_sf": 2450,
    "plan_scale": "1/4\" = 1'",
    "confidence": "high",
    "notes": "Complete floor plan with clear dimensions"
  }
}
```

## Features

### Enhanced Prompt Engineering

The system uses a detailed prompt that:
- Instructs the AI to act as a certified quantity surveyor with 20+ years experience
- Specifies exact extraction patterns for different construction elements
- Requires showing mathematical calculations
- Demands specific units (LF, SF, CF, CY, EA, SQ)
- Requests inclusion of dimensions, locations, and notes

### Intelligent Parsing

The API route includes robust parsing logic that:
- Extracts JSON from markdown code blocks
- Falls back to regex extraction if needed
- Validates data structure
- Provides text-based extraction as final fallback
- Handles various AI response formats

### Rich Visual Display

The sidebar shows:

#### **Summary Section**
- Total item count
- Total area in square feet
- Detected plan scale
- Confidence level (high/medium/low) with color coding
- Category breakdown (count by type)
- Overall notes

#### **Items List** (Scrollable)
Each item displays:
- **Name** (bold, e.g., "2x6 Top Plate")
- **Category badge** (structural, exterior, interior, etc.)
- **Description** (specifications)
- **Dimensions** 📐 (from plan, e.g., "20' x 30'")
- **Location** 📍 (where it's located)
- **Quantity** (bold, with unit)
- **Cost** (if available) as a badge
- **Notes** 💡 (assumptions, installation notes)

### Context Awareness

The system:
- References any measurements you've drawn on the plan
- Uses high-resolution image analysis
- Maintains low temperature (0.2) for consistent results
- Provides 4096 token limit for comprehensive responses

## Usage Tips

### For Best Results:

1. **Upload Clear Plans**: High-resolution PDFs with readable text
2. **Include Scale**: Plans with visible scale indicators work best
3. **Mark Key Areas**: Use the drawing tools to highlight specific areas of interest
4. **Check Confidence**: Low confidence scores may need manual review
5. **Review Notes**: AI often includes assumptions - validate these

### Common Use Cases:

- **Material Estimation**: Get quantities for ordering materials
- **Quick Checks**: Verify manual takeoffs against AI analysis
- **Preliminary Budgeting**: Use for initial cost estimates
- **Change Orders**: Analyze plan revisions to identify quantity changes
- **Missing Items**: Cross-reference with your own list to catch omissions

## Technical Details

### API Endpoint
`POST /api/plan/analyze-takeoff`

**Request Body:**
```json
{
  "planId": "uuid",
  "images": ["data:image/jpeg;base64,...", "data:image/jpeg;base64,..."], // Array of base64 images
  "drawings": [] // Optional array of user drawings
}
```

**Response:**
```json
{
  "items": [...],
  "summary": {...},
  "raw_response": "..." // Fallback if parsing fails
}
```

**Why Images Instead of PDF URLs?**
OpenAI's Vision API only accepts image formats (PNG, JPEG, GIF, WEBP), not PDFs. To work around this:
- PDFs are converted to images **client-side** using PDF.js
- This approach is serverless-friendly (no native dependencies)
- Ensures compatibility with Vercel and other serverless platforms
- Provides better control over image quality and scaling

### Database Storage

Results are saved to `plan_takeoff_analysis` table:
- `plan_id`: Reference to the plan
- `analysis_data`: Full JSON response
- `created_at`: Timestamp
- Linked via foreign key for easy retrieval

### AI Model Configuration

- **Model**: `gpt-4o` (OpenAI Vision)
- **Temperature**: 0.2 (very low for consistency)
- **Max Tokens**: 4096 (comprehensive responses)
- **Image Detail**: `high` (maximum resolution analysis)

## Limitations

1. **Page Limit**: Currently analyzes up to 5 pages per plan to manage API costs and token limits
2. **OCR Dependent**: Accuracy depends on plan legibility and image quality
3. **Scale Detection**: May struggle with non-standard or missing scales
4. **Complex Details**: Intricate or overlapping elements may be missed
5. **Cost Estimation**: AI doesn't include costs (unless you add them manually)
6. **Code Compliance**: Doesn't verify code requirements or building codes
7. **Material Specs**: May need manual verification of specific grades/types
8. **Multi-Page Plans**: Large plan sets may need to be analyzed in sections

## Future Enhancements

- [x] PDF to image conversion for Vision API compatibility ✅ **Implemented**
- [ ] Increase page limit (currently 5 pages)
- [ ] Cost database integration for automatic pricing
- [ ] Excel/CSV export functionality
- [ ] Comparison with previous takeoffs (version diff)
- [ ] Manual editing of extracted items in the sidebar
- [ ] Custom material libraries and templates
- [ ] Integration with supplier APIs for real-time pricing
- [ ] Bulk analysis of multiple plans
- [ ] AI-assisted cost estimation based on location and market rates

## Support

If the AI produces unexpected results:
- Check the "Raw Response" section (shown if parsing fails)
- Review the confidence score
- Try re-uploading the plan at higher resolution
- Use the drawing tools to highlight specific areas
- Manually verify critical quantities

---

**Last Updated**: October 12, 2025

