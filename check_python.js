const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Check if venv Python exists and has faster-whisper
const pythonExe = process.platform === 'win32' ? 
  path.join(__dirname, '.venv', 'Scripts', 'python.exe') : 
  path.join(__dirname, '.venv', 'bin', 'python');

console.log('Checking Python at:', pythonExe);

if (!fs.existsSync(pythonExe)) {
  console.error('❌ Python executable not found at:', pythonExe);
  console.log('💡 Make sure you created the venv with: py -3 -m venv .venv');
  process.exit(1);
}

console.log('✅ Python executable found');

// Test faster-whisper import
const testProcess = spawn(pythonExe, ['-c', 'import faster_whisper; print("faster-whisper OK")']);

let output = '';
let errorOutput = '';

testProcess.stdout.on('data', (data) => {
  output += data.toString();
});

testProcess.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ faster-whisper is available');
    console.log('Output:', output.trim());
  } else {
    console.error('❌ faster-whisper test failed');
    console.error('Error:', errorOutput);
    console.log('💡 Run: pip install faster-whisper');
  }
});
