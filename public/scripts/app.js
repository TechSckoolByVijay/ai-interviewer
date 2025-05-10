document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }
});

let canvas, ctx;
let currentInterviewId = null;

const homeBtn = document.getElementById('homeBtn');
const jdResumeBtn = document.getElementById('jdResumeBtn');
const interviewBtn = document.getElementById('interviewBtn');
const reportsBtn = document.getElementById('reportsBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const nextBtn = document.getElementById('nextBtn');
const playback = document.getElementById('playback');
const messageDiv = document.createElement('div');
const borderFrame = document.querySelector('.bg-white'); // Updated selector to match the HTML structure

let screenRecorder, cameraRecorder, audioRecorder, combinedRecorder;
let screenChunks = [], cameraChunks = [], audioChunks = [], combinedChunks = [];
let screenStream, cameraStream, audioStream;
let animationFrameId;

const homePage = document.getElementById('homePage');
const jdResumePage = document.getElementById('jdResumePage');
const interviewPage = document.getElementById('interviewPage');
const reportsPage = document.getElementById('reportsPage');

// Declare variables only once at the top of the script
let currentSectionIndex = 0;
let currentQuestionIndex = 0; // Remove duplicate declarations
const sections = ["strengths", "weaknesses", "future", "challenges"];
let currentQuestions = [];

// Navigation logic
function showPage(page) {
  homePage.classList.add('hidden');
  jdResumePage.classList.add('hidden');
  interviewPage.classList.add('hidden');
  reportsPage.classList.add('hidden');
  page.classList.remove('hidden');
  if (page === interviewPage) {
    loadInterviews();
  }
}

homeBtn.addEventListener('click', () => showPage(homePage));
jdResumeBtn.addEventListener('click', () => showPage(jdResumePage));
interviewBtn.addEventListener('click', () => showPage(interviewPage));
reportsBtn.addEventListener('click', () => showPage(reportsPage));

startBtn.addEventListener('click', async () => {
  console.log('Start button clicked');
  if (!currentInterviewId) {
    alert('No interview selected');
    return;
  }

  try {
    // Get screen, camera, and audio streams
    console.log('Requesting screen, camera, and audio streams...');
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 },
        audio: false 
    });
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('Streams acquired successfully');

    // Create video elements
    const screenVideo = document.createElement('video');
    screenVideo.srcObject = screenStream;
    await screenVideo.play();

    const camVideo = document.createElement('video');
    camVideo.srcObject = cameraStream;
    await camVideo.play();

    // Draw combined view on canvas
    function drawFrame() {
        if (!canvas || !ctx) return;
        
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(camVideo, 
            canvas.width - 200 - 20,  // x position
            canvas.height - 150 - 20,  // y position
            200, 150                   // width, height
        );
        animationFrameId = requestAnimationFrame(drawFrame);
    }
    drawFrame();

    // Combine streams
    const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...cameraStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
    ]);
    console.log('Combined stream created');

    // Initialize and start recording
    initializeRecorders(combinedStream);
    startRecording();

    // Update UI
    startBtn.disabled = true;
    stopBtn.disabled = false;
    nextBtn.disabled = false;

    // Mute playback during recording
    if (playback) playback.muted = true;

    // Clear any previous message
    messageDiv.textContent = '';
    if (!document.body.contains(messageDiv)) {
        document.body.appendChild(messageDiv);
    }

  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Failed to start recording. Please ensure you have granted camera and microphone permissions.');
  }
});

stopBtn.addEventListener('click', async () => {
  if (currentSectionIndex < sections.length - 1 || currentQuestionIndex < currentQuestions.length - 1) {
    alert('Please complete all sections before ending the interview.');
    return;
  }

  const confirmEnd = confirm('Are you sure you want to end the interview?');
  if (!confirmEnd) return;

  console.log('Ending interview...');
  // Stop recording and upload files
  await stopRecordingAndUpload();

  // Turn off the camera, screen sharing, and microphone
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  if (screenStream) screenStream.getTracks().forEach((track) => track.stop());
  if (audioStream) audioStream.getTracks().forEach((track) => track.stop());

  // Display the thank-you message
  interviewPage.innerHTML = `
    <h1 class="text-3xl font-bold mb-4">Thank you for interviewing with us.</h1>
    <p class="text-lg">We will get back to you with your evaluation report soon.</p>
  `;
});

