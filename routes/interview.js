const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const authMiddleware = require("../middleware/authMiddleware");
const InterviewSession = require("../models/interviewSession");
const Resume = require("../models/resume");
const User = require("../models/user");

const questionService = require("../services/questionService");
const feedbackService = require("../services/feedbackService");
const resumeService = require("../services/resumeService");
const analyticsService = require("../services/analyticsService");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = file.fieldname === 'resume' ? 'uploads/resumes/' : 'uploads/audio/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'resume') {
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
      }
    } else if (file.fieldname === 'audio') {
      const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid audio file type.'));
      }
    } else {
      cb(null, true);
    }
  }
});

// ==================== RESUME ROUTES ====================

// Upload and parse resume
router.post("/resume/upload", authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded" });
    }

    // Validate file
    const validationErrors = resumeService.validateFile(req.file);
    if (validationErrors.length > 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ errors: validationErrors });
    }

    // Extract text from resume
    const extractedText = await resumeService.extractTextFromFile(req.file.path, req.file.mimetype);
    
    // Parse resume content
    const parsedContent = resumeService.parseResumeContent(extractedText);
    
    // Save to database
    const resume = await resumeService.saveResume(req.user.id, req.file, extractedText, parsedContent);
    
    // Generate job role suggestions
    const suggestedRoles = resumeService.suggestJobRoles(resume);
    
    res.json({
      message: "Resume uploaded and processed successfully",
      resume: {
        id: resume._id,
        filename: resume.originalName,
        skills: resume.skills,
        jobTitles: resume.jobTitles,
        uploadedAt: resume.createdAt
      },
      suggestedRoles,
      extractedSkills: parsedContent.skills.slice(0, 10)
    });

  } catch (error) {
    console.error("Resume upload error:", error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: error.message || "Failed to process resume" });
  }
});

