/**
 * AI Service using Ollama for local LLM inference
 * Provides question generation and feedback analysis
 */

const axios = require('axios');

class AIService {
  constructor() {
    this.ollamaUrl = 'http://localhost:11434'; // Default Ollama port
    this.model = 'llama3.2:3b'; // Lightweight model
    this.isAvailable = false;
    this.checkAvailability();
  }

  /**
   * Check if Ollama is running and model is available
   */
  async checkAvailability() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      const models = response.data.models || [];
      this.isAvailable = models.some(m => m.name.includes('llama3.2'));
      
      if (!this.isAvailable) {
        console.log('⚠️  Ollama not available or model not installed. Using fallback.');
        console.log('💡 To enable AI: Install Ollama and run "ollama pull llama3.2:3b"');
      } else {
        console.log('✅ AI Service ready with Ollama + Llama 3.2');
      }
    } catch (error) {
      this.isAvailable = false;
      console.log('⚠️  Ollama not running. Using rule-based fallback.');
    }
  }

  /**
   * Generate interview questions using AI
   */
  async generateQuestions(jobRole, resumeContent = "", questionCount = 5) {
    if (!this.isAvailable) {
      return this.getFallbackQuestions(jobRole, questionCount);
    }

    try {
      const prompt = this.buildQuestionPrompt(jobRole, resumeContent, questionCount);
      
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 1000
        }
      });

      const generatedText = response.data.response;
      const questions = this.parseQuestions(generatedText);
      
      return questions.length > 0 ? questions : this.getFallbackQuestions(jobRole, questionCount);
      
    } catch (error) {
      console.error('AI question generation failed:', error.message);
      return this.getFallbackQuestions(jobRole, questionCount);
    }
  }

  /**
   * Generate feedback using AI
   */
  async generateFeedback(question, answer, jobRole) {
    if (!this.isAvailable) {
      return this.getFallbackFeedback(answer);
    }

    try {
      const prompt = this.buildFeedbackPrompt(question, answer, jobRole);
      
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent feedback
          max_tokens: 500
        }
      });

      const generatedText = response.data.response;
      return this.parseFeedback(generatedText, answer);
      
    } catch (error) {
      console.error('AI feedback generation failed:', error.message);
      return this.getFallbackFeedback(answer);
    }
  }

  /**
   * Build prompt for question generation
   */
  buildQuestionPrompt(jobRole, resumeContent, questionCount) {
    let prompt = `Generate ${questionCount} professional interview questions for a ${jobRole} position.`;
    
    if (resumeContent && resumeContent.length > 50) {
      prompt += `\n\nCandidate's background:\n${resumeContent.substring(0, 500)}`;
      prompt += `\n\nCreate questions that are relevant to both the role and the candidate's experience.`;
    }
    
    prompt += `\n\nRequirements:
- Mix of behavioral, technical, and situational questions
- Professional and relevant to ${jobRole}
- Each question on a new line starting with "Q:"
- No numbering or extra formatting

Example format:
Q: Tell me about a challenging project you worked on
Q: How do you handle tight deadlines
Q: Describe your experience with [relevant technology]

Generate ${questionCount} questions now:`;

    return prompt;
  }

  /**
   * Build prompt for feedback generation
   */
  buildFeedbackPrompt(question, answer, jobRole) {
    const prompt = `Analyze this interview answer and provide constructive feedback.

Question: ${question}
Answer: ${answer}
Role: ${jobRole}

Provide feedback in this exact format:
SCORE: [1-10]
CONTENT: [1-10] 
CLARITY: [1-10]
CONFIDENCE: [1-10]
PROFESSIONALISM: [1-10]
FEEDBACK: [2-3 sentences of constructive feedback]
SUGGESTIONS: [2-3 specific improvement suggestions, separated by |]

Focus on:
- Content relevance and depth
- Communication clarity
- Professional presentation
- Specific, actionable advice`;

    return prompt;
  }

  /**
   * Parse questions from AI response
   */
  parseQuestions(text) {
    const lines = text.split('\n');
    const questions = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Q:')) {
        const question = trimmed.substring(2).trim();
        if (question.length > 10) {
          questions.push({
            text: question,
            difficulty: this.inferDifficulty(question),
            category: this.inferCategory(question),
            timeLimit: 120
          });
        }
      }
    }
    
    return questions;
  }

  /**
   * Parse feedback from AI response
   */
  parseFeedback(text, originalAnswer) {
    try {
      const lines = text.split('\n');
      let overallScore = 5;
      let scores = { content: 5, clarity: 5, confidence: 5, professionalism: 5 };
      let feedback = "Good response. Keep practicing to improve your interview skills.";
      let suggestions = ["Practice more specific examples", "Work on clear communication"];

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('SCORE:')) {
          overallScore = Math.max(1, Math.min(10, parseInt(trimmed.split(':')[1]) || 5));
        } else if (trimmed.startsWith('CONTENT:')) {
          scores.content = Math.max(1, Math.min(10, parseInt(trimmed.split(':')[1]) || 5));
        } else if (trimmed.startsWith('CLARITY:')) {
          scores.clarity = Math.max(1, Math.min(10, parseInt(trimmed.split(':')[1]) || 5));
        } else if (trimmed.startsWith('CONFIDENCE:')) {
          scores.confidence = Math.max(1, Math.min(10, parseInt(trimmed.split(':')[1]) || 5));
        } else if (trimmed.startsWith('PROFESSIONALISM:')) {
          scores.professionalism = Math.max(1, Math.min(10, parseInt(trimmed.split(':')[1]) || 5));
        } else if (trimmed.startsWith('FEEDBACK:')) {
          feedback = trimmed.substring(9).trim() || feedback;
        } else if (trimmed.startsWith('SUGGESTIONS:')) {
          const suggestionText = trimmed.substring(12).trim();
          if (suggestionText) {
            suggestions = suggestionText.split('|').map(s => s.trim()).filter(s => s.length > 0);
          }
        }
      }

      return {
        overallScore,
        scores,
        feedback,
        suggestions,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('Error parsing AI feedback:', error);
      return this.getFallbackFeedback(originalAnswer);
    }
  }

  /**
   * Infer question difficulty
   */
  inferDifficulty(question) {
    const text = question.toLowerCase();
    if (text.includes('complex') || text.includes('challenging') || text.includes('design') || text.includes('architecture')) {
      return 'hard';
    }
    if (text.includes('experience') || text.includes('approach') || text.includes('handle') || text.includes('manage')) {
      return 'medium';
    }
    return 'easy';
  }

  /**
   * Infer question category
   */
  inferCategory(question) {
    const text = question.toLowerCase();
    if (text.includes('technical') || text.includes('code') || text.includes('system') || text.includes('algorithm')) {
      return 'technical';
    }
    if (text.includes('team') || text.includes('situation') || text.includes('challenge') || text.includes('conflict')) {
      return 'behavioral';
    }
    return 'general';
  }

  /**
   * Fallback questions when AI is not available
   */
  getFallbackQuestions(jobRole, count = 5) {
    const questions = [
      "Tell me about yourself and your background.",
      "What interests you about this role?",
      "Describe a challenging situation you faced and how you handled it.",
      "What are your greatest strengths?",
      "Where do you see yourself in 5 years?",
      "Why are you looking for a new opportunity?",
      "Tell me about a project you're proud of.",
      "How do you handle working under pressure?",
      "Describe your ideal work environment.",
      "What questions do you have for us?"
    ];

    return questions.slice(0, count).map(text => ({
      text,
      difficulty: 'medium',
      category: 'general',
      timeLimit: 120
    }));
  }

  /**
   * Fallback feedback when AI is not available
   */
  getFallbackFeedback(answer) {
    const wordCount = answer.split(/\s+/).length;
    let score = 5;
    let feedback = "Thank you for your response.";

    if (wordCount < 20) {
      score = 4;
      feedback = "Try to provide more detailed answers with specific examples.";
    } else if (wordCount > 100) {
      score = 7;
      feedback = "Good detailed response! Consider being more concise while keeping key points.";
    } else if (answer.toLowerCase().includes('experience') || answer.toLowerCase().includes('project')) {
      score = 8;
      feedback = "Great job mentioning specific experience! This adds credibility to your answer.";
    }

    return {
      overallScore: score,
      scores: {
        content: score,
        clarity: score,
        confidence: score,
        professionalism: score
      },
      feedback,
      suggestions: [
        "Provide specific examples from your experience",
        "Structure your response with clear points",
        "Practice speaking confidently about your achievements"
      ],
      timestamp: new Date()
    };
  }
}

module.exports = new AIService();
