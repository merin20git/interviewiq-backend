const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  filename: { 
    type: String, 
    required: true 
  },
  originalName: { 
    type: String, 
    required: true 
  },
  filePath: { 
    type: String, 
    required: true 
  },
  fileSize: { 
    type: Number, 
    required: true 
  },
  mimeType: { 
    type: String, 
    required: true 
  },
  extractedText: { 
    type: String, 
    default: "" 
  },
  skills: { 
    type: [String], 
    default: [] 
  },
  experience: { 
    type: String, 
    default: "" 
  },
  education: { 
    type: String, 
    default: "" 
  },
  jobTitles: { 
    type: [String], 
    default: [] 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

// Index for faster queries
ResumeSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model("Resume", ResumeSchema);