// Get user's resumes
router.get("/resume", authMiddleware, async (req, res) => {
  try {
    const resumes = await resumeService.getUserResumes(req.user.id);
    res.json(resumes);
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

// Get active resume (optional)
router.get("/resume/active", authMiddleware, async (req, res) => {
  try {
    const resume = await resumeService.getActiveResume(req.user.id);
    if (!resume) {
      return res.json({ 
        hasResume: false, 
        message: "No resume uploaded. You can start interviews without a resume!" 
      });
    }
    
    const suggestedRoles = resumeService.suggestJobRoles(resume);
    
    res.json({
      hasResume: true,
      resume: {
        id: resume._id,
        filename: resume.originalName,
        skills: resume.skills,
        jobTitles: resume.jobTitles,
        uploadedAt: resume.createdAt
      },
      suggestedRoles
    });
  } catch (error) {
    console.error("Error fetching active resume:", error);
    res.json({ 
      hasResume: false, 
      message: "No resume found. You can start interviews without a resume!" 
    });
  }
});

// Check resume status
router.get("/resume/status", authMiddleware, async (req, res) => {
  try {
    const resume = await resumeService.getActiveResume(req.user.id);
    res.json({
      hasResume: !!resume,
      resumeCount: await Resume.countDocuments({ userId: req.user.id }),
      message: resume ? "Resume available for enhanced questions" : "No resume uploaded - interviews available with general questions"
    });
  } catch (error) {
    console.error("Error checking resume status:", error);
    res.json({ 
      hasResume: false, 
      resumeCount: 0,
      message: "No resume uploaded - interviews available with general questions"
    });
  }
});

// Delete resume
router.delete("/resume/:id", authMiddleware, async (req, res) => {
  try {
    await resumeService.deleteResume(req.params.id, req.user.id);
    res.json({ message: "Resume deleted successfully" });
  } catch (error) {
    console.error("Error deleting resume:", error);
    res.status(500).json({ error: error.message || "Failed to delete resume" });
  }
});

// ==================== INTERVIEW SESSION ROUTES ====================

// Start new interview session
router.post("/start", authMiddleware, async (req, res) => {
  try {
    const { role, settings = {}, useResume = false } = req.body;
    
    if (!role) {
      return res.status(400).json({ error: "Job role is required" });
    }

    let resumeContent = "";
    let resumeId = null;

    // Get resume content if requested and available
    if (useResume) {
      try {
        const resume = await resumeService.getActiveResume(req.user.id);
        if (resume) {
          resumeContent = resumeService.generateResumeSummary(resume);
          resumeId = resume._id;
        }
      } catch (error) {
        console.log("No resume found, proceeding without resume content");
        // Continue without resume - this is optional
      }
    }

    // Generate AI-powered questions
    const questionCount = settings.questionCount || 5;
    const difficulty = settings.difficulty || 'medium';
    
    const generatedQuestions = await questionService.generateQuestions(role, resumeContent, questionCount, req.user.id);
    
    // Format questions for the schema (generatedQuestions already contains objects)
    const questions = generatedQuestions.map(questionObj => ({
      text: questionObj.text,
      timeLimit: settings.timeLimit || questionObj.timeLimit || 120,
      difficulty: questionObj.difficulty || difficulty,
      category: questionObj.category || (questionService.isTechnicalRole(role) ? 'technical' : 'general')
    }));

    // Create interview session
    const session = new InterviewSession({
      userId: req.user.id,
      resumeId: resumeId,
      role: role,
      questions: questions,
      settings: {
        timeLimit: settings.timeLimit || 120,
        difficulty: difficulty,
        questionCount: questionCount,
        enableVoice: settings.enableVoice !== false
      },
      status: 'active'
    });

    await session.save();

    res.json({
      sessionId: session._id,
      role: role,
      totalQuestions: questions.length,
      currentQuestion: {
        index: 0,
        text: questions[0].text,
        timeLimit: questions[0].timeLimit,
        difficulty: questions[0].difficulty
      },
      settings: session.settings,
      message: "Interview session started successfully"
    });

  } catch (error) {
    console.error("Error starting interview:", error);
    res.status(500).json({ error: "Failed to start interview session" });
  }
});

// Get current question
router.get("/session/:sessionId/question", authMiddleware, async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.id
    });

    if (!session) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    if (session.status === 'completed') {
      console.log("📋 Session already completed, redirecting to summary");
      return res.json({
        completed: true,
        message: "Interview already completed",
        shouldRedirectToSummary: true
      });
    }
    
    if (session.status !== 'active') {
      return res.status(400).json({ error: "Interview session is not active" });
    }

    const currentQuestionIndex = session.answers.length;
    
    if (currentQuestionIndex >= session.questions.length) {
      return res.json({
        completed: true,
        message: "All questions have been answered"
      });
    }

    const currentQuestion = session.questions[currentQuestionIndex];
    
    // Update last activity
    session.lastActivity = new Date();
    await session.save();

    res.json({
      sessionId: session._id,
      questionIndex: currentQuestionIndex,
      totalQuestions: session.questions.length,
      question: {
        index: currentQuestionIndex,
        text: currentQuestion.text,
        timeLimit: currentQuestion.timeLimit,
        difficulty: currentQuestion.difficulty,
        category: currentQuestion.category
      },
      progress: Math.round(((currentQuestionIndex + 1) / session.questions.length) * 100),
      completed: false
    });

  } catch (error) {
    console.error("Error fetching current question:", error);
    res.status(500).json({ error: "Failed to fetch current question" });
  }
});

