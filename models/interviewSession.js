// models/interviewSession.js
const mongoose = require("mongoose");

const InterviewSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume" },
  role: { type: String, required: true },
  questions: { 
    type: [{
      text: { type: String, required: true },
      timeLimit: { type: Number, default: 120 }, // seconds
      difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
      category: { type: String, default: 'general' }
    }], 
    default: [] 
  },
  answers: {
    type: [
      {
        question: String,
        answer: String,
        responseTime: Number, // seconds taken to answer
        timestamp: { type: Date, default: Date.now },
        isVoiceAnswer: { type: Boolean, default: false },
        audioFilePath: String
      }
    ],
    default: []
  },
  feedback: {
    type: [{
      questionIndex: Number,
      scores: {
        content: { type: Number, min: 1, max: 10 },
        clarity: { type: Number, min: 1, max: 10 },
        confidence: { type: Number, min: 1, max: 10 },
        professionalism: { type: Number, min: 1, max: 10 }
      },
      overallScore: { type: Number, min: 1, max: 10 },
      feedback: String,
      suggestions: [String],
      strengths: [String],
      improvements: [String],
      wordCount: Number,
      responseTime: Number
    }],
    default: []
  },
  status: { 
    type: String, 
    enum: ['active', 'completed', 'abandoned'], 
    default: 'active' 
  },
  settings: {
    timeLimit: { type: Number, default: 120 }, // default time per question
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    questionCount: { type: Number, default: 5 },
    enableVoice: { type: Boolean, default: true }
  },
  performance: {
    overallScore: { type: Number, default: 0 },
    categoryScores: {
      content: { type: Number, default: 0 },
      clarity: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      professionalism: { type: Number, default: 0 }
    },
    totalTime: { type: Number, default: 0 }, // total time spent
    averageResponseTime: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  lastActivity: { type: Date, default: Date.now },
  processingVoice: { type: Boolean, default: false }
}, { 
  timestamps: true 
});

// Indexes for better performance
InterviewSessionSchema.index({ userId: 1, status: 1 });
InterviewSessionSchema.index({ createdAt: -1 });
InterviewSessionSchema.index({ role: 1 });

// Virtual for duration
InterviewSessionSchema.virtual('duration').get(function() {
  if (this.completedAt && this.startedAt) {
    return Math.round((this.completedAt - this.startedAt) / 1000); // in seconds
  }
  return null;
});

// Method to calculate performance metrics
InterviewSessionSchema.methods.calculatePerformance = function() {
  // Always calculate completion rate regardless of feedback
  this.performance.completionRate = Math.round((this.answers.length / this.questions.length) * 100);
  
  // Only calculate other metrics if feedback exists
  if (this.feedback.length === 0) return;

  const totalFeedback = this.feedback.length;
  let totalOverallScore = 0;
  let categoryTotals = { content: 0, clarity: 0, confidence: 0, professionalism: 0 };
  let totalResponseTime = 0;

  this.feedback.forEach(fb => {
    totalOverallScore += fb.overallScore || 0;
    totalResponseTime += fb.responseTime || 0;
    
    Object.keys(categoryTotals).forEach(category => {
      categoryTotals[category] += fb.scores[category] || 0;
    });
  });

  this.performance.overallScore = Math.round((totalOverallScore / totalFeedback) * 10) / 10;
  this.performance.averageResponseTime = Math.round(totalResponseTime / totalFeedback);

  Object.keys(categoryTotals).forEach(category => {
    this.performance.categoryScores[category] = Math.round((categoryTotals[category] / totalFeedback) * 10) / 10;
  });
};

// Method to check if session is expired (inactive for more than 1 hour)
InterviewSessionSchema.methods.isExpired = function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.status === 'active' && this.lastActivity < oneHourAgo;
};

module.exports = mongoose.model("InterviewSession", InterviewSessionSchema);