nextBtn.addEventListener('click', async () => {
  if (currentQuestionIndex < currentQuestions.length - 1) {
    // Stop the current recording and upload it
    await stopRecordingAndUpload();

    // Move to the next question
    currentQuestionIndex++;
    displayQuestion(currentQuestionIndex);

    // Start a new recording for the next question
    startRecording();
  } else if (currentSectionIndex < sections.length - 1) {
    // Stop the current recording and upload it
    await stopRecordingAndUpload();

    // Move to the next section
    currentSectionIndex++;
    currentQuestions = await fetchSectionQuestions(sections[currentSectionIndex]);
    currentQuestionIndex = 0;
    displayQuestion(0);
    initializeBottomNav(currentQuestions.length);

    // Start a new recording for the next section
    startRecording();
  } else {
    alert('You have completed all sections. Please end the interview.');
  }
});

function initializeRecorders(combinedStream) {
  console.log('Initializing recorders...');
  // Initialize MediaRecorders
  screenRecorder = new MediaRecorder(screenStream);
  cameraRecorder = new MediaRecorder(cameraStream);
  audioRecorder = new MediaRecorder(audioStream);
  combinedRecorder = new MediaRecorder(combinedStream); // Recorder for combined stream

  // Collect chunks for each stream
  screenRecorder.ondataavailable = (e) => screenChunks.push(e.data);
  cameraRecorder.ondataavailable = (e) => cameraChunks.push(e.data);
  audioRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  combinedRecorder.ondataavailable = (e) => combinedChunks.push(e.data);

  console.log('Recorders initialized');
}

function startRecording() {
  console.log('Starting recording...');
  screenRecorder.start();
  cameraRecorder.start();
  audioRecorder.start();
  combinedRecorder.start(); // Start recording the combined stream
  console.log('Recording started');
}

async function fetchFirstQuestion(userId) {
  try {
    const response = await fetch(`${API_CONFIG.API_URL}/get_question?user_id=${userId}`);
    const data = await response.json();
    if (data.detail) {
      console.error(data.detail);
    } else {
      console.log('First Question:', data.question);
      document.getElementById('question').textContent = data.question;

      // Play the audio
      const audio = document.getElementById('questionAudio');
      audio.src = `http://127.0.0.1:8000${data.audio_url}`;
      audio.classList.remove('hidden');
      audio.play();
    }
  } catch (error) {
    console.error('Error fetching first question:', error);
  }
}

async function stopRecordingAndUpload() {
  console.log('Stopping recording...');
  // Stop all recorders
  screenRecorder.stop();
  cameraRecorder.stop();
  audioRecorder.stop();
  combinedRecorder.stop();

  // Wait for all recorders to finalize their data
  console.log('Waiting for recorders to finalize...');
  await Promise.all([
    new Promise((resolve) => {
      screenRecorder.onstop = () => {
        console.log('Screen recording stopped');
        const screenBlob = new Blob(screenChunks, { type: 'video/webm' });
        sendFile(screenBlob, 'screen');
        screenChunks = []; // Clear chunks after sending
        resolve();
      };
    }),
    new Promise((resolve) => {
      cameraRecorder.onstop = () => {
        console.log('Camera recording stopped');
        const cameraBlob = new Blob(cameraChunks, { type: 'video/webm' });
        sendFile(cameraBlob, 'camera');
        cameraChunks = []; // Clear chunks after sending
        resolve();
      };
    }),
    new Promise((resolve) => {
      audioRecorder.onstop = () => {
        console.log('Audio recording stopped');
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        sendFile(audioBlob, 'audio');
        audioChunks = []; // Clear chunks after sending
        resolve();
      };
    }),
    new Promise((resolve) => {
      combinedRecorder.onstop = () => {
        console.log('Combined recording stopped');
        const combinedBlob = new Blob(combinedChunks, { type: 'video/webm' });
        sendFile(combinedBlob, 'combined'); // Save the combined file
        combinedChunks = []; // Clear chunks after sending
        resolve();
      };
    }),
  ]);
  console.log('All recordings stopped and uploaded');
}

