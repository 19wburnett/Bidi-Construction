# 🔧 Enhanced AI Configuration Guide

## 🎯 **Optimal .env Configuration**

Here's what you should set in your `.env` file for maximum flexibility and redundancy:

```bash
# ===========================================
# REQUIRED API KEYS (You have all of these!)
# ===========================================

# OpenAI (Primary provider - GPT-4o, GPT-4-Vision, GPT-4-Turbo)
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic (Claude models - best for code compliance)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Google Gemini (Best for measurements and calculations)
GOOGLE_GEMINI_API_KEY=your_google_gemini_api_key_here

# PDF.co (Required for PDF to image conversion)
PDF_CO_API_KEY=your_pdf_co_api_key_here

# ===========================================
# OPTIONAL API KEYS (For Redundancy)
# ===========================================

# XAI (Grok - Alternative perspective model)
XAI_API_KEY=your_xai_api_key_here

# ===========================================
# MODEL CONFIGURATION (Optional - System Auto-Selects Best Models)
# ===========================================

# OpenAI Model Selection (Optional - defaults to best available)
# You have gpt-5 which is even better than gpt-4o!
OPENAI_MODEL=gpt-5

# Anthropic Model Selection (Optional - defaults to best available)
ANTHROPIC_MODEL=claude-3.5-sonnet

# Google Model Selection (Optional - defaults to best available)
GEMINI_MODEL=gemini-1.5-pro

# XAI Model Selection (Optional - for redundancy)
XAI_MODEL=grok-2

# ===========================================
# SYSTEM CONFIGURATION (Optional)
# ===========================================

# Enable/disable specific providers (for testing or cost control)
ENABLE_OPENAI=true
ENABLE_ANTHROPIC=true
ENABLE_GOOGLE=true
ENABLE_XAI=true

# Consensus threshold (0.6 = 60% of models must agree)
CONSENSUS_THRESHOLD=0.6

# Maximum models to use per analysis (for cost control)
MAX_MODELS_PER_ANALYSIS=5
```

## 🚀 **Recommended Configuration for Your Setup**

Based on your existing keys, here's the optimal configuration:

```bash
# Your existing keys (keep these)
OPENAI_API_KEY=your_existing_key
ANTHROPIC_API_KEY=your_existing_key
GOOGLE_GEMINI_API_KEY=your_existing_key
PDF_CO_API_KEY=your_existing_key
XAI_API_KEY=your_existing_key

# Add these for enhanced system
OPENAI_MODEL=gpt-5                    # You already have this!
ANTHROPIC_MODEL=claude-3.5-sonnet     # Best for code compliance
GEMINI_MODEL=gemini-1.5-pro          # Best for measurements
XAI_MODEL=grok-2                      # Alternative perspective

# Optional system settings
CONSENSUS_THRESHOLD=0.6              # 60% consensus required
MAX_MODELS_PER_ANALYSIS=5             # Use up to 5 models
ENABLE_XAI=true                       # Enable Grok as 6th model
```

## 🎯 **Model Selection Strategy**

### **Don't Set Fixed Models - Let System Auto-Select**

The enhanced system automatically selects the best models for each task:

```typescript
// System automatically routes tasks to best models
const takeoffModels = ['gpt-5', 'gemini-1.5-pro', 'gpt-4-vision']     // Best for measurements
const qualityModels = ['claude-3.5-sonnet', 'gpt-4-turbo']            // Best for issues
const bidModels = ['claude-3-opus', 'gpt-5']                         // Best for pricing
const codeModels = ['claude-3.5-sonnet', 'claude-3-opus']             // Best for compliance
```

### **Redundancy with XAI/Grok**

Since you have `XAI_API_KEY`, we can add Grok as a 6th specialized model:

```typescript
// Enhanced model specializations with XAI
const MODEL_SPECIALIZATIONS = {
  'gpt-5': 'general_construction',           // Your GPT-5 (best overall)
  'claude-3.5-sonnet': 'code_compliance',    // Best at regulations
  'gemini-1.5-pro': 'measurements',         // Best at dimensions
  'gpt-4-vision': 'symbol_recognition',     // Best at reading plans
  'claude-3-opus': 'cost_estimation',       // Best at pricing
  'grok-2': 'alternative_analysis'          // Alternative perspective
}
```

## 🔧 **Flexible Configuration Options**

### **Option 1: Full Auto-Selection (Recommended)**
```bash
# Just set the API keys, let system choose best models
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_GEMINI_API_KEY=your_key
XAI_API_KEY=your_key
# No model specifications - system auto-selects
```

### **Option 2: Specify Primary Models**
```bash
# Set primary models, system uses as fallbacks
OPENAI_MODEL=gpt-5
ANTHROPIC_MODEL=claude-3.5-sonnet
GEMINI_MODEL=gemini-1.5-pro
XAI_MODEL=grok-2
```

### **Option 3: Cost Control Mode**
```bash
# Limit models for cost control
MAX_MODELS_PER_ANALYSIS=3
ENABLE_XAI=false                    # Disable Grok to save costs
CONSENSUS_THRESHOLD=0.5            # Lower consensus threshold
```

## 🎯 **Your Optimal Setup**

Based on your existing keys, here's what I recommend:

```bash
# Keep your existing keys
OPENAI_API_KEY=your_existing_key
ANTHROPIC_API_KEY=your_existing_key
GOOGLE_GEMINI_API_KEY=your_existing_key
PDF_CO_API_KEY=your_existing_key
XAI_API_KEY=your_existing_key

# Add these for enhanced system (optional - system will auto-select)
OPENAI_MODEL=gpt-5                    # You already have this!
ANTHROPIC_MODEL=claude-3.5-sonnet     # Best for code compliance
GEMINI_MODEL=gemini-1.5-pro          # Best for measurements
XAI_MODEL=grok-2                      # Alternative perspective

# System settings (optional)
CONSENSUS_THRESHOLD=0.6              # 60% consensus required
MAX_MODELS_PER_ANALYSIS=5             # Use up to 5 models
ENABLE_XAI=true                       # Enable Grok as 6th model
```

## 🚀 **Benefits of This Configuration**

1. **Flexibility**: System auto-selects best models per task
2. **Redundancy**: 6 models available (including Grok)
3. **Cost Control**: Can limit models if needed
4. **Performance**: GPT-5 + 5 other specialized models
5. **Reliability**: Multiple fallbacks if any model fails

## 🎯 **Next Steps**

1. **Add the optional settings** to your .env (or leave as-is for auto-selection)
2. **Test the system** with a sample plan
3. **Monitor performance** and adjust as needed
4. **Ready for demos** with 6-model consensus system!

Your current setup is already perfect - the optional settings just give you more control over the enhanced system behavior.
