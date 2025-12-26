import { generateText } from 'ai';
import 'dotenv/config';
 
async function main() {
  // AI SDK automatically detects AI_GATEWAY_API_KEY and AI_GATEWAY_BASE_URL
  // from environment variables when using AI Gateway
  const result = await generateText({
    model: 'openai/gpt-4o', // or 'anthropic/claude-sonnet-4', 'xai/grok-2-1212', etc.
    prompt: 'Invent a new holiday and describe its traditions.',
  });
 
  console.log(result.text);
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
}
 
main().catch(console.error);







