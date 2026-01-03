/**
 * Feedback Service - AI-powered feedback generation with rule-based fallback
 * Uses Ollama for local AI inference, falls back to deterministic logic
 */

const aiService = require('./aiService');

class FeedbackService {
  /**
   * Generate comprehensive feedback for an interview answer
   * @param {string} question - The interview question
   * @param {string} answer - The candidate's answer
   * @param {string} role - The job role being interviewed for
   * @returns {Object} Feedback object with scores and text
   */
  async generateFeedback(question, answer, role) {
    try {
      if (!answer || answer.trim().length === 0) {
        return this.generateBasicFeedback("No answer provided");
      }

      const answerText = answer.trim();
      
      // Try AI feedback first
      console.log(`🤖 Generating AI feedback for answer...`);
      const aiFeedback = await aiService.generateFeedback(question, answerText, role);
      
      if (aiFeedback && aiFeedback.overallScore) {
        console.log(`✅ AI feedback generated successfully (Score: ${aiFeedback.overallScore}/10)`);
        return aiFeedback;
      }
      
      // Fallback to rule-based feedback
      console.log(`⚠️  AI unavailable, using rule-based feedback`);
      return this.generateRuleBasedFeedback(question, answerText, role);
      
    } catch (error) {
      console.error("Error generating feedback:", error);
      return this.generateBasicFeedback("Error processing answer");
    }
  }

  /**
   * Generate rule-based feedback as fallback
   */
  generateRuleBasedFeedback(question, answerText, role) {
    // Calculate various scores
    const contentScore = this.calculateContentScore(answerText, question);
    const clarityScore = this.calculateClarityScore(answerText);
    const confidenceScore = this.calculateConfidenceScore(answerText);
    const professionalismScore = this.calculateProfessionalismScore(answerText);
    
    // Calculate overall score (weighted average) - convert to 1-10 scale
    const overallScore = Math.round(
      ((contentScore * 0.4 + clarityScore * 0.25 + confidenceScore * 0.2 + professionalismScore * 0.15) / 100) * 9 + 1
    );

    // Generate feedback text
    const feedbackText = this.generateFeedbackText(
      overallScore,
      contentScore,
      clarityScore,
      confidenceScore,
      professionalismScore,
      answerText
    );

    // Generate suggestions
    const suggestions = this.generateSuggestions(
      contentScore,
      clarityScore,
      confidenceScore,
      professionalismScore,
      role
    );

    return {
      overallScore,
      scores: {
        content: Math.round((contentScore / 100) * 9 + 1),
        clarity: Math.round((clarityScore / 100) * 9 + 1),
        confidence: Math.round((confidenceScore / 100) * 9 + 1),
        professionalism: Math.round((professionalismScore / 100) * 9 + 1)
      },
      feedback: feedbackText,
      suggestions,
      timestamp: new Date()
    };
  }