// Submit text answer
router.post("/session/:sessionId/answer", authMiddleware, async (req, res) => {
  try {
    const { answer, responseTime, isVoiceAnswer, audioFilePath } = req.body;
    
    // Allow empty answers (timer expiration case)
    const finalAnswer = answer ? answer.trim() : "No answer provided";

    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.id
    });

    if (!session) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: "Interview session is not active" });
    }

    const currentQuestionIndex = session.answers.length;
    
    console.log(`📝 Text answer submission: Question ${currentQuestionIndex + 1}/${session.questions.length}`);
    console.log(`📝 Current answers count: ${session.answers.length}`);
    console.log(`📝 Answer preview: "${finalAnswer.substring(0, 50)}..."`);
    
    if (currentQuestionIndex >= session.questions.length) {
      console.log(`❌ All questions already answered: ${currentQuestionIndex}/${session.questions.length}`);
      return res.status(400).json({ error: "All questions have been answered" });
    }

    const currentQuestion = session.questions[currentQuestionIndex];
    
    // Check if this exact answer already exists (prevent duplicates)
    const existingAnswer = session.answers.find(ans => 
      ans.question === currentQuestion.text && ans.answer === finalAnswer
    );
    
    if (existingAnswer) {
      console.log(`⚠️ Duplicate answer detected for question: "${currentQuestion.text.substring(0, 50)}..."`);
      return res.status(400).json({ error: "This answer has already been submitted for this question" });
    }
    
    // Save answer
    session.answers.push({
      question: currentQuestion.text,
      answer: finalAnswer,
      responseTime: responseTime || 0,
      isVoiceAnswer: isVoiceAnswer || false,
      audioFilePath: audioFilePath || undefined
    });
    
    console.log(`✅ Answer saved for question ${currentQuestionIndex + 1}: "${currentQuestion.text.substring(0, 50)}..."`);
    console.log(`📊 Total answers now: ${session.answers.length}/${session.questions.length}`);

    // Generate feedback
    const feedback = await feedbackService.generateFeedback(
      currentQuestion.text,
      finalAnswer,
      session.role
    );

    feedback.questionIndex = currentQuestionIndex;
    feedback.responseTime = responseTime || 0;
    session.feedback.push(feedback);

    // Update last activity
    session.lastActivity = new Date();

    // Check if interview is complete
    const isComplete = session.answers.length >= session.questions.length;
    
    console.log(`📊 Interview progress: ${session.answers.length}/${session.questions.length} questions answered`);
    
    if (isComplete) {
      console.log("✅ Interview completed - marking session as finished");
      session.status = 'completed';
      session.completedAt = new Date();
      session.calculatePerformance();
    }

    await session.save();

    const response = {
      message: "Answer submitted successfully",
      feedback: {
        scores: feedback.scores,
        overallScore: feedback.overallScore,
        feedback: feedback.feedback,
        suggestions: feedback.suggestions
      },
      progress: Math.round((session.answers.length / session.questions.length) * 100),
      completed: isComplete
    };

    if (!isComplete) {
      const nextQuestion = session.questions[session.answers.length];
      response.nextQuestion = {
        index: session.answers.length,
        text: nextQuestion.text,
        timeLimit: nextQuestion.timeLimit,
        difficulty: nextQuestion.difficulty
      };
    } else {
      response.finalResults = {
        overallScore: session.performance.overallScore,
        categoryScores: session.performance.categoryScores,
        totalTime: session.performance.totalTime,
        completionRate: session.performance.completionRate
      };
    }

    res.json(response);

  } catch (error) {
    console.error("Error submitting answer:", error);
    console.error("Error details:", {
      sessionId: req.params.sessionId,
      userId: req.user.id,
      answerLength: req.body.answer?.length || 0,
      error: error.message
    });
    res.status(500).json({ 
      error: "Failed to submit answer",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Submit voice answer
router.post("/session/:sessionId/voice-answer", authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    console.log(`📥 Processing voice answer for question: ${req.body.question || 'Unknown'}`);
    
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }
    
    // Check if there's already a processing request for this session
    const existingProcessing = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.id,
      'processingVoice': true
    });
    
    if (existingProcessing) {
      console.log(`⚠️ Voice processing already in progress for session ${req.params.sessionId}`);
      return res.status(429).json({ error: "Voice processing already in progress. Please wait." });
    }

    const { responseTime } = req.body;
    const audioPath = req.file.path;

    console.log("🔍 Looking for session:", req.params.sessionId, "for user:", req.user.id);
    
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.id
    });

    if (!session) {
      console.log("❌ Session not found");
      // Clean up audio file
      fs.unlinkSync(audioPath);
      return res.status(404).json({ error: "Interview session not found" });
    }

    console.log("📋 Session found:", {
      id: session._id,
      status: session.status,
      lastActivity: session.lastActivity,
      questionsAnswered: session.answers.length,
      totalQuestions: session.questions.length
    });

    if (session.status !== 'active') {
      console.log("❌ Session is not active, status:", session.status);
      fs.unlinkSync(audioPath);
      return res.status(400).json({ error: "Interview session is not active" });
    }

    // Set processing flag to prevent concurrent requests
    session.processingVoice = true;
    session.lastActivity = new Date();
    await session.save();

    const currentQuestionIndex = session.answers.length;
    
    if (currentQuestionIndex >= session.questions.length) {
      fs.unlinkSync(audioPath);
      return res.status(400).json({ error: "All questions have been answered" });
    }

    const currentQuestion = session.questions[currentQuestionIndex];

    console.log("📥 Processing voice answer for question:", currentQuestion.text);

    // Process audio with Python script with timeout
    // Try venv python first, fallback to system python
    const venvPythonExe = process.platform === 'win32' ? 
      path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe') : 
      path.join(__dirname, '..', '.venv', 'bin', 'python');
    
    const systemPythonExe = 'python';
    
    // Check if venv python exists, otherwise use system python
    let pythonExe = systemPythonExe;
    if (fs.existsSync(venvPythonExe)) {
      pythonExe = venvPythonExe;
      console.log("🐍 Using virtual environment Python:", venvPythonExe);
    } else {
      console.log("🐍 Using system Python:", systemPythonExe);
    }
    
    console.log("🎤 Starting audio processing:", { audioPath, questionLength: currentQuestion.text.length });
    
    // Double-check session status right before processing
    const sessionCheck = await InterviewSession.findById(req.params.sessionId);
    console.log("🔍 Final session check before Python:", {
      status: sessionCheck?.status,
      exists: !!sessionCheck,
      lastActivity: sessionCheck?.lastActivity
    });
    
    if (!sessionCheck || sessionCheck.status !== 'active') {
      console.log("❌ Session became inactive before processing");
      fs.unlinkSync(audioPath);
      return res.status(400).json({ error: "Session became inactive during processing" });
    }
    
    const pythonProcess = spawn(pythonExe, ["process_answer.py", audioPath, currentQuestion.text], {
      cwd: __dirname + '/..'
    });
    
    // Track if response was already sent to prevent duplicate responses
    let responseSent = false;
    
    // Set timeout for processing (90 seconds for first-time model download)
    const timeout = setTimeout(() => {
      if (responseSent) return;
      responseSent = true;
      
      pythonProcess.kill();
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      return res.status(500).json({ 
        error: "Audio processing timeout. If this is your first recording, the AI model may still be downloading. Please try again." 
      });
    }, 90000);  // Increased from 30s to 90s for model download

    let output = "";
    let errorOutput = "";
    pythonProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log("🐍 Python stdout:", chunk.trim());
    });
    pythonProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      console.error("🐍 Python stderr:", chunk.trim());
    });
    
    pythonProcess.on("error", (error) => {
      console.error("🐍 Python process error:", error);
      clearTimeout(timeout);
      if (responseSent) return;
      responseSent = true;
      
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      return res.status(500).json({ 
        error: `Python process failed to start: ${error.message}`,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    });

    pythonProcess.on("close", async (code) => {
      clearTimeout(timeout);
      
      // Check if response was already sent (e.g., by timeout)
      if (responseSent) {
        console.log("⚠️ Response already sent, skipping close handler");
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
        return;
      }
      
      // Clean up audio file
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
      if (code !== 0) {
        console.error("Python process failed with code:", code, "Error:", errorOutput);
        
        // Check for specific errors and provide helpful messages
        let errorMessage = "Failed to process audio. Please try again.";
        if (errorOutput.includes("FFmpeg not found")) {
          errorMessage = "FFmpeg not found. Please install FFmpeg and ensure it's in your PATH.";
        } else if (errorOutput.includes("No module named 'faster_whisper'")) {
          errorMessage = "faster-whisper not installed. Please run 'pip install faster-whisper' in your virtual environment.";
        } else if (errorOutput.includes("RuntimeError")) {
          errorMessage = "Audio processing failed. Try a shorter recording or check your microphone.";
        } else if (errorOutput.includes("FileNotFoundError")) {
          errorMessage = "Audio file processing error. Please try recording again.";
        } else if (errorOutput.includes("timeout")) {
          errorMessage = "Audio processing timeout. Please try a shorter recording.";
        }
        
        responseSent = true;
        return res.status(500).json({ 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? errorOutput : undefined,
          transcript: "", // Ensure transcript is empty on error
          canRetry: true
        });
      }

      try {
        const result = JSON.parse(output);
        const transcript = result.transcript;
        const basicFeedback = result.feedback;

        if (!transcript || transcript.trim().length === 0) {
          responseSent = true;
          return res.status(400).json({ error: "Could not transcribe audio. Please try again." });
        }

        // Refresh session to ensure it's still active
        const freshSession = await InterviewSession.findById(req.params.sessionId);
        if (!freshSession || freshSession.status !== 'active') {
          console.log("❌ Session became inactive during processing");
          responseSent = true;
          return res.status(400).json({ error: "Session became inactive during processing" });
        }

        const currentQuestionIndexVoice = freshSession.answers.length;
        console.log(`🎤 Voice answer submission: Question ${currentQuestionIndexVoice + 1}/${freshSession.questions.length}`);
        console.log(`🎤 Current answers count: ${freshSession.answers.length}`);
        console.log(`🎤 Transcript preview: "${transcript.trim().substring(0, 50)}..."`);
        
        if (currentQuestionIndexVoice >= freshSession.questions.length) {
          console.log(`❌ All questions already answered (voice): ${currentQuestionIndexVoice}/${freshSession.questions.length}`);
          responseSent = true;
          return res.status(400).json({ error: "All questions have been answered" });
        }

        // Don't save the answer yet - just return transcript for user review
        // The answer will be saved when user submits via the text submission route
        
        console.log(`✅ Voice transcribed for question ${currentQuestionIndexVoice + 1}: "${currentQuestion.text.substring(0, 50)}..."`);
        console.log(`📝 Transcript ready for review (${transcript.trim().length} chars): "${transcript.trim().substring(0, 50)}..."`);
        console.log(`🔄 Returning transcript to frontend for manual submission`);

        // Clear processing flag and update last activity
        freshSession.processingVoice = false;
        freshSession.lastActivity = new Date();
        await freshSession.save();

        const response = {
          message: "Voice transcribed successfully - please review and submit",
          transcript: transcript,
          audioFilePath: req.file.filename, // Store for later use if needed
          needsSubmission: true // Flag to indicate this needs manual submission
        };

        responseSent = true;
        res.json(response);

      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        // Clear processing flag on error
        try {
          const errorSession = await InterviewSession.findById(req.params.sessionId);
          if (errorSession) {
            errorSession.processingVoice = false;
            await errorSession.save();
          }
        } catch (flagError) {
          console.error("Failed to clear processing flag:", flagError);
        }
        responseSent = true;
        res.status(500).json({ error: "Failed to process voice response" });
      }
    });

  } catch (error) {
    console.error("❌ Voice answer error:", error);
    
    // Clear processing flag on error
    try {
      const errorSession = await InterviewSession.findById(req.params.sessionId);
      if (errorSession) {
        errorSession.processingVoice = false;
        await errorSession.save();
      }
    } catch (flagError) {
      console.error("Failed to clear processing flag:", flagError);
    }
    
    // Clean up audio file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: "Failed to process voice answer" });
  }
});

