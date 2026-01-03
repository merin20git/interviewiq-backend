const InterviewSession = require("../models/interviewSession");

class AnalyticsService {
  constructor() {
    this.performanceMetrics = {
      excellent: { min: 9, label: "Excellent", color: "#4CAF50" },
      good: { min: 7, label: "Good", color: "#8BC34A" },
      average: { min: 5, label: "Average", color: "#FFC107" },
      needsImprovement: { min: 3, label: "Needs Improvement", color: "#FF9800" },
      poor: { min: 0, label: "Poor", color: "#F44336" }
    };
  }

  // Generate comprehensive analytics for a user
  async generateUserAnalytics(userId, timeframe = 'all') {
    try {
      const sessions = await this.getUserSessions(userId, timeframe);
      
      if (sessions.length === 0) {
        return this.getEmptyAnalytics();
      }

      const analytics = {
        overview: this.generateOverview(sessions),
        performance: this.generatePerformanceAnalytics(sessions),
        trends: this.generateTrendAnalytics(sessions),
        skills: this.generateSkillsAnalytics(sessions),
        recommendations: this.generateRecommendations(sessions),
        timeframe: timeframe,
        lastUpdated: new Date()
      };

      return analytics;
    } catch (error) {
      console.error("Error generating user analytics:", error);
      throw new Error("Failed to generate analytics");
    }
  }

  async getUserSessions(userId, timeframe) {
    let dateFilter = {};
    
    switch (timeframe) {
      case 'week':
        dateFilter = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case 'month':
        dateFilter = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '3months':
        dateFilter = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
        break;
      default:
        dateFilter = {}; // All time
    }

    const query = { userId };
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }

