# User Questions Answered

## Q: Do I need to stay on the same page that I hit run ai takeoff on in order for it to finish? Or once I hit the button can I move around and trust it'll be back?

**Short Answer:** You can navigate away - the analysis continues in the background.

**Long Answer:**

### How It Works:
1. **On-click:** PDF conversion and API call start in the browser
2. **If you navigate away:** The request continues on the server
3. **Results saved:** Analysis results are saved to database (always)
4. **What you'll see:**
   - If you stay on page: Progress bar → Results appear when done
   - If you leave and come back: Results already in database, just need to refresh/load

### Important Notes:
- ✅ **Server-side:** API calls are handled server-side, independent of browser
- ✅ **Database:** All results are saved to `plan_takeoff_analysis` and `plan_quality_analysis` tables
- ✅ **Reload:** When you return to the page, results auto-load from database
- ⚠️ **Progress bar:** If you navigate away, you'll lose the progress bar (frontend state)
- ⚠️ **Notifications:** If queue fails → you won't see the error immediately

### Best Practice:
**Recommended:** Stay on the page for small/medium PDFs (<50 pages):
- See progress bar
- Get instant results when done
- Can see any errors immediately

**For large PDFs (>50 pages):**
- Might be queued anyway
- Takes 2-3+ hours
- You'll get email notification
- Safe to navigate away

### What Happens If You Leave:
1. Server continues processing
2. Results are saved to DB
3. When you come back, page loads latest results from DB
4. Might miss a momentary error message (but it's still logged in Vercel)

### Our New Queue Fallback:
With the latest fix, even if there's an error:
- System automatically queues the request
- You get "Queued" message instead of error
- Navigate away safely - you'll get email notification
- Better than showing "Failed" error!

## Summary
**You CAN navigate away** - the analysis will continue and results will be saved. However, staying on the page gives you the best experience (progress updates, instant results).

