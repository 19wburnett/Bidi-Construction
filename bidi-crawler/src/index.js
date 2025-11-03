import cron from "node-cron";
import { crawlUtahSubcontractors } from "./crawler.js";
import "dotenv/config";

console.log("🎯 Bidi Subcontractor Crawler initialized");
console.log("⏰ Scheduled to run daily at 6:00 AM\n");

// Schedule the crawler to run every day at 6 AM
cron.schedule("0 6 * * *", async () => {
  console.log("⏰ Cron trigger: Starting scheduled crawl...");
  await crawlUtahSubcontractors();
});

// Also run immediately on startup (optional - remove if you don't want this)
console.log("🚀 Running initial crawl now...");
crawlUtahSubcontractors().catch(console.error);

// Keep the process running
console.log("\n💤 Crawler is running in the background...");
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down crawler gracefully...");
  process.exit(0);
});

