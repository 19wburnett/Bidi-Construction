# AI Plan Analysis Feature

## Overview
The AI Plan Analysis feature allows users to upload construction plans (PDF) and receive detailed, professional analysis from specialized AI contractors for each trade category. This uses OpenAI GPT-4 with trade-specific expert prompts to provide realistic bid estimates, material requirements, labor needs, and professional recommendations.

## How It Works

### 1. PDF Upload
- Users upload a PDF construction plan
- The system extracts **enhanced text** content from the PDF using `pdf2json`
- Text extraction includes:
  - Written specifications and notes
  - Dimensions and measurements from drawings
  - Material callouts and equipment schedules
  - Room labels and spatial information
  - Text is spatially sorted (top-to-bottom, left-to-right) for better context
- Text is validated to ensure it's readable (minimum 50 characters)

### 2. Trade Selection
Users can select from 8 specialized trade categories:
- **Electrical** ⚡
- **Plumbing** 🔧
- **Framing** 🏗️
- **Concrete** 🧱
- **Drywall** 🔨
- **Roofing** 🏠
- **HVAC** ❄️
- **Flooring** 📐

### 3. AI Analysis
For each selected trade, a specialized AI "contractor" analyzes the plans:

#### Trade-Specific Expert Prompts

Each trade has a custom system prompt that instructs GPT-4 to act as a professional in that field:

**Electrical Example:**
```
You are a licensed master electrician with 20+ years of experience reviewing construction plans.
Analyze this construction plan focusing on:
- Electrical load calculations and panel requirements
- Code compliance (NEC standards)
- Wire sizing and circuit distribution
- Outlet and switch placement
- Lighting requirements
- GFCI/AFCI protection needs
- Potential safety hazards or code violations
- Service upgrade requirements
- Emergency/exit lighting needs
- Smart home pre-wiring opportunities
```

**Plumbing Example:**
```
You are a master plumber with extensive commercial and residential experience reviewing construction plans.
Analyze this construction plan focusing on:
- Water supply line sizing and routing
- Drain, waste, and vent (DWV) system requirements
- Fixture count and locations
- Water heater sizing and type recommendations
- Backflow prevention requirements
- Gas line requirements if applicable
- Potential drainage issues
- Access considerations for repairs
- Code compliance (IPC/UPC standards)
- Water conservation opportunities
```

All 8 trade categories have similarly detailed, professional-level prompts.

### 4. Structured Output

The AI returns a structured JSON response with:

```typescript
{
  trade: string                    // Trade name (e.g., "Electrical")
  bidAmount: string                // Cost range (e.g., "$15,000 - $20,000")
  estimatedTimeline: string        // Timeline (e.g., "10-14 business days")
  materials: string[]              // List of required materials
  labor: string                    // Labor team description
  potentialIssues: string[]        // Identified concerns or problems
  recommendations: string[]        // Professional recommendations
  confidence: number               // Confidence score 0-100
}
```

## API Endpoint

### `POST /api/ai-plan-analysis`

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `file`: PDF file (required)
  - `trades`: JSON array of trade names (required)

**Example:**
```javascript
const formData = new FormData()
formData.append('file', pdfFile)
formData.append('trades', JSON.stringify(['Electrical', 'Plumbing']))

const response = await fetch('/api/ai-plan-analysis', {
  method: 'POST',
  body: formData,
})
```

**Response:**
```json
{
  "success": true,
  "analyses": [
    {
      "trade": "Electrical",
      "bidAmount": "$18,500 - $22,000",
      "estimatedTimeline": "14-18 business days",
      "materials": ["200A Service Panel", "THHN Wire", "..."],
      "labor": "2-3 Licensed Electricians",
      "potentialIssues": ["Existing panel may need upgrade", "..."],
      "recommendations": ["Schedule inspection before rough-in", "..."],
      "confidence": 87
    },
    // ... more trades
  ]
}
```

## Features

### ✅ Real AI Analysis
- Uses OpenAI GPT-4o for intelligent plan review
- Trade-specific expertise in each analysis
- Actual PDF content extraction and processing
- Analyzes text, dimensions, specifications, and callouts

### ✅ Professional-Grade Prompts
- Each trade has detailed, expert-level system prompts
- Prompts include code compliance considerations
- Focus on practical, actionable insights
- Trained to infer layout from extracted text and dimensions

### ✅ Comprehensive Output
- Bid amount ranges
- Timeline estimates with business days
- Detailed material lists with quantities
- Labor requirements and team composition
- Potential issues identification
- Professional recommendations
- Confidence scoring based on plan completeness

### ✅ Multi-Trade Support
- Analyze multiple trades simultaneously
- Parallel processing for efficiency
- Consistent format across all trades

