# Quick Start Guide: AI Takeoff System

## 🚀 Getting Started in 5 Minutes

### Step 1: Run Database Migration

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `supabase-migration-takeoffs.sql`
4. Click "Run" to execute the migration
5. Verify tables were created successfully

### Step 2: Verify Environment Variables

Check your `.env.local` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=sk-your-openai-key
```

### Step 3: Install Dependencies (if needed)

The required packages should already be installed, but verify:

```bash
npm install react-pdf pdfjs-dist openai
```

### Step 4: Test the System

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the takeoff section:**
   - Login to your dashboard
   - Go to `/dashboard/takeoff`
   - Click "New Takeoff"

3. **Create a test takeoff:**
   - Select a project with plan files
   - Choose a plan
   - Name it "Test Takeoff"
   - Enable "Run AI Analysis"
   - Click "Create Takeoff"

4. **Wait for AI analysis:**
   - Should take 30-60 seconds
   - You'll see items populate automatically

5. **Test features:**
   - ✅ View items in the sidebar
   - ✅ Edit an item's quantity or cost
   - ✅ See the item highlighted on the PDF
   - ✅ Ask the AI chat a question
   - ✅ Add a manual item
   - ✅ Save a version

## 🎯 What You Can Do Now

### Create Your First Real Takeoff

1. **Upload a Construction Plan**
   - Go to Dashboard → New Job
   - Upload your construction PDF
   - Fill in project details

2. **Generate Takeoff**
   - Navigate to Takeoff section
   - Click "New Takeoff"
   - Select your project
   - Enable AI Analysis
   - Create!

3. **Review AI Results**
   - Check detected items
   - Verify quantities
   - Adjust unit costs
   - Add missing items

4. **Collaborate**
   - Share the takeoff link with team members
   - See live presence indicators
   - Edit simultaneously
   - Use comments to discuss items

5. **Use AI Assistant**
   - Ask questions like:
     - "What's the total cost?"
     - "How much drywall do I need?"
     - "Am I missing any electrical items?"

## 📊 Sample Workflow

### For an Electrical Contractor

1. Create takeoff from electrical plans
2. AI detects: outlets, switches, fixtures, panels
3. Review and adjust quantities
4. Apply your custom pricing
5. Ask AI: "What materials am I missing?"
6. Export to CSV for purchasing
7. Share with project manager

### For a General Contractor

1. Create takeoffs for each trade
2. Use AI to get initial estimates
3. Invite subcontractors to review
4. Discuss quantities in comments
5. Compare versions over time
6. Generate reports for clients

## 🐛 Common Issues & Solutions

### "AI Analysis Failed"

**Cause**: OpenAI API key missing or invalid

**Fix**:
```bash
# Verify your .env.local has OPENAI_API_KEY
# Get a new key from: https://platform.openai.com/api-keys
```

### "No items detected"

**Cause**: Plan quality or format issue

**Fix**:
- Use high-resolution plans (300+ DPI)
- Ensure text is readable
- Try with a different plan
- Add items manually

### "Real-time not working"

**Cause**: Supabase real-time not enabled

**Fix**:
1. Go to Supabase Dashboard
2. Settings → API
3. Enable "Realtime"
4. Restart your dev server

### "PDF won't load"

**Cause**: Worker not configured

**Fix**:
1. Check `public/pdf.worker.min.js` exists
2. Or set in component:
   ```typescript
   pdfjs.GlobalWorkerOptions.workerSrc = 
     `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`
   ```

## 🎓 Learn More

### Understanding AI Detection

The AI looks for:
- **Structural**: Walls, floors, ceilings
- **Electrical**: Outlets, switches, lights
- **Plumbing**: Fixtures, pipes
- **HVAC**: Units, ducts
- **Finishes**: Drywall, paint, flooring
- **Concrete**: Slabs, footings
- **Openings**: Doors, windows

Each item includes:
- Type and description
- Quantity and unit
- Suggested location
- Confidence score

### Using the Chat Assistant

The AI has context about:
- All items in your takeoff
- Quantities by category
- Cost calculations
- Material standards

Ask it:
- Questions about your data
- Calculations (totals, averages)
- Material suggestions
- Industry best practices

### Collaboration Features

- **Live Presence**: See who's viewing
- **Auto-Save**: Changes sync instantly
- **Version Control**: Create snapshots
- **Comments**: Discuss specific items
- **Audit Trail**: Track who changed what

## 📱 Next Steps

1. **Customize Cost Templates**
   - Add your standard pricing
   - Create templates by trade
   - Share with team

2. **Integrate with Projects**
   - Link takeoffs to jobs
   - Track across workflow
   - Compare bid vs. actual

3. **Train Your Team**
   - Share this guide
   - Schedule demo session
   - Create internal standards

4. **Optimize Workflow**
   - Set up templates
   - Define approval process
   - Establish naming conventions

## 🎉 You're Ready!

You now have a fully functional AI-powered takeoff system. Start creating takeoffs, experimenting with the AI, and streamlining your estimation process.

**Need Help?**
- Check `TAKEOFF_SYSTEM_README.md` for detailed docs
- Review sample queries in the chat
- Test with different plan types

**Pro Tips:**
- Use descriptive takeoff names
- Save versions before major changes
- Ask AI specific questions
- Review confidence scores on AI items
- Export regularly for backups

Happy estimating! 🚀