// Debug session status
router.get("/session/:sessionId/debug", authMiddleware, async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.sessionId);
    const userSession = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.id
    });
    
    res.json({
      sessionExists: !!session,
      userSessionExists: !!userSession,
      sessionStatus: session?.status,
      userSessionStatus: userSession?.status,
      lastActivity: session?.lastActivity,
      userId: req.user.id,
      sessionUserId: session?.userId,
      questionsAnswered: session?.answers?.length || 0,
      totalQuestions: session?.questions?.length || 0,
      isExpired: session?.isExpired?.() || false
    });
  } catch (error) {
    console.error("Debug session error:", error);
    res.status(500).json({ error: "Failed to debug session" });
  }
});

// Get session details
router.get("/session/:sessionId", authMiddleware, async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.id
    }).populate('resumeId', 'originalName skills jobTitles');

    if (!session) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    res.json({
      sessionId: session._id,
      role: session.role,
      status: session.status,
      questions: session.questions,
      answers: session.answers,
      feedback: session.feedback,
      performance: session.performance,
      settings: session.settings,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      duration: session.duration,
      resume: session.resumeId ? {
        filename: session.resumeId.originalName,
        skills: session.resumeId.skills,
        jobTitles: session.resumeId.jobTitles
      } : null
    });

  } catch (error) {
    console.error("Error fetching session details:", error);
    res.status(500).json({ error: "Failed to fetch session details" });
  }
});

