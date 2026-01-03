# AI Setup Guide for InterviewIQ

Your InterviewIQ project now supports **real AI-powered question generation and feedback** using free, local AI models!

## 🚀 Quick Setup (Recommended: Ollama)

### Step 1: Install Ollama
1. **Download Ollama**: Go to [ollama.ai](https://ollama.ai) and download for Windows
2. **Install**: Run the installer (it's completely free)
3. **Verify**: Open Command Prompt and type `ollama --version`

### Step 2: Install AI Model
```bash
# Install lightweight Llama 3.2 model (2GB)
ollama pull llama3.2:3b

# Or for better quality (4GB)
ollama pull llama3.2:7b
```

### Step 3: Start Ollama Service
```bash
# Ollama usually starts automatically, but if needed:
ollama serve
```

### Step 4: Test Your Setup
1. Start your backend: `node server.js`
2. Look for: `✅ AI Service ready with Ollama + Llama 3.2`
3. Start an interview - questions will now be AI-generated!

## 🎯 What You Get

### **AI-Generated Questions**
- **Personalized**: Based on job role and resume content
- **Dynamic**: Different questions every time
- **Contextual**: Relevant to candidate's background

### **AI-Powered Feedback**
- **Detailed Analysis**: Content, clarity, confidence, professionalism scores
- **Constructive Feedback**: Specific, actionable advice
- **Professional**: Industry-standard interview evaluation

## 🔄 Fallback System

**Don't worry!** If AI isn't available, the system automatically falls back to:
- Rule-based question selection
- Algorithmic feedback scoring
- Your interview still works perfectly

## 🆓 Alternative Free AI Options

### Option 2: Hugging Face API (Free Tier)
```javascript
// In aiService.js, replace Ollama config with:
const HF_API_KEY = 'your_free_hf_token'; // Get from huggingface.co
const HF_MODEL = 'microsoft/DialoGPT-medium';
```

### Option 3: Google Gemini API (Free Tier)
```javascript
// 15 requests/minute free
const GEMINI_API_KEY = 'your_free_gemini_key';
```

### Option 4: Cohere API (Free Tier)
```javascript
// Good for text generation
const COHERE_API_KEY = 'your_free_cohere_key';
```

## 🛠️ Troubleshooting

### "AI Service not available"
- Check if Ollama is running: `ollama list`
- Restart Ollama: `ollama serve`
- Verify model is installed: `ollama list`

### "Model not found"
```bash
# Pull the model again
ollama pull llama3.2:3b
```

### Performance Issues
- Use smaller model: `llama3.2:1b` (1GB)
- Increase timeout in aiService.js
- Check system RAM (8GB+ recommended)

## 📊 Performance Comparison

| Model | Size | Speed | Quality | RAM Needed |
|-------|------|-------|---------|------------|
| llama3.2:1b | 1GB | Fast | Good | 4GB |
| llama3.2:3b | 2GB | Medium | Better | 8GB |
| llama3.2:7b | 4GB | Slower | Best | 16GB |

## 🎉 Success Indicators

When AI is working, you'll see:
```
🤖 Generating 5 questions for Software Engineer using AI...
✅ AI generated 5 questions successfully
🤖 Generating AI feedback for answer...
✅ AI feedback generated successfully (Score: 8/10)
```

## 💡 Pro Tips

1. **First Run**: AI model download happens automatically but takes time
2. **Internet**: Only needed for initial model download
3. **Privacy**: All AI processing happens locally on your machine
4. **Cost**: Completely free, no API keys or usage limits!

---

**Your InterviewIQ is now powered by real AI! 🚀**

Questions will be unique, personalized, and contextual.
Feedback will be detailed, constructive, and professional.