    return await InterviewSession.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email');
  }

  generateOverview(sessions) {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const totalQuestions = sessions.reduce((sum, s) => sum + (s.answers?.length || 0), 0);
    const averageQuestionsPerSession = totalSessions > 0 ? Math.round(totalQuestions / totalSessions) : 0;

    // Calculate average scores
    const allScores = sessions
      .filter(s => s.feedback && s.feedback.length > 0)
      .flatMap(s => s.feedback.map(f => f.overallScore || 0));
    
    const averageScore = allScores.length > 0 
      ? Math.round((allScores.reduce((sum, score) => sum + score, 0) / allScores.length) * 10) / 10
      : 0;

    // Most practiced roles
    const roleCounts = {};
    sessions.forEach(s => {
      roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
    });
    
    const topRoles = Object.entries(roleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([role, count]) => ({ role, count }));

    return {
      totalSessions,
      completedSessions,
      totalQuestions,
      averageQuestionsPerSession,
      averageScore,
      topRoles,
      completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0
    };
  }

  generatePerformanceAnalytics(sessions) {
    const completedSessions = sessions.filter(s => s.feedback && s.feedback.length > 0);
    
    if (completedSessions.length === 0) {
      return {
        categoryAverages: { content: 0, clarity: 0, confidence: 0, professionalism: 0 },
        performanceDistribution: {},
        bestPerformingAreas: [],
        improvementAreas: [],
        scoreHistory: []
      };
    }

    // Calculate category averages
    const categoryTotals = { content: 0, clarity: 0, confidence: 0, professionalism: 0 };
    const categoryCount = { content: 0, clarity: 0, confidence: 0, professionalism: 0 };

    completedSessions.forEach(session => {
      session.feedback.forEach(feedback => {
        if (feedback.scores) {
          Object.entries(feedback.scores).forEach(([category, score]) => {
            if (categoryTotals.hasOwnProperty(category)) {
              categoryTotals[category] += score;
              categoryCount[category]++;
            }
          });
        }
      });
    });

    const categoryAverages = {};
    Object.keys(categoryTotals).forEach(category => {
      categoryAverages[category] = categoryCount[category] > 0 
        ? Math.round((categoryTotals[category] / categoryCount[category]) * 10) / 10
        : 0;
    });

    // Performance distribution
    const allScores = completedSessions.flatMap(s => 
      s.feedback.map(f => f.overallScore || 0)
    );

    const performanceDistribution = {};
    Object.entries(this.performanceMetrics).forEach(([key, metric]) => {
      performanceDistribution[key] = {
        count: 0,
        percentage: 0,
        label: metric.label,
        color: metric.color
      };
    });

    allScores.forEach(score => {
      const category = this.getPerformanceCategory(score);
      performanceDistribution[category].count++;
    });

    // Calculate percentages
    const totalScores = allScores.length;
    Object.keys(performanceDistribution).forEach(key => {
      performanceDistribution[key].percentage = totalScores > 0 
        ? Math.round((performanceDistribution[key].count / totalScores) * 100)
        : 0;
    });

    // Best performing and improvement areas
    const sortedCategories = Object.entries(categoryAverages)
      .sort(([,a], [,b]) => b - a);
    
    const bestPerformingAreas = sortedCategories
      .filter(([, score]) => score >= 7)
      .slice(0, 2)
      .map(([category, score]) => ({ category, score }));

    const improvementAreas = sortedCategories
      .filter(([, score]) => score < 7)
      .slice(-2)
      .map(([category, score]) => ({ category, score }));

    // Score history (last 10 sessions)
    const scoreHistory = completedSessions
      .slice(0, 10)
      .reverse()
      .map(session => {
        const sessionAverage = session.feedback.length > 0
          ? session.feedback.reduce((sum, f) => sum + (f.overallScore || 0), 0) / session.feedback.length
          : 0;
        
        return {
          date: session.createdAt,
          score: Math.round(sessionAverage * 10) / 10,
          role: session.role
        };
      });

    return {
      categoryAverages,
      performanceDistribution,
      bestPerformingAreas,
      improvementAreas,
      scoreHistory
    };
  }

  generateTrendAnalytics(sessions) {
    if (sessions.length < 2) {
      return {
        improvement: 0,
        trend: 'stable',
        consistencyScore: 0,
        streaks: { current: 0, longest: 0 }
      };
    }

    // Calculate improvement trend
    const recentSessions = sessions.slice(0, 5);
    const olderSessions = sessions.slice(-5);

    const recentAverage = this.calculateSessionsAverage(recentSessions);
    const olderAverage = this.calculateSessionsAverage(olderSessions);

    const improvement = Math.round((recentAverage - olderAverage) * 10) / 10;
    
    let trend = 'stable';
    if (improvement > 0.5) trend = 'improving';
    else if (improvement < -0.5) trend = 'declining';

    // Calculate consistency (standard deviation of scores)
    const allScores = sessions
      .filter(s => s.feedback && s.feedback.length > 0)
      .map(s => s.feedback.reduce((sum, f) => sum + (f.overallScore || 0), 0) / s.feedback.length);

    const consistencyScore = this.calculateConsistency(allScores);

    // Calculate streaks (consecutive sessions above average)
    const streaks = this.calculateStreaks(allScores);

    return {
      improvement,
      trend,
      consistencyScore,
      streaks
    };
  }

  generateSkillsAnalytics(sessions) {
    const skillsData = {};
    
    sessions.forEach(session => {
      const role = session.role;
      if (!skillsData[role]) {
        skillsData[role] = {
          sessions: 0,
          totalScore: 0,
          averageScore: 0,
          lastPracticed: session.createdAt
        };
      }
      
      skillsData[role].sessions++;
      
      if (session.feedback && session.feedback.length > 0) {
        const sessionAverage = session.feedback.reduce((sum, f) => sum + (f.overallScore || 0), 0) / session.feedback.length;
        skillsData[role].totalScore += sessionAverage;
      }
      
      if (session.createdAt > skillsData[role].lastPracticed) {
        skillsData[role].lastPracticed = session.createdAt;
      }
    });

    // Calculate averages and sort by performance
    const skillsArray = Object.entries(skillsData).map(([role, data]) => ({
      role,
      sessions: data.sessions,
      averageScore: data.sessions > 0 ? Math.round((data.totalScore / data.sessions) * 10) / 10 : 0,
      lastPracticed: data.lastPracticed,
      proficiency: this.getSkillProficiency(data.totalScore / data.sessions)
    })).sort((a, b) => b.averageScore - a.averageScore);

    return {
      skillsBreakdown: skillsArray,
      strongestSkills: skillsArray.slice(0, 3),
      skillsNeedingWork: skillsArray.filter(s => s.averageScore < 7).slice(0, 3)
    };
  }

  generateRecommendations(sessions) {
    const recommendations = [];
    const performance = this.generatePerformanceAnalytics(sessions);
    const trends = this.generateTrendAnalytics(sessions);

    // Based on performance
    if (performance.categoryAverages.content < 6) {
      recommendations.push({
        type: 'improvement',
        category: 'content',
        message: 'Focus on providing more detailed and relevant examples in your answers.',
        priority: 'high'
      });
    }

    if (performance.categoryAverages.clarity < 6) {
      recommendations.push({
        type: 'improvement',
        category: 'clarity',
        message: 'Practice structuring your responses with clear introduction, body, and conclusion.',
        priority: 'high'
      });
    }

    if (performance.categoryAverages.confidence < 6) {
      recommendations.push({
        type: 'improvement',
        category: 'confidence',
        message: 'Work on reducing filler words and speaking with more conviction.',
        priority: 'medium'
      });
    }

    // Based on trends
    if (trends.trend === 'declining') {
      recommendations.push({
        type: 'alert',
        category: 'performance',
        message: 'Your recent performance shows a declining trend. Consider reviewing feedback and practicing more.',
        priority: 'high'
      });
    }

    if (trends.consistencyScore < 0.5) {
      recommendations.push({
        type: 'improvement',
        category: 'consistency',
        message: 'Your performance varies significantly. Focus on consistent preparation and practice.',
        priority: 'medium'
      });
    }

    // Practice frequency recommendations
    const daysSinceLastSession = sessions.length > 0 
      ? Math.floor((Date.now() - new Date(sessions[0].createdAt)) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSinceLastSession > 7) {
      recommendations.push({
        type: 'practice',
        category: 'frequency',
        message: 'It\'s been a while since your last practice. Regular practice helps maintain and improve skills.',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  // Helper methods
  getPerformanceCategory(score) {
    for (const [key, metric] of Object.entries(this.performanceMetrics)) {
      if (score >= metric.min) {
        return key;
      }
    }
    return 'poor';
  }

  calculateSessionsAverage(sessions) {
    const scores = sessions
      .filter(s => s.feedback && s.feedback.length > 0)
      .flatMap(s => s.feedback.map(f => f.overallScore || 0));
    
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  calculateConsistency(scores) {
    if (scores.length < 2) return 1;
    
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Convert to consistency score (0-1, where 1 is most consistent)
    return Math.max(0, 1 - (standardDeviation / 5));
  }

  calculateStreaks(scores) {
    if (scores.length === 0) return { current: 0, longest: 0 };
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < scores.length; i++) {
      if (scores[i] >= average) {
        tempStreak++;
        if (i === 0) currentStreak = tempStreak;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 0;
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak);
    
    return { current: currentStreak, longest: longestStreak };
  }

  getSkillProficiency(score) {
    if (score >= 8) return 'Expert';
    if (score >= 7) return 'Advanced';
    if (score >= 6) return 'Intermediate';
    if (score >= 4) return 'Beginner';
    return 'Novice';
  }

  getEmptyAnalytics() {
    return {
      overview: {
        totalSessions: 0,
        completedSessions: 0,
        totalQuestions: 0,
        averageQuestionsPerSession: 0,
        averageScore: 0,
        topRoles: [],
        completionRate: 0
      },
      performance: {
        categoryAverages: { content: 0, clarity: 0, confidence: 0, professionalism: 0 },
        performanceDistribution: {},
        bestPerformingAreas: [],
        improvementAreas: [],
        scoreHistory: []
      },
      trends: {
        improvement: 0,
        trend: 'stable',
        consistencyScore: 0,
        streaks: { current: 0, longest: 0 }
      },
      skills: {
        skillsBreakdown: [],
        strongestSkills: [],
        skillsNeedingWork: []
      },
      recommendations: [{
        type: 'practice',
        category: 'getting-started',
        message: 'Start your first interview practice session to begin tracking your progress!',
        priority: 'high'
      }],
      timeframe: 'all',
      lastUpdated: new Date()
    };
  }

  // Generate comparison analytics between users (for admin/insights)
  async generateComparisonAnalytics(userIds) {
    try {
      const comparisons = [];
      
      for (const userId of userIds) {
        const analytics = await this.generateUserAnalytics(userId);
        comparisons.push({
          userId,
          averageScore: analytics.overview.averageScore,
          totalSessions: analytics.overview.totalSessions,
          categoryAverages: analytics.performance.categoryAverages
        });
      }

      return {
        users: comparisons,
        benchmarks: this.calculateBenchmarks(comparisons)
      };
    } catch (error) {
      console.error("Error generating comparison analytics:", error);
      throw new Error("Failed to generate comparison analytics");
    }
  }

  calculateBenchmarks(comparisons) {
    if (comparisons.length === 0) return {};

    const averageScore = comparisons.reduce((sum, c) => sum + c.averageScore, 0) / comparisons.length;
    const averageSessions = comparisons.reduce((sum, c) => sum + c.totalSessions, 0) / comparisons.length;

    return {
      averageScore: Math.round(averageScore * 10) / 10,
      averageSessions: Math.round(averageSessions),
      topPerformer: comparisons.reduce((top, current) => 
        current.averageScore > top.averageScore ? current : top
      )
    };
  }
}

module.exports = new AnalyticsService();
