# InterviewIQ Backend - AI-Powered Interview Simulation

A comprehensive backend system for AI-powered interview simulation with optional resume upload, real-time feedback, and performance analytics.

## 🚀 Features

### Core Features
- **🎙️ AI-Driven Question Generation**: Ollama with Llama 3.2 generates personalized questions based on job role and resume
- **🗣️ Speech-to-Text**: OpenAI Whisper API for voice answer transcription
- **💬 AI Feedback**: Detailed performance analysis with scoring
- **📊 Analytics**: Comprehensive performance tracking and insights
- **⏱️ Time Management**: Configurable time limits per question
- **🔄 Session Management**: Resume, pause, and complete interviews

### Optional Resume Features
- **📄 Resume Upload**: PDF/DOCX support with text extraction
- **🧠 Smart Parsing**: Extract skills, experience, education automatically
- **🎯 Enhanced Questions**: Resume-based personalized questions
- **💡 Job Suggestions**: AI-powered role recommendations

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud)
- Python 3.8+ with required packages
- Ollama with Llama 3.2 model

## 🛠️ Installation

### 1. Clone and Install Dependencies
```bash
cd interviewIQ-backend
npm install
```

### 2. Environment Setup
Create a `.env` file:
```env
MONGO_URI=mongodb://localhost:27017/interviewiq
PORT=5000
JWT_SECRET=your_jwt_secret_here
```

### 3. Python Dependencies
```bash
pip install faster-whisper
```

### 4. Ollama Setup
- Install Ollama from: https://ollama.ai/
- Pull the required model: `ollama pull llama3.2:3b`
- Ensure Ollama is running on port 11434 (default)

### 5. Create Upload Directories
```bash
mkdir uploads
mkdir uploads/resumes
mkdir uploads/audio
```

## 🚀 Running the Application

### Start Backend Server
```bash
npm start
# or
node server.js
```

Server will run on `http://localhost:5000`

### Start Frontend (separate terminal)
```bash
cd ../interview_iq-frontend
npm start
```

Frontend will run on `http://localhost:3000`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/dashboard` - User dashboard with stats

### Resume Management (Optional)
- `POST /api/interview/resume/upload` - Upload resume (PDF/DOCX)
- `GET /api/interview/resume/status` - Check if user has resume
- `GET /api/interview/resume/active` - Get active resume
- `DELETE /api/interview/resume/:id` - Delete resume

### Interview Sessions
- `POST /api/interview/start` - Start new interview
- `GET /api/interview/session/:id/question` - Get current question
- `POST /api/interview/session/:id/answer` - Submit text answer
- `POST /api/interview/session/:id/voice-answer` - Submit voice answer
- `GET /api/interview/session/:id` - Get session details
- `GET /api/interview/sessions` - List user sessions

### Analytics
- `GET /api/interview/analytics` - User performance analytics
- `GET /api/interview/session/:id/summary` - Session summary

## 🎯 Usage Flow

### Without Resume (Basic Flow)
1. User registers/logs in
2. Starts interview with job role
3. Receives AI-generated questions
4. Submits text/voice answers
5. Gets real-time feedback
6. Views performance analytics

### With Resume (Enhanced Flow)
1. User uploads resume (optional)
2. System extracts skills and experience
3. Gets job role suggestions
4. Starts interview with enhanced questions
5. Receives personalized feedback
6. Views detailed analytics

## 🔧 Configuration

### Question Generation Settings
```javascript
// In services/questionService.js
const settings = {
  questionCount: 5,        // Number of questions
  difficulty: 'medium',    // easy, medium, hard
  timeLimit: 120,         // seconds per question
  enableVoice: true       // Enable voice answers
};
```

### Feedback Criteria
```javascript
// In services/feedbackService.js
const criteria = {
  content: 0.4,           // 40% weight
  clarity: 0.3,           // 30% weight
  confidence: 0.2,        // 20% weight
  professionalism: 0.1    // 10% weight
};
```

## 📊 Data Models

### InterviewSession
- User reference and optional resume
- Questions with time limits and difficulty
- Answers with response times
- Comprehensive feedback and scoring
- Performance metrics and analytics

### Resume (Optional)
- File metadata and extracted text
- Parsed skills, experience, education
- Job title suggestions
- User association

### User
- Basic authentication
- Session history
- Performance tracking

## 🔒 Security Features

- JWT authentication
- File upload validation
- Input sanitization
- Rate limiting ready
- CORS configuration

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`

2. **Ollama Model Not Available**
   - Ensure Ollama is installed and running
   - Run `ollama pull llama3.2:3b` to download the model
   - Check that Ollama is accessible on http://localhost:11434

3. **Python Script Errors**
   - Install required Python packages
   - Check Python path in system

4. **File Upload Issues**
   - Ensure upload directories exist
   - Check file permissions

### Debug Mode
Set `NODE_ENV=development` for detailed logging.

## 📈 Performance Optimization

- Database indexing for faster queries
- File cleanup for old uploads
- Caching for frequently accessed data
- Async processing for AI operations

## 🔄 Updates and Maintenance

### Regular Tasks
- Clean up old audio files
- Monitor database performance
- Update AI models
- Review user feedback

### Scaling Considerations
- Redis for session management
- Cloud storage for files
- Load balancing for multiple instances
- Database sharding for large datasets

## 📝 License

This project is for educational and development purposes.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

---

**Note**: Resume upload is completely optional. Users can enjoy full interview functionality without uploading any documents.
