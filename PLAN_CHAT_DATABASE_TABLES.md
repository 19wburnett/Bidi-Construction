# Plan Chat Database Tables - Usage Guide

## Overview

There are two sets of similar tables - one for **chunks** (text storage) and one for **chat history** (conversation storage). Here's what each is used for:

---

## 📄 Text Chunks Tables

### ✅ `plan_text_chunks` (ACTIVE - Used by Plan Chat V3)
**Purpose:** Stores text snippets with vector embeddings for semantic search (RAG)

**Used by:**
- Plan Chat V3 (`lib/plan-chat-v3/retrieval-engine.ts`)
- Plan Chat V2 (`lib/plan-text-chunks.ts`)
- Semantic search via `match_plan_text_chunks()` function

**Features:**
- Has `embedding VECTOR(1536)` for similarity search
- Used for finding relevant blueprint text snippets
- Created by: `/api/plan-text-chunks` endpoint
- Migration: `20251113_plan_text_chunks.sql`

**Status:** ✅ **USE THIS** - This is the active table for Plan Chat

---

### ⚠️ `plan_chunks` (LEGACY - Used by old ingestion system)
**Purpose:** Stores chunks for LLM analysis (not semantic search)

**Used by:**
- Old ingestion system (`lib/ingestion-engine.ts`)
- `/api/ingest` endpoint
- `/api/chunks/[jobId]` endpoint

**Features:**
- Stores chunks as JSONB (not embeddings)
- Used for batch LLM analysis, not real-time chat
- Migration: `20250127_ingestion_chunking_system.sql`

**Status:** ⚠️ **LEGACY** - Still used by ingestion system, but NOT by Plan Chat

**Recommendation:** Keep for now (used by ingestion), but Plan Chat uses `plan_text_chunks` instead

---

## 💬 Chat History Tables

### ✅ `plan_chat_history` (ACTIVE - Used by Plan Chat V3)
**Purpose:** Stores conversation turns with summaries for V3 memory system

**Used by:**
- Plan Chat V3 (`lib/plan-chat-v3/memory.ts`)
- `recordChatTurn()` - Records each conversation turn
- `getRecentConversationContext()` - Retrieves conversation with compression

**Features:**
- Stores `user_message` and `assistant_message` together (one turn per row)
- Has `summary` field for memory compression
- Has `metadata` JSONB for classification/retrieval info
- Migration: `20250130_plan_chat_history.sql`

**Status:** ✅ **USE THIS** - This is the active table for Plan Chat V3

---

### ⚠️ `plan_chat_messages` (LEGACY - Used by Plan Chat V2 + V3 backward compatibility)
**Purpose:** Stores individual messages (user/assistant separate) for V2 system

**Used by:**
- Plan Chat V2 (legacy system)
- Plan Chat V3 (saves here too for backward compatibility with UI)
- `/api/plan-chat` GET endpoint (loads chat history for UI)

**Features:**
- Stores messages separately (`role: 'user' | 'assistant'`)
- Used by UI to display chat history
- Migration: `20250220_plan_chat_messages.sql`

**Status:** ⚠️ **DUAL USE** - V3 saves here for UI compatibility, but uses `plan_chat_history` for memory

**Recommendation:** Keep both - V3 uses `plan_chat_history` for memory, but also saves to `plan_chat_messages` so the UI can display history

---

## Summary Table

| Table | Purpose | Used By | Status |
|-------|---------|---------|--------|
| `plan_text_chunks` | Semantic search (RAG) with embeddings | Plan Chat V2 & V3 | ✅ **ACTIVE** |
| `plan_chunks` | LLM analysis chunks (JSONB) | Old ingestion system | ⚠️ **LEGACY** (keep for ingestion) |
| `plan_chat_history` | V3 conversation memory with summaries | Plan Chat V3 | ✅ **ACTIVE** |
| `plan_chat_messages` | Individual messages for UI | Plan Chat V2 & V3 (UI) | ⚠️ **DUAL USE** (keep for UI) |

---

## Recommendations

### For Plan Chat:
- ✅ Use `plan_text_chunks` for blueprint text retrieval
- ✅ Use `plan_chat_history` for conversation memory
- ✅ Keep saving to `plan_chat_messages` for UI compatibility

### For Cleanup (if needed):
- ⚠️ `plan_chunks` - Keep if you use the ingestion system, otherwise can be deprecated
- ⚠️ `plan_chat_messages` - Keep for UI, but V3 primarily uses `plan_chat_history`

---

## Why Two Chat Tables?

**`plan_chat_history`** (V3):
- Optimized for memory compression
- Stores turns together (user + assistant)
- Has summary field for older conversations
- Better for conversation context retrieval

**`plan_chat_messages`** (V2 + UI):
- Individual messages (easier for UI to display)
- Used by existing UI components
- V3 saves here too for backward compatibility

Both are used, but `plan_chat_history` is the primary source for V3's memory system.

