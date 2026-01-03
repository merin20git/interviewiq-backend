const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Resume = require("../models/resume");

class ResumeService {
  constructor() {
    this.allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
  }

  // Validate uploaded file
  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push("No file uploaded");
      return errors;
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push("Invalid file type. Only PDF and DOCX files are allowed.");
    }

    if (file.size > this.maxFileSize) {
      errors.push("File size too large. Maximum size is 5MB.");
    }

    return errors;
  }

  // Extract text from uploaded resume
  async extractTextFromFile(filePath, mimeType) {
    try {
      let extractedText = "";

      if (mimeType === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
      } else if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      }

      return extractedText.trim();
    } catch (error) {
      console.error("Error extracting text from file:", error);
      throw new Error("Failed to extract text from resume");
    }
  }

  // Parse resume content to extract structured information
  parseResumeContent(text) {
    const parsed = {
      skills: [],
      experience: "",
      education: "",
      jobTitles: []
    };

    try {
      // Extract skills (look for common skill section headers)
      const skillsMatch = text.match(/(?:skills?|technical skills?|core competencies)[:\s]*([\s\S]*?)(?:\n\s*\n|\n[A-Z])/i);
      if (skillsMatch) {
        const skillsText = skillsMatch[1];
        // Extract individual skills (comma-separated or bullet points)
        const skillsArray = skillsText
          .split(/[,\n•·\-\*]/)
          .map(skill => skill.trim())
          .filter(skill => skill.length > 0 && skill.length < 50)
          .slice(0, 20); // Limit to 20 skills
        parsed.skills = [...new Set(skillsArray)]; // Remove duplicates
      }

      // Extract experience section
      const experienceMatch = text.match(/(?:experience|work experience|employment)[:\s]*([\s\S]*?)(?:\n\s*\n(?:education|skills)|$)/i);
      if (experienceMatch) {
        parsed.experience = experienceMatch[1].trim().substring(0, 1000); // Limit length
      }

      // Extract education section
      const educationMatch = text.match(/(?:education|academic background)[:\s]*([\s\S]*?)(?:\n\s*\n(?:experience|skills)|$)/i);
      if (educationMatch) {
        parsed.education = educationMatch[1].trim().substring(0, 500); // Limit length
      }

      // Extract job titles (look for common patterns)
      const jobTitlePatterns = [
        /(?:^|\n)\s*([A-Z][a-z\s]+(?:Engineer|Developer|Manager|Analyst|Specialist|Coordinator|Assistant|Director|Lead|Senior|Junior))/g,
        /(?:position|title|role)[:\s]*([A-Z][a-z\s]+)/gi
      ];

      for (const pattern of jobTitlePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const title = match[1].trim();
          if (title.length > 3 && title.length < 50) {
            parsed.jobTitles.push(title);
          }
        }
      }

      // Remove duplicates and limit job titles
      parsed.jobTitles = [...new Set(parsed.jobTitles)].slice(0, 10);

    } catch (error) {
      console.error("Error parsing resume content:", error);
    }

    return parsed;
  }

  // Save resume to database
  async saveResume(userId, file, extractedText, parsedContent) {
    try {
      // Deactivate previous resumes for this user
      await Resume.updateMany(
        { userId: userId },
        { isActive: false }
      );

      // Create new resume record
      const resume = new Resume({
        userId: userId,
        filename: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        extractedText: extractedText,
        skills: parsedContent.skills,
        experience: parsedContent.experience,
        education: parsedContent.education,
        jobTitles: parsedContent.jobTitles,
        isActive: true
      });

      await resume.save();
      return resume;
    } catch (error) {
      console.error("Error saving resume:", error);
      throw new Error("Failed to save resume to database");
    }
  }

  // Get user's active resume
  async getActiveResume(userId) {
    try {
      const resume = await Resume.findOne({ 
        userId: userId, 
        isActive: true 
      }).sort({ createdAt: -1 });
      
      return resume;
    } catch (error) {
      console.error("Error fetching active resume:", error);
      throw new Error("Failed to fetch resume");
    }
  }

  // Get all resumes for a user
  async getUserResumes(userId) {
    try {
      const resumes = await Resume.find({ userId: userId })
        .sort({ createdAt: -1 })
        .select('-extractedText'); // Exclude large text field for list view
      
      return resumes;
    } catch (error) {
      console.error("Error fetching user resumes:", error);
      throw new Error("Failed to fetch resumes");
    }
  }

  // Delete resume
  async deleteResume(resumeId, userId) {
    try {
      const resume = await Resume.findOne({ 
        _id: resumeId, 
        userId: userId 
      });

      if (!resume) {
        throw new Error("Resume not found");
      }

      // Delete file from filesystem
      if (fs.existsSync(resume.filePath)) {
        fs.unlinkSync(resume.filePath);
      }

      // Delete from database
      await Resume.findByIdAndDelete(resumeId);
      
      return true;
    } catch (error) {
      console.error("Error deleting resume:", error);
      throw new Error("Failed to delete resume");
    }
  }

  // Generate resume summary for question generation
  generateResumeSummary(resume) {
    if (!resume) return "";

    let summary = "";

    if (resume.jobTitles.length > 0) {
      summary += `Job Titles: ${resume.jobTitles.join(", ")}. `;
    }

    if (resume.skills.length > 0) {
      summary += `Skills: ${resume.skills.slice(0, 10).join(", ")}. `;
    }

    if (resume.experience) {
      // Extract first few sentences of experience
      const experienceSummary = resume.experience
        .split(/[.!?]/)
        .slice(0, 3)
        .join(". ");
      summary += `Experience: ${experienceSummary}. `;
    }

    if (resume.education) {
      const educationSummary = resume.education
        .split(/[.!?]/)
        .slice(0, 2)
        .join(". ");
      summary += `Education: ${educationSummary}. `;
    }

    return summary.trim();
  }

  // Suggest job roles based on resume content
  suggestJobRoles(resume) {
    if (!resume) return [];

    const suggestions = new Set();
    
    // Based on job titles
    for (const title of resume.jobTitles) {
      suggestions.add(title);
    }

    // Based on skills
    const skillBasedRoles = this.mapSkillsToRoles(resume.skills);
    for (const role of skillBasedRoles) {
      suggestions.add(role);
    }

    return Array.from(suggestions).slice(0, 5);
  }

  mapSkillsToRoles(skills) {
    const roles = [];
    const skillsLower = skills.map(skill => skill.toLowerCase());

    const roleMapping = {
      'Frontend Developer': ['react', 'vue', 'angular', 'javascript', 'html', 'css', 'typescript'],
      'Backend Developer': ['node.js', 'python', 'java', 'express', 'django', 'spring', 'api'],
      'Full Stack Developer': ['react', 'node.js', 'javascript', 'mongodb', 'mysql', 'express'],
      'Data Scientist': ['python', 'r', 'machine learning', 'pandas', 'numpy', 'tensorflow'],
      'DevOps Engineer': ['docker', 'kubernetes', 'aws', 'jenkins', 'terraform', 'ansible'],
      'Mobile Developer': ['react native', 'flutter', 'swift', 'kotlin', 'android', 'ios'],
      'UI/UX Designer': ['figma', 'sketch', 'adobe', 'photoshop', 'illustrator', 'design'],
      'Project Manager': ['agile', 'scrum', 'jira', 'project management', 'leadership'],
      'QA Engineer': ['testing', 'selenium', 'automation', 'quality assurance', 'cypress']
    };

    for (const [role, requiredSkills] of Object.entries(roleMapping)) {
      const matchCount = requiredSkills.filter(skill => 
        skillsLower.some(userSkill => userSkill.includes(skill))
      ).length;

      if (matchCount >= 2) {
        roles.push(role);
      }
    }

    return roles;
  }

  // Clean up old resume files (utility function)
  async cleanupOldFiles() {
    try {
      const oldResumes = await Resume.find({
        createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days old
        isActive: false
      });

      for (const resume of oldResumes) {
        if (fs.existsSync(resume.filePath)) {
          fs.unlinkSync(resume.filePath);
        }
        await Resume.findByIdAndDelete(resume._id);
      }

      console.log(`Cleaned up ${oldResumes.length} old resume files`);
    } catch (error) {
      console.error("Error cleaning up old files:", error);
    }
  }
}

module.exports = new ResumeService();