### 📊 Enhanced Text Extraction
- Extracts text with spatial awareness (position-based sorting)
- Captures dimensions and measurements from plans
- Preserves page structure for better context
- Includes material callouts and specifications

## User Interface

### Step 1: Upload Plan
- Drag-and-drop or click to upload PDF
- Progress bar shows upload status
- File name and size display
- Success confirmation

### Step 2: Select Trades
- Visual grid of trade categories with icons
- Multi-select with visual feedback
- Summary of selected trades
- Must select at least one trade

### Step 3: AI Analysis
- Loading state with progress indicators
- Real-time status messages
- Detailed results for each trade
- Color-coded sections (issues in red, recommendations in green)
- Confidence scores displayed

## Technical Details

### Dependencies
- `openai` (v4.20.1): OpenAI API client
- `pdf2json`: PDF text extraction (Next.js 15 compatible)
- `next`: React framework
- TypeScript for type safety

### Environment Variables
```bash
OPENAI_API_KEY=your_openai_api_key
```

### File Structure
```
app/
├── admin/
│   └── ai-plan-demo/
│       └── page.tsx                 # Frontend UI
└── api/
    └── ai-plan-analysis/
        └── route.ts                 # API endpoint with AI logic
```

## Error Handling

### Frontend
- Upload validation (PDF files only)
- Error messages for failed analysis
- Graceful fallback to previous step on error
- User-friendly error alerts

### Backend
- PDF text extraction error handling
- OpenAI API error handling
- Invalid file type detection
- Empty/unreadable PDF detection
- Structured error responses

## Performance Considerations

- **PDF Processing**: Text extraction is fast (<1 second for most PDFs)
- **AI Analysis**: Takes 30-60 seconds depending on:
  - Number of selected trades
  - PDF complexity and length
  - OpenAI API response time
- **Parallel Processing**: All trades analyzed simultaneously for efficiency

## Security

- Admin-only access (requires `is_admin` flag in database)
- File validation before processing
- No permanent storage of uploaded PDFs
- OpenAI API key stored securely in environment variables

## Visual Elements & Text-Based Plans

### Current Approach
The system extracts text from PDFs, which includes:
- **Text annotations** on drawings (dimensions, callouts, notes)
- **Equipment schedules** and material specifications
- **Room labels** and area calculations
- **Legend descriptions** and symbol explanations

Most construction plans include extensive text that describes visual elements, making this approach effective for generating realistic bids.

### Limitations
- **Image-only PDFs**: Scanned plans without text layers won't work well
- **Pure diagrams**: Plans relying solely on visual symbols without text annotations may have reduced accuracy
- **Hand-drawn plans**: Sketches without digital text won't be analyzable

### For Best Results
Upload plans that include:
✅ Dimension callouts and measurements
✅ Material specifications in text
✅ Equipment schedules
✅ Notes and legends
✅ Room labels and areas

## Future Enhancements

### Potential Additions
1. **Full Vision Analysis**: Convert PDF pages to images and use GPT-4 Vision API
   - Analyze pure diagrams, symbols, and visual layouts
   - OCR for scanned/image-only PDFs
   - Requires canvas/image processing in Node.js environment
2. **Plan Storage**: Save analyses to database for future reference
3. **Bid Comparison**: Compare AI estimates with actual contractor bids
4. **Export Reports**: Generate PDF reports of analyses
5. **Batch Processing**: Upload and analyze multiple plans at once
6. **Cost Database Integration**: Pull real-time material costs
7. **Regional Adjustments**: Adjust estimates based on location/zip code
8. **Historical Learning**: Learn from past projects to improve accuracy
9. **Interactive Markup**: Allow users to highlight specific areas for detailed analysis
10. **3D Model Integration**: Analyze BIM models or 3D plan files

## Usage

### Accessing the Demo
1. Navigate to `/admin/demo-settings`
2. Click "Launch AI Plan Demo"
3. Or go directly to `/admin/ai-plan-demo`

### Running an Analysis
1. Upload a PDF construction plan
2. Select one or more trade categories
3. Click "Analyze Plan"
4. Wait 30-60 seconds for AI processing
5. Review detailed results for each trade
6. Click "Try Another Plan" to reset

## Notes

- Requires valid OpenAI API key
- Best results with detailed, text-based plans
- Image-only PDFs may not work well (future enhancement needed)
- Analysis quality depends on plan detail quality
- Confidence scores indicate AI's certainty based on available information

## Example Use Cases

### Sales Demos
Show potential clients how AI can accelerate bid generation and reduce manual review time.

### Internal Testing
Test the accuracy of AI-generated estimates against actual contractor bids.

### Training
Train estimators on what details to look for in construction plans.

### Plan Review
Use as a quick sanity check before sending plans to contractors.

