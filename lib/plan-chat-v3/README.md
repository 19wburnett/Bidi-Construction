# Plan Chat V3 - Cursor-Style Copilot System

Plan Chat V3 transforms the current "Plan Chat" (which acts like a one-shot Q&A tool) into a true persistent, reasoning copilot that behaves more like Cursor.

## Features

- **Persistent Conversation Memory**: Remembers previous conversation turns and can reference them naturally
- **Enhanced Retrieval System (RAG++)**: Multi-layer retrieval combining semantic search, target-based matching, dependency-based retrieval, and project metadata
- **Dual System Prompting**: Two distinct modes - Takeoff Mode (strict, deterministic) and Copilot Mode (reasoning, collaborative)
- **Project Context Builder**: Assembles comprehensive context from all available sources
- **Answer Engine**: Orchestrates the complete flow from classification to final answer

## Architecture

### 1. Conversation Memory Layer (`memory.ts`)

Stores conversation history with compression:
- `recordChatTurn()`: Records a conversation turn
- `generateConversationSummary()`: Compresses older conversations
- `getRecentConversationContext()`: Retrieves recent context with compression

### 2. Enhanced Retrieval System (`retrieval-engine.ts`)

Multi-layer retrieval:
- **Semantic RAG**: Vector similarity search over blueprint chunks (10-12 chunks)
- **Target-Based Retrieval**: Fuzzy matching of takeoff items by targets
- **Dependency-Based Retrieval**: Finds related sheets/pages automatically
- **Project Metadata Retrieval**: Pulls global project information

### 3. Project Context Builder (`context-builder.ts`)

Assembles structured JSON context from:
- Recent conversation memory
- Project metadata
- Semantic chunks
- Takeoff matches
- Related sheets
- Classification output

### 4. Dual System Prompting (`prompts.ts`)

Two distinct modes:

**TAKEOFF MODE** (Strict):
- Used for `TAKEOFF_COST`, `TAKEOFF_QUANTITY`, or `strict_takeoff_only = true`
- No speculation, only grounded numeric results
- Crisp, literal, deterministic

**COPILOT MODE** (Reasoning):
- Used for `OTHER`, `COMBINED`, or strategic questions
- Can reason about scope, identify missing items, suggest quality checks
- Explains reasoning, discusses alternatives, acts like a teammate

### 5. Answer Engine (`answer-engine.ts`)

Orchestrates the complete flow:
1. Classify the question
2. Build comprehensive context
3. Choose system prompt (takeoff vs copilot)
4. Construct final prompt
5. Call LLM
6. Persist to memory
7. Return final answer with metadata

## Usage

```typescript
import { generateAnswer } from '@/lib/plan-chat-v3'

const result = await generateAnswer(
  supabase,
  planId,
  userId,
  jobId,
  userQuestion
)

// result contains:
// - answer: string
// - classification: PlanChatQuestionClassification
// - mode: 'TAKEOFF' | 'COPILOT'
// - metadata: retrieval stats and context size
```

## Database Schema

### `plan_chat_history` table

Stores conversation history with summaries:
- `id`: UUID primary key
- `plan_id`: References plans table
- `user_id`: References auth.users
- `job_id`: References jobs table
- `user_message`: User's message
- `assistant_message`: Assistant's reply
- `summary`: Compressed summary (optional, for older conversations)
- `metadata`: JSONB for additional metadata
- `created_at`: Timestamp

## Environment Variables

- `PLAN_CHAT_V3_ENABLED`: Enable/disable V3 (default: true)
- `PLAN_CHAT_V3_DEBUG`: Enable debug logging (default: false, or true in development)
- `OPENAI_API_KEY`: Required for LLM calls
- `OPENAI_MODEL`: Model to use (default: 'gpt-4o-mini')

## Migration

Run the migration to create the `plan_chat_history` table:

```bash
# Migration file: supabase/migrations/20250130_plan_chat_history.sql
```

## Debugging

Enable debug logging by setting `PLAN_CHAT_V3_DEBUG=true` or running in development mode.

Debug logs include:
- Classification results
- Mode selection
- Retrieval statistics
- Context building information
- Answer generation metrics

## Backward Compatibility

V3 is enabled by default but can be disabled by setting `PLAN_CHAT_V3_ENABLED=false`. The legacy V2 system is still available for backward compatibility.

V3 also saves to the legacy `plan_chat_messages` table for backward compatibility with existing UI components.

