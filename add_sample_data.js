require("dotenv").config();
const mongoose = require("mongoose");
const InterviewSession = require("./models/interviewSession");
const User = require("./models/user");

async function addSampleData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find your user (replace with your actual email)
    const userEmail = "test@example.com"; // Change this to your email
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log("❌ User not found. Please register first or update the email in this script.");
      return;
    }

    console.log(`📝 Adding sample data for user: ${user.name}`);

    // Create sample completed interview sessions
    const sampleSessions = [
      {
        userId: user._id,
        role: "Software Engineer",
        questions: [
          { text: "Tell me about yourself", timeLimit: 120, difficulty: "easy", category: "general" },
          { text: "What's your experience with JavaScript?", timeLimit: 120, difficulty: "medium", category: "technical" },
          { text: "Describe a challenging project", timeLimit: 120, difficulty: "medium", category: "behavioral" }
        ],
        answers: [
          { question: "Tell me about yourself", answer: "I'm a passionate software developer with 3 years of experience in web development.", responseTime: 45 },
          { question: "What's your experience with JavaScript?", answer: "I have extensive experience with JavaScript, including React, Node.js, and modern ES6+ features.", responseTime: 60 },
          { question: "Describe a challenging project", answer: "I worked on a real-time chat application that required optimizing WebSocket connections for 1000+ concurrent users.", responseTime: 75 }
        ],
        feedback: [
          {
            questionIndex: 0,
            scores: { content: 8, clarity: 7, confidence: 8, professionalism: 9 },
            overallScore: 8,
            feedback: "Great introduction with relevant experience mentioned.",
            suggestions: ["Add more specific technical details", "Mention key achievements"]
          },
          {
            questionIndex: 1,
            scores: { content: 9, clarity: 8, confidence: 7, professionalism: 8 },
            overallScore: 8,
            feedback: "Excellent technical knowledge demonstration.",
            suggestions: ["Provide specific project examples", "Mention learning experiences"]
          },
          {
            questionIndex: 2,
            scores: { content: 9, clarity: 8, confidence: 8, professionalism: 8 },
            overallScore: 8,
            feedback: "Strong example of problem-solving skills.",
            suggestions: ["Quantify the impact", "Explain the technical solution"]
          }
        ],
        status: "completed",
        performance: {
          overallScore: 8.0,
          categoryScores: {
            content: 8.7,
            clarity: 7.7,
            confidence: 7.7,
            professionalism: 8.3
          },
          totalTime: 180,
          averageResponseTime: 60,
          completionRate: 100
        },
        startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 180000) // 3 minutes later
      },
      {
        userId: user._id,
        role: "Frontend Developer",
        questions: [
          { text: "What's your experience with React?", timeLimit: 120, difficulty: "medium", category: "technical" },
          { text: "How do you handle state management?", timeLimit: 120, difficulty: "hard", category: "technical" }
        ],
        answers: [
          { question: "What's your experience with React?", answer: "I've been working with React for 2 years, building responsive web applications.", responseTime: 50 },
          { question: "How do you handle state management?", answer: "I use Redux for complex state and Context API for simpler cases.", responseTime: 65 }
        ],
        feedback: [
          {
            questionIndex: 0,
            scores: { content: 7, clarity: 8, confidence: 6, professionalism: 8 },
            overallScore: 7,
            feedback: "Good technical foundation, could use more specific examples.",
            suggestions: ["Mention specific React features used", "Discuss performance optimizations"]
          },
          {
            questionIndex: 1,
            scores: { content: 8, clarity: 7, confidence: 7, professionalism: 8 },
            overallScore: 7,
            feedback: "Shows understanding of different state management approaches.",
            suggestions: ["Compare pros/cons of different approaches", "Mention when to use each"]
          }
        ],
        status: "completed",
        performance: {
          overallScore: 7.0,
          categoryScores: {
            content: 7.5,
            clarity: 7.5,
            confidence: 6.5,
            professionalism: 8.0
          },
          totalTime: 115,
          averageResponseTime: 57,
          completionRate: 100
        },
        startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 115000) // ~2 minutes later
      }
    ];

    // Insert sample sessions
    for (const sessionData of sampleSessions) {
      const session = new InterviewSession(sessionData);
      await session.save();
      console.log(`✅ Created sample session: ${sessionData.role}`);
    }

    console.log("🎉 Sample data added successfully!");
    console.log("💡 Now visit your dashboard to see the progress visualization!");
    
  } catch (error) {
    console.error("❌ Error adding sample data:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

addSampleData();
