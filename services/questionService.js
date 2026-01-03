const aiService = require('./aiService');

class QuestionService {
  constructor() {
    this.usedQuestions = new Map(); // Track used questions per user to prevent repetition
    this.questionBank = {
      general: [
        "Tell me about yourself.",
        "What are your greatest strengths?",
        "What is your biggest weakness?",
        "Why do you want to work here?",
        "Where do you see yourself in 5 years?",
        "Why are you leaving your current job?",
        "What motivates you?",
        "Describe a challenging situation and how you handled it.",
        "What are your salary expectations?",
        "Do you have any questions for us?"
      ],
      technical: [
        "Explain a complex technical concept to a non-technical person.",
        "Describe your experience with relevant technology.",
        "How do you stay updated with industry trends?",
        "Tell me about a technical challenge you overcame.",
        "What's your approach to debugging?",
        "How do you handle code reviews?",
        "Describe your development process.",
        "What testing strategies do you use?"
      ],
      roleSpecific: {
        "software engineer": [
          "Describe your experience with software development lifecycle.",
          "How do you approach system design?",
          "Tell me about a time you optimized code performance.",
          "How do you handle technical debt?",
          "Explain your experience with version control."
        ],
        "data scientist": [
          "How do you approach a new data science project?",
          "Explain a machine learning model you've implemented.",
          "How do you handle missing or dirty data?",
          "Describe your experience with statistical analysis.",
          "How do you communicate findings to non-technical stakeholders?"
        ],
        "product manager": [
          "How do you prioritize product features?",
          "Describe your experience with user research.",
          "How do you handle conflicting stakeholder requirements?",
          "Tell me about a product launch you managed.",
          "How do you measure product success?"
        ],
        "marketing manager": [
          "How do you develop a marketing strategy?",
          "Describe a successful campaign you managed.",
          "How do you measure marketing ROI?",
          "How do you stay updated with marketing trends?",
          "Tell me about a time you had to pivot a marketing strategy."
        ]
      }
    };
  }

  // Generate questions based on job role and resume
  async generateQuestions(jobRole, resumeContent = "", count = 5, userId = null) {
    try {
      // Try AI generation first, fallback to rule-based
      console.log(`🤖 Generating ${count} questions for ${jobRole} using AI...`);
      const aiQuestions = await aiService.generateQuestions(jobRole, resumeContent, count);
      
      if (aiQuestions && aiQuestions.length >= count) {
        console.log(`✅ AI generated ${aiQuestions.length} questions successfully`);
        return aiQuestions;
      }
      
      // Fallback to rule-based selection
      console.log(`⚠️  AI unavailable, using rule-based question selection`);
      const questions = this.selectSmartQuestions(jobRole, resumeContent, count, userId);
      return questions;
    } catch (error) {
      console.error("Error generating questions:", error);
      return this.getFallbackQuestions(jobRole, count);
    }
  }

  // Smart question selection based on role and resume
  selectSmartQuestions(jobRole, resumeContent = "", count = 5, userId = null) {
    const selectedQuestions = [];
    const roleKey = jobRole.toLowerCase();
    
    // Always include 1-2 general questions
    const generalQuestions = this.getRandomQuestions(this.questionBank.general, 2, userId);
    selectedQuestions.push(...generalQuestions);
    
    // Add role-specific questions if available
    if (this.questionBank.roleSpecific[roleKey]) {
      const roleQuestions = this.getRandomQuestions(this.questionBank.roleSpecific[roleKey], 2, userId);
      selectedQuestions.push(...roleQuestions);
    } else {
      // Add technical questions for technical roles
      const techQuestions = this.getRandomQuestions(this.questionBank.technical, 2, userId);
      selectedQuestions.push(...techQuestions);
    }
    
    // Add resume-based questions if resume content is available
    if (resumeContent && resumeContent.length > 100) {
      const resumeQuestions = this.generateResumeBasedQuestions(resumeContent, jobRole);
      selectedQuestions.push(...resumeQuestions);
    }
    
    // Fill remaining slots with mixed questions
    const remaining = count - selectedQuestions.length;
    if (remaining > 0) {
      const mixedQuestions = this.getRandomQuestions([
        ...this.questionBank.general,
        ...this.questionBank.technical
      ], remaining, userId);
      selectedQuestions.push(...mixedQuestions);
    }
    
    // Ensure uniqueness and return requested count
    const uniqueQuestions = [...new Set(selectedQuestions)];
    return uniqueQuestions.slice(0, count).map(text => ({
      text,
      difficulty: this.getDifficulty(text),
      category: this.getCategory(text),
      timeLimit: 120 // 2 minutes default
    }));
  }

