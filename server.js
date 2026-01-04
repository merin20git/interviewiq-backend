require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authMiddleware = require("./middleware/authMiddleware");
const InterviewSession = require("./models/interviewSession");
const User = require("./models/user");
const Resume = require("./models/resume");

// Import routes
const authRoutes = require("./routes/auth");
const interviewRoutes = require("./routes/interview");
const resumeRoutes = require("./routes/resume");

const app = express();

// Middleware
// Middleware
// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const corsOptions = {
  origin: [
    "https://interviewiq-frontend-vercel.vercel.app",
    "https://interviewiq-frontend-v2.vercel.app",
    "https://interviewiq-frontend-v2-emlafeqw6-merins-projects-f3e21924.vercel.app",
    "http://localhost:3000"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // ✅ REQUIRED



// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/resume", resumeRoutes);

// Dashboard route - Enhanced with resume info
app.get("/api/dashboard", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get recent interviews with enhanced data (latest 10 for the list)
    const interviews = await InterviewSession.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('resumeId', 'originalName skills')
      .select('role status performance startedAt completedAt questions answers');

    // Compute stats across ALL sessions (not limited to 10)
    const [totalSessionsAgg, completedAgg, weakestAreaAgg] = await Promise.all([
      InterviewSession.countDocuments({ userId: req.user.id }),
      InterviewSession.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.user.id), status: 'completed' } },
        { $group: { _id: null, avgScore: { $avg: '$performance.overallScore' }, count: { $sum: 1 } } }
      ]),
      InterviewSession.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.user.id), status: 'completed' } },
        { $group: { 
          _id: null,
          avgContent: { $avg: '$performance.categoryScores.content' },
          avgClarity: { $avg: '$performance.categoryScores.clarity' },
          avgConfidence: { $avg: '$performance.categoryScores.confidence' },
          avgProfessionalism: { $avg: '$performance.categoryScores.professionalism' }
        }}
      ])
    ]);

    const totalSessions = totalSessionsAgg || 0;
    const completedSessions = (completedAgg && completedAgg[0]?.count) || 0;
    const averageScore = completedSessions > 0
      ? Math.round(((completedAgg[0].avgScore || 0) + Number.EPSILON) * 10) / 10
      : 0;

    // Calculate weakest area
    let weakestArea = null;
    if (completedSessions > 0 && weakestAreaAgg && weakestAreaAgg[0]) {
      const scores = weakestAreaAgg[0];
      const areas = {
        'Content': scores.avgContent,
        'Clarity': scores.avgClarity,
        'Confidence': scores.avgConfidence,
        'Professionalism': scores.avgProfessionalism
      };
      
      // Filter out null/undefined values and find the area with the lowest score
      const validAreas = Object.entries(areas).filter(([_, score]) => score != null && !isNaN(score));
      
      if (validAreas.length > 0) {
        weakestArea = validAreas.reduce((lowest, [area, score]) => 
          score < lowest[1] ? [area, score] : lowest
        )[0];
      }
    }

    // Get active resume
    let activeResume = null;
    try {
      const resume = await Resume.findOne({ 
        userId: req.user.id, 
        isActive: true 
      }).select('originalName skills jobTitles createdAt');
      activeResume = resume;
    } catch (error) {
      console.log("No active resume found");
    }

    // Note: stats computed from all sessions above

    res.json({ 
      user, 
      interviews: interviews.map(interview => ({
        id: interview._id,
        role: interview.role,
        status: interview.status,
        overallScore: interview.performance?.overallScore || 0,
        questionsAnswered: interview.answers?.length || 0,
        totalQuestions: interview.questions?.length || 0,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
        hasResume: !!interview.resumeId
      })),
      activeResume,
      stats: {
        totalSessions,
        completedSessions,
        averageScore,
        weakestArea,
        hasResume: !!activeResume
      }
    });
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// Default route
app.get("/", (req, res) => res.send("Interview Assistant Backend Running ✅"));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
