const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test the Python audio processing script
console.log('🧪 Testing audio processing...');

// Create a dummy audio file for testing
const testAudioPath = path.join(__dirname, 'test_audio.webm');
const testQuestion = "Tell me about yourself";

// Create a minimal webm file (just for testing the script)
fs.writeFileSync(testAudioPath, Buffer.from([0x1a, 0x45, 0xdf, 0xa3])); // WebM header bytes

const pythonExe = 'python';
console.log('🐍 Using Python:', pythonExe);

const pythonProcess = spawn(pythonExe, ["process_answer.py", testAudioPath, testQuestion], {
  cwd: __dirname
});

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
  console.log("🐍 Python stderr:", chunk.trim());
});

pythonProcess.on("error", (error) => {
  console.error("🐍 Python process error:", error);
});

pythonProcess.on("close", (code) => {
  console.log(`🐍 Python process exited with code: ${code}`);
  console.log("📤 Final output:", output);
  console.log("❌ Final error output:", errorOutput);
  
  // Clean up test file
  if (fs.existsSync(testAudioPath)) {
    fs.unlinkSync(testAudioPath);
  }
  
  if (code === 0) {
    try {
      const result = JSON.parse(output);
      console.log("✅ Audio processing test successful!");
      console.log("📝 Result:", result);
    } catch (e) {
      console.log("❌ Failed to parse JSON output:", e.message);
    }
  } else {
    console.log("❌ Audio processing test failed!");
  }
});
