const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/authMiddleware");
const resumeService = require("../services/resumeService");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/resumes");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, `resume-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'), false);
    }
  }
});

// Upload resume
router.post("/upload", authMiddleware, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user.id;
    const file = req.file;

    // Extract text from the uploaded file
    const extractedText = await resumeService.extractTextFromFile(file.path, file.mimetype);
    
    // Parse resume content
    const parsedContent = resumeService.parseResumeContent(extractedText);
    
    // Save to database
    const resume = await resumeService.saveResume(userId, file, extractedText, parsedContent);
    
    res.json({
      message: "Resume uploaded successfully",
      resume: {
        id: resume._id,
        originalName: resume.originalName,
        skills: resume.skills,
        jobTitles: resume.jobTitles,
        uploadedAt: resume.createdAt
      }
    });

  } catch (error) {
    console.error("Resume upload error:", error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: error.message || "Failed to upload resume" 
    });
  }
});

// Get user's active resume
router.get("/active", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const resume = await resumeService.getActiveResume(userId);
    
    if (!resume) {
      return res.json({ 
        hasResume: false, 
        message: "No active resume found" 
      });
    }
    
    res.json({
      hasResume: true,
      resume: {
        id: resume._id,
        originalName: resume.originalName,
        skills: resume.skills,
        jobTitles: resume.jobTitles,
        uploadedAt: resume.createdAt
      }
    });
    
  } catch (error) {
    console.error("Error fetching active resume:", error);
    res.status(500).json({ error: "Failed to fetch resume" });
  }
});

// Get all user resumes
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const resumes = await resumeService.getUserResumes(userId);
    
    res.json({
      resumes: resumes.map(resume => ({
        id: resume._id,
        originalName: resume.originalName,
        skills: resume.skills,
        jobTitles: resume.jobTitles,
        isActive: resume.isActive,
        uploadedAt: resume.createdAt
      }))
    });
    
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

// Delete resume
router.delete("/:resumeId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const resumeId = req.params.resumeId;
    
    await resumeService.deleteResume(resumeId, userId);
    
    res.json({ message: "Resume deleted successfully" });
    
  } catch (error) {
    console.error("Error deleting resume:", error);
    res.status(500).json({ 
      error: error.message || "Failed to delete resume" 
    });
  }
});

// Get job role suggestions based on resume
router.get("/suggestions", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const resume = await resumeService.getActiveResume(userId);
    
    if (!resume) {
      return res.json({ suggestions: [] });
    }
    
    const suggestions = resumeService.suggestJobRoles(resume);
    
    res.json({ suggestions });
    
  } catch (error) {
    console.error("Error getting job suggestions:", error);
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

module.exports = router;