  // Get random questions from a pool, avoiding used questions per user
  getRandomQuestions(questionPool, count, userId = null) {
    if (!userId) {
      // If no userId, just return random questions without tracking
      const shuffled = [...questionPool].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    }
    
    // Get user's used questions set
    if (!this.usedQuestions.has(userId)) {
      this.usedQuestions.set(userId, new Set());
    }
    const userUsedQuestions = this.usedQuestions.get(userId);
    
    // Filter out already used questions for this user
    const availableQuestions = questionPool.filter(q => !userUsedQuestions.has(q));
    
    // If we've used all questions, reset the user's set (allow repetition after full cycle)
    if (availableQuestions.length === 0) {
      console.log(`🔄 User ${userId} has used all questions, resetting question pool`);
      userUsedQuestions.clear();
      return this.getRandomQuestions(questionPool, count, userId);
    }
    
    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    
    // Mark selected questions as used for this user
    selected.forEach(q => userUsedQuestions.add(q));
    
    return selected;
  }
  
  // Clear used questions for a specific user (useful for testing or reset)
  clearUserQuestions(userId) {
    if (this.usedQuestions.has(userId)) {
      this.usedQuestions.get(userId).clear();
      console.log(`🧹 Cleared question history for user ${userId}`);
    }
  }

  // Generate resume-based questions
  generateResumeBasedQuestions(resumeContent, jobRole) {
    const questions = [];
    const content = resumeContent.toLowerCase();
    
    // Look for specific technologies, skills, or experiences
    if (content.includes('project')) {
      questions.push("Tell me about a significant project you worked on.");
    }
    if (content.includes('team') || content.includes('lead')) {
      questions.push("Describe your experience working in teams or leading others.");
    }
    if (content.includes('problem') || content.includes('challenge')) {
      questions.push("Give me an example of a complex problem you solved.");
    }
    
    return questions.slice(0, 1); // Return max 1 resume-based question
  }

  // Determine question difficulty
  getDifficulty(questionText) {
    const text = questionText.toLowerCase();
    if (text.includes('complex') || text.includes('challenging') || text.includes('design')) {
      return 'hard';
    }
    if (text.includes('experience') || text.includes('approach') || text.includes('handle')) {
      return 'medium';
    }
    return 'easy';
  }

  // Categorize questions
  getCategory(questionText) {
    const text = questionText.toLowerCase();
    if (text.includes('technical') || text.includes('code') || text.includes('system')) {
      return 'technical';
    }
    if (text.includes('team') || text.includes('situation') || text.includes('challenge')) {
      return 'behavioral';
    }
    return 'general';
  }

  // Fallback questions when other methods fail
  getFallbackQuestions(jobRole, count = 5) {
    const fallbackQuestions = [
      "Tell me about yourself.",
      "What are your greatest strengths?",
      "Why do you want to work here?",
      "Describe a challenging situation you faced.",
      "Where do you see yourself in 5 years?"
    ];
    
    return fallbackQuestions.slice(0, count).map(text => ({
      text,
      difficulty: 'medium',
      category: 'general',
      timeLimit: 120
    }));
  }

  // Check if role is technical
  isTechnicalRole(role) {
    const technicalRoles = [
      'software engineer', 'developer', 'programmer', 'data scientist',
      'devops', 'system administrator', 'database administrator',
      'qa engineer', 'test engineer', 'technical lead', 'architect'
    ];
    
    return technicalRoles.some(techRole => 
      role.toLowerCase().includes(techRole)
    );
  }
}

module.exports = new QuestionService();