  /**
   * Calculate content relevance score based on answer length and keywords
   */
  calculateContentScore(answer, question) {
    const wordCount = answer.split(/\s+/).length;
    let score = 50; // Base score

    // Length scoring
    if (wordCount >= 50 && wordCount <= 200) {
      score += 30; // Good length
    } else if (wordCount >= 20 && wordCount < 50) {
      score += 20; // Acceptable length
    } else if (wordCount < 20) {
      score += 10; // Too short
    } else {
      score += 15; // Too long
    }

    // Keyword relevance (basic check)
    const questionWords = question.toLowerCase().split(/\s+/);
    const answerWords = answer.toLowerCase().split(/\s+/);
    const relevantWords = questionWords.filter(word => 
      word.length > 3 && answerWords.includes(word)
    );
    
    score += Math.min(relevantWords.length * 5, 20);

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate clarity score based on sentence structure and filler words
   */
  calculateClarityScore(answer) {
    let score = 70; // Base score

    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = answer.length / sentences.length;

    // Sentence length scoring
    if (avgSentenceLength >= 50 && avgSentenceLength <= 150) {
      score += 20;
    } else if (avgSentenceLength < 50 || avgSentenceLength > 150) {
      score += 10;
    }

    // Check for filler words
    const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually'];
    const fillerCount = fillerWords.reduce((count, filler) => {
      return count + (answer.toLowerCase().match(new RegExp(filler, 'g')) || []).length;
    }, 0);

    score -= Math.min(fillerCount * 5, 30);

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate confidence score based on language patterns
   */
  calculateConfidenceScore(answer) {
    let score = 70; // Base score

    // Positive indicators
    const confidenceWords = ['confident', 'sure', 'definitely', 'absolutely', 'certainly'];
    const confidenceCount = confidenceWords.reduce((count, word) => {
      return count + (answer.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);

    score += Math.min(confidenceCount * 10, 20);

    // Negative indicators
    const uncertainWords = ['maybe', 'perhaps', 'might', 'possibly', 'not sure', 'i think'];
    const uncertainCount = uncertainWords.reduce((count, word) => {
      return count + (answer.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);

    score -= Math.min(uncertainCount * 8, 25);

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate professionalism score based on language and tone
   */
  calculateProfessionalismScore(answer) {
    let score = 80; // Base score

    // Check for professional language
    const professionalWords = ['experience', 'skills', 'expertise', 'professional', 'team', 'project'];
    const professionalCount = professionalWords.reduce((count, word) => {
      return count + (answer.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);

    score += Math.min(professionalCount * 5, 15);

    // Check for unprofessional elements
    const casualWords = ['yeah', 'gonna', 'wanna', 'kinda', 'sorta'];
    const casualCount = casualWords.reduce((count, word) => {
      return count + (answer.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);

    score -= Math.min(casualCount * 10, 25);

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Generate descriptive feedback text based on scores
   */
  generateFeedbackText(overallScore, contentScore, clarityScore, confidenceScore, professionalismScore, answer) {
    let feedback = [];

    // Overall assessment
    if (overallScore >= 85) {
      feedback.push("Excellent response! You demonstrated strong interview skills.");
    } else if (overallScore >= 70) {
      feedback.push("Good response with room for improvement.");
    } else if (overallScore >= 55) {
      feedback.push("Decent response, but several areas need attention.");
    } else {
      feedback.push("This response needs significant improvement.");
    }

    // Specific feedback based on scores
    if (contentScore < 60) {
      feedback.push("Your answer could be more relevant to the question asked.");
    }
    
    if (clarityScore < 60) {
      feedback.push("Try to structure your thoughts more clearly and reduce filler words.");
    }
    
    if (confidenceScore < 60) {
      feedback.push("Show more confidence in your responses and avoid uncertain language.");
    }
    
    if (professionalismScore < 70) {
      feedback.push("Use more professional language and terminology.");
    }

    // Positive reinforcement
    const strengths = [];
    if (contentScore >= 80) strengths.push("content relevance");
    if (clarityScore >= 80) strengths.push("clear communication");
    if (confidenceScore >= 80) strengths.push("confident delivery");
    if (professionalismScore >= 80) strengths.push("professional tone");

    if (strengths.length > 0) {
      feedback.push(`Strong points: ${strengths.join(", ")}.`);
    }

    return feedback.join(" ");
  }

  /**
   * Generate improvement suggestions based on scores
   */
  generateSuggestions(contentScore, clarityScore, confidenceScore, professionalismScore, role) {
    const suggestions = [];

    if (contentScore < 70) {
      suggestions.push("Provide more specific examples and details relevant to the question");
      suggestions.push("Structure your answer with clear points (e.g., situation, action, result)");
    }

    if (clarityScore < 70) {
      suggestions.push("Practice speaking more slowly and clearly");
      suggestions.push("Organize your thoughts before speaking");
      suggestions.push("Reduce use of filler words like 'um', 'uh', 'like'");
    }

    if (confidenceScore < 70) {
      suggestions.push("Use more assertive language and avoid phrases like 'I think' or 'maybe'");
      suggestions.push("Practice your responses to build confidence");
    }

    if (professionalismScore < 70) {
      suggestions.push("Use industry-specific terminology when appropriate");
      suggestions.push("Maintain a professional tone throughout your response");
    }

    // Role-specific suggestions
    if (role) {
      const roleSpecific = this.getRoleSpecificSuggestions(role.toLowerCase());
      suggestions.push(...roleSpecific);
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Get role-specific suggestions
   */
  getRoleSpecificSuggestions(role) {
    const suggestions = {
      'software engineer': [
        "Mention specific technologies and programming languages",
        "Discuss problem-solving approaches and technical challenges"
      ],
      'data scientist': [
        "Reference data analysis methodologies and tools",
        "Discuss statistical concepts and machine learning approaches"
      ],
      'product manager': [
        "Focus on user needs and business impact",
        "Mention cross-functional collaboration and stakeholder management"
      ],
      'marketing': [
        "Discuss campaign metrics and ROI",
        "Reference target audience analysis and market research"
      ]
    };

    for (const [key, roleSuggestions] of Object.entries(suggestions)) {
      if (role.includes(key)) {
        return roleSuggestions;
      }
    }

    return ["Relate your experience to the specific role requirements"];
  }

  /**
   * Generate basic feedback for edge cases
   */
  generateBasicFeedback(message) {
    return {
      overallScore: 3, // Convert to 1-10 scale
      scores: {
        content: 3,
        clarity: 3,
        confidence: 3,
        professionalism: 3
      },
      feedback: message || "Please provide a more complete response to the question.",
      suggestions: [
        "Take time to think about your answer before responding",
        "Provide specific examples from your experience",
        "Structure your response clearly"
      ],
      timestamp: new Date()
    };
  }

  /**
   * Generate interview summary from all feedback
   */
  generateInterviewSummary(feedbackArray) {
    if (!feedbackArray || feedbackArray.length === 0) {
      return {
        overallScore: 0,
        totalQuestions: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ["Complete more interview questions to get a comprehensive assessment"]
      };
    }

    // Calculate overall statistics
    const totalQuestions = feedbackArray.length;
    const averageScore = Math.round(
      feedbackArray.reduce((sum, feedback) => sum + feedback.overallScore, 0) / totalQuestions
    );

    // Analyze score patterns
    const scoresByCategory = {
      content: feedbackArray.map(f => f.scores.content),
      clarity: feedbackArray.map(f => f.scores.clarity),
      confidence: feedbackArray.map(f => f.scores.confidence),
      professionalism: feedbackArray.map(f => f.scores.professionalism)
    };

    const averagesByCategory = {};
    const strengths = [];
    const weaknesses = [];

    for (const [category, scores] of Object.entries(scoresByCategory)) {
      const avg = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      averagesByCategory[category] = avg;

      if (avg >= 7) {
        strengths.push(category.charAt(0).toUpperCase() + category.slice(1));
      } else if (avg < 5) {
        weaknesses.push(category.charAt(0).toUpperCase() + category.slice(1));
      }
    }

    // Generate highly specific recommendations based on actual performance
    const recommendations = [];
    
    // Analyze specific performance patterns
    const contentAvg = averagesByCategory.content || 0;
    const clarityAvg = averagesByCategory.clarity || 0;
    const confidenceAvg = averagesByCategory.confidence || 0;
    const professionalismAvg = averagesByCategory.professionalism || 0;
    
    // Overall performance with specific score context
    if (averageScore >= 8) {
      recommendations.push(`Excellent performance (${averageScore}/10)! You're interview-ready with strong professional skills.`);
    } else if (averageScore >= 6) {
      recommendations.push(`Good foundation (${averageScore}/10). Focus on raising your lowest scoring areas to reach excellence.`);
    } else if (averageScore >= 4) {
      recommendations.push(`Fair performance (${averageScore}/10). With targeted practice on weak areas, you can significantly improve.`);
    } else {
      recommendations.push(`Needs improvement (${averageScore}/10). Focus on fundamentals: clear answers with specific examples.`);
    }

    // Highly specific recommendations based on individual category scores
    if (contentAvg < 5) {
      recommendations.push(`Content (${contentAvg}/10): Use the STAR method (Situation, Task, Action, Result) to structure your answers with concrete examples.`);
    } else if (contentAvg >= 7) {
      recommendations.push(`Strong content delivery (${contentAvg}/10)! Your examples are relevant and well-detailed.`);
    }
    
    if (clarityAvg < 5) {
      recommendations.push(`Clarity (${clarityAvg}/10): Practice speaking slower, pause between points, and organize thoughts before answering.`);
    } else if (clarityAvg >= 7) {
      recommendations.push(`Excellent communication clarity (${clarityAvg}/10)! Your answers are well-structured and easy to follow.`);
    }
    
    if (confidenceAvg < 5) {
      recommendations.push(`Confidence (${confidenceAvg}/10): Practice common questions aloud, maintain eye contact, and reduce filler words like "um" and "uh".`);
    } else if (confidenceAvg >= 7) {
      recommendations.push(`Great confidence level (${confidenceAvg}/10)! You present yourself professionally and assertively.`);
    }
    
    if (professionalismAvg < 5) {
      recommendations.push(`Professionalism (${professionalismAvg}/10): Use industry terminology, maintain formal tone, and avoid casual language.`);
    } else if (professionalismAvg >= 7) {
      recommendations.push(`Strong professional presence (${professionalismAvg}/10)! Your communication style is appropriate and polished.`);
    }

    // Performance pattern analysis
    const scoreRange = Math.max(...Object.values(averagesByCategory)) - Math.min(...Object.values(averagesByCategory));
    if (scoreRange > 3) {
      recommendations.push(`Inconsistent performance across areas (${scoreRange} point spread). Focus on your weakest category for balanced improvement.`);
    }
    
    // Question count specific advice
    if (totalQuestions < 3) {
      recommendations.push(`Complete ${5 - totalQuestions} more questions to unlock comprehensive performance analytics and personalized coaching tips.`);
    }

    // Prioritize most actionable recommendations
    const prioritizedRecommendations = [];
    
    // Always include overall performance assessment first
    if (recommendations.length > 0) {
      prioritizedRecommendations.push(recommendations[0]);
    }
    
    // Add specific category recommendations for lowest scoring areas first
    const categoryRecs = recommendations.slice(1).filter(rec => rec.includes('/10'));
    const otherRecs = recommendations.slice(1).filter(rec => !rec.includes('/10'));
    
    // Sort category recommendations by score (lowest first for improvement focus)
    categoryRecs.sort((a, b) => {
      const scoreA = parseInt(a.match(/\((\d+)\/10\)/)?.[1] || '10');
      const scoreB = parseInt(b.match(/\((\d+)\/10\)/)?.[1] || '10');
      return scoreA - scoreB;
    });
    
    // Combine prioritized recommendations
    prioritizedRecommendations.push(...categoryRecs.slice(0, 2)); // Top 2 category issues
    prioritizedRecommendations.push(...otherRecs.slice(0, 1)); // 1 other recommendation
    
    return {
      overallScore: averageScore,
      totalQuestions,
      averagesByCategory,
      strengths: strengths.length > 0 ? strengths : ["Consistent effort"],
      weaknesses: weaknesses.length > 0 ? weaknesses : [],
      recommendations: prioritizedRecommendations.slice(0, 4) // Max 4 recommendations
    };
  }
}

module.exports = new FeedbackService();