// Get all user sessions
router.get("/sessions", authMiddleware, async (req, res) => {
  try {
    const { status, role, limit = 20, page = 1 } = req.query;
    
    const query = { userId: req.user.id };
    if (status) query.status = status;
    if (role) query.role = role;

    const sessions = await InterviewSession.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('role status performance startedAt completedAt createdAt questions answers');

    const total = await InterviewSession.countDocuments(query);

    res.json({
      sessions: sessions.map(session => ({
        id: session._id,
        role: session.role,
        status: session.status,
        overallScore: session.performance.overallScore,
        questionsAnswered: session.answers.length,
        totalQuestions: session.questions.length,
        completionRate: session.performance.completionRate,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        duration: session.duration
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: sessions.length,
        totalSessions: total
      }
    });

  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// ==================== ANALYTICS ROUTES ====================

// Get user analytics
router.get("/analytics", authMiddleware, async (req, res) => {
  try {
    const { timeframe = 'all' } = req.query;
    const analytics = await analyticsService.generateUserAnalytics(req.user.id, timeframe);
    res.json(analytics);
  } catch (error) {
    console.error("Error generating analytics:", error);
    res.status(500).json({ error: "Failed to generate analytics" });
  }
});

// Get session summary/feedback
router.get("/session/:sessionId/summary", authMiddleware, async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.id
    });

    if (!session) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({ error: "Interview session is not completed yet" });
    }

    // Generate comprehensive summary
    const summary = feedbackService.generateInterviewSummary(session.feedback);
    
    res.json({
      sessionId: session._id,
      role: session.role,
      completedAt: session.completedAt,
      duration: session.duration,
      performance: session.performance,
      summary: summary,
      detailedFeedback: session.feedback,
      answers: session.answers,
      questions: session.questions,
      questionsAnswered: session.answers.length,
      totalQuestions: session.questions.length
    });

  } catch (error) {
    console.error("Error generating session summary:", error);
    res.status(500).json({ error: "Failed to generate session summary" });
  }
});

module.exports = router;