async function sendFile(blob, type) {
  if (blob.size === 0) {
    console.error(`${type} blob is empty, not sending to server.`);
    return;
  }

  const formData = new FormData();
  formData.append('file', blob, `${currentInterviewId}_${type}_${Date.now()}.webm`);
  formData.append('interview_id', currentInterviewId);

  try {
    console.log(`Uploading ${type} file...`);
    const response = await fetchWithAuth(`${API_CONFIG.API_URL}/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        console.error(`Failed to upload ${type} file`);
    } else {
        console.log(`${type} file uploaded successfully`);
    }
  } catch (error) {
    console.error(`Error uploading ${type} file:`, error);
  }
}

let questions = [];

async function fetchQuestions(userId) {
  try {
    const response = await fetch(`http://127.0.0.1:8000/get_questions?user_id=${userId}`);
    const data = await response.json();
    if (data.detail) {
      console.error(data.detail);
    } else {
      questions = data.questions;
      console.log('Questions:', questions);
      displayQuestion(0); // Display the first question
      initializeProgressBar(questions.length);
    }
  } catch (error) {
    console.error('Error fetching questions:', error);
  }
}

function displayQuestion(index) {
  if (index < currentQuestions.length) {
    // Update the question text
    document.getElementById('question').textContent = currentQuestions[index];

    // Get the audio element
    const audio = document.getElementById('questionAudio');
    if (!audio) {
      console.error('Audio element not found in the DOM');
      return;
    }

    // Stop any currently playing audio
    audio.pause();
    audio.currentTime = 0;

    // Update the audio source
    const audioSrc = `http://127.0.0.1:8000/audio/${sections[currentSectionIndex]}_question_${index + 1}.mp3`;
    console.log(`Audio file path: ${audioSrc}`);
    audio.src = audioSrc;
    audio.classList.remove('hidden');

    // Wait for the audio to load before playing
    audio.addEventListener('canplaythrough', () => {
      audio.play().catch((error) => {
        console.error('Error playing audio:', error);
      });
    }, { once: true });

    // Update the bottom navigation bar
    updateBottomNav(index);
  }
}

function initializeProgressBar(totalQuestions) {
  const progressBar = document.getElementById('progressBar');
  progressBar.max = totalQuestions;
  progressBar.value = 1; // Start at the first question
}

function updateProgressBar() {
  const progressBar = document.getElementById('progressBar');
  progressBar.value = currentQuestionIndex + 1;
}

async function fetchSectionQuestions(section) {
  try {
    const response = await fetchWithAuth(`${API_CONFIG.API_URL}/get_section_questions?section=${section}`);
    const data = await response.json();
    if (data.detail) {
      console.error(data.detail);
    } else {
      console.log(`Questions for section "${section}":`, data.questions);
      return data.questions;
    }
  } catch (error) {
    console.error('Error fetching section questions:', error);
  }
}

async function startInterview() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  const friendlyName = document.getElementById('interviewName').value;
  if (!friendlyName) {
    alert('Please enter an interview name');
    return;
  }

  try {
    const response = await fetch(`${API_CONFIG.API_URL}/interviews/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ friendly_name: friendlyName })
    });
    const data = await response.json();
    currentInterviewId = data.id;

    // Fetch the first section's questions
    currentSectionIndex = 0;
    currentQuestions = await fetchSectionQuestions(sections[currentSectionIndex]);
    displayQuestion(0);
    initializeBottomNav(currentQuestions.length);
  } catch (error) {
    console.error('Failed to start interview:', error);
    alert('Failed to start interview. Please try again.');
  }
}

function initializeBottomNav(totalQuestions) {
  const bottomNav = document.getElementById('bottomNav');
  bottomNav.innerHTML = ""; // Clear previous navigation

  for (let i = 0; i < totalQuestions; i++) {
    const navItem = document.createElement('div');
    navItem.className = "nav-item bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center mx-1 cursor-pointer";
    navItem.textContent = i + 1;

    // Highlight the first question by default
    if (i === 0) navItem.classList.add("bg-blue-500", "text-white");

    // Add click event listener to play audio and display the question
    navItem.addEventListener('click', () => {
      currentQuestionIndex = i;
      displayQuestion(i);
    });

    bottomNav.appendChild(navItem);
  }
}

function updateBottomNav(index) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item, i) => {
    item.classList.remove("bg-blue-500", "text-white");
    item.classList.add("bg-gray-300", "text-gray-700");
    if (i === index) {
      item.classList.add("bg-blue-500", "text-white");
      item.classList.remove("bg-gray-300", "text-gray-700");
    }
  });
}

nextBtn.addEventListener('click', async () => {
  if (currentQuestionIndex < currentQuestions.length - 1) {
    currentQuestionIndex++;
    displayQuestion(currentQuestionIndex);
  } else if (currentSectionIndex < sections.length - 1) {
    // Move to the next section
    currentSectionIndex++;
    currentQuestions = await fetchSectionQuestions(sections[currentSectionIndex]);
    currentQuestionIndex = 0;
    displayQuestion(0);
    initializeBottomNav(currentQuestions.length);
  } else {
    alert('You have completed all sections. Please end the interview.');
  }
});

async function uploadRecording(blob, type) {
  const formData = new FormData();
  const fileName = `${currentInterviewId}-${type}.webm`;
  formData.append('file', blob, fileName);
  formData.append('interview_id', currentInterviewId);

  // ... existing upload code ...
}

function isAuthenticated() {
  return !!localStorage.getItem('token');
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logout();
});

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const authOptions = {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        }
    };

    const response = await fetch(url, authOptions);
    if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return;
    }
    return response;
}

async function loadInterviews() {
    try {
        const response = await fetch(`${API_CONFIG.API_URL}/interviews`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const interviews = await response.json();
        
        const interviewsList = document.getElementById('interviewsList');
        if (interviews.length === 0) {
            interviewsList.innerHTML = '<p class="text-gray-500">No interviews found</p>';
            return;
        }

        interviewsList.innerHTML = interviews.map(interview => `
            <div class="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                    <h4 class="font-semibold">${interview.friendly_name}</h4>
                    <p class="text-sm text-gray-500">
                        ${new Date(interview.created_at).toLocaleDateString()}
                    </p>
                </div>
                <button 
                    class="start-interview-btn bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                    data-interview-id="${interview.id}"
                >
                    Start
                </button>
            </div>
        `).join('');

        // Add event listeners to start buttons
        document.querySelectorAll('.start-interview-btn').forEach(btn => {
            btn.addEventListener('click', () => startExistingInterview(btn.dataset.interviewId));
        });
    } catch (error) {
        console.error('Error loading interviews:', error);
    }
}

// Add event listener for creating new interview
document.getElementById('createInterviewBtn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('newInterviewName');
    const friendlyName = nameInput.value.trim();
    
    if (!friendlyName) {
        alert('Please enter an interview name');
        return;
    }

    try {
        const response = await fetch(`${API_CONFIG.API_URL}/interviews`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ friendly_name: friendlyName })
        });

        const interview = await response.json();
        nameInput.value = '';
        await loadInterviews();
        startExistingInterview(interview.id);
    } catch (error) {
        console.error('Error creating interview:', error);
        alert('Failed to create interview');
    }
});

async function startExistingInterview(interviewId) {
    if (!interviewId) {
        console.error('No interview ID provided');
        return;
    }
    // Store interview ID in localStorage before redirecting
    localStorage.setItem('currentInterviewId', interviewId);
    window.location.href = `/recording.html?id=${interviewId}`;
}

// Modify the create interview button handler
document.getElementById('createInterviewBtn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('newInterviewName');
    const friendlyName = nameInput.value.trim();
    
    if (!friendlyName) {
        alert('Please enter an interview name');
        return;
    }

    try {
        const response = await fetch(`${API_CONFIG.API_URL}/interviews`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ friendly_name: friendlyName })
        });

        const interview = await response.json();
        nameInput.value = '';
        await loadInterviews(); // Refresh the list
        startExistingInterview(interview.id); // Start the new interview
    } catch (error) {
        console.error('Error creating interview:', error);
        alert('Failed to create interview');
    }
});

// Add after existing event listeners

// Handle Resume Upload
document.getElementById('resumeUploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('resumeFile');
    const statusDiv = document.getElementById('resumeStatus');
    
    if (!fileInput.files[0]) {
        statusDiv.textContent = 'Please select a file';
        statusDiv.className = 'mt-4 text-sm text-red-500';
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetchWithAuth(`${API_CONFIG.API_URL}/upload/resume`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            statusDiv.textContent = 'Resume uploaded successfully!';
            statusDiv.className = 'mt-4 text-sm text-green-500';
            fileInput.value = '';
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        statusDiv.textContent = 'Failed to upload resume. Please try again.';
        statusDiv.className = 'mt-4 text-sm text-red-500';
        console.error('Resume upload error:', error);
    }
});

// Handle Job Description Upload
const uploadFile = async (file, endpoint) => {
    console.log(`Starting upload to ${endpoint}`, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
    });

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    console.log('Token present:', !!token);

    try {
        console.log('Sending request...');
        const response = await fetch(`${API_CONFIG.API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        console.log('Response received:', {
            status: response.status,
            statusText: response.statusText
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            throw new Error(errorData.detail || 'Upload failed');
        }

        const result = await response.json();
        console.log('Success response:', result);
        return result;

    } catch (error) {
        console.error('Upload error details:', {
            message: error.message,
            stack: error.stack,
            endpoint: endpoint
        });
        throw error;
    }
};

// Update your form submission handlers:
document.getElementById('jdUploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('jdFile');
    const statusDiv = document.getElementById('jdStatus');
    
    if (!fileInput.files[0]) {
        statusDiv.textContent = 'Please select a file';
        statusDiv.className = 'mt-4 text-sm text-red-500';
        return;
    }

    try {
        statusDiv.textContent = 'Uploading...';
        statusDiv.className = 'mt-4 text-sm text-blue-500';
        
        const result = await uploadFile(fileInput.files[0], '/upload/jd');
        
        statusDiv.textContent = 'Job Description uploaded successfully!';
        statusDiv.className = 'mt-4 text-sm text-green-500';
        fileInput.value = '';
    } catch (error) {
        statusDiv.textContent = `Upload failed: ${error.message}`;
        statusDiv.className = 'mt-4 text-sm text-red-500';
        console.error('JD upload error:', error);
    }
});