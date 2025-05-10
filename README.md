# Stream Recorder App

This project is a simple and modern web application that allows users to record their screen, audio, and video using the MediaRecorder API. The application features a user-friendly interface with one-click start and stop functionality for recording.

## Project Structure

```
stream-recorder-app
├── public
│   ├── index.html          # HTML structure of the webpage
│   ├── styles
│   │   └── tailwind.css    # Tailwind CSS stylesheet
│   └── scripts
│       └── app.js          # JavaScript functionality for recording
├── server
│   ├── server.js           # Express server setup for handling uploads
│   └── uploads
│       └── .gitkeep        # Keeps the uploads directory tracked by Git
├── package.json             # npm configuration file
└── README.md                # Project documentation
```

## Features

- **Screen Recording**: Capture your screen with audio.
- **Camera Overlay**: Record video from your camera in a picture-in-picture style.
- **One-Click Functionality**: Start and stop recordings with a single click.
- **File Upload**: Recorded files are uploaded to the server with appropriate timestamps and extensions.

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd stream-recorder-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the server**:
   ```bash
   node server/server.js
   ```

4. **Open the application**:
   Navigate to `http://localhost:3000` in your web browser.

## Usage

- Click the **Start** button to begin recording your screen and camera.
- Click the **Stop** button to end the recording.
- The recorded files will be uploaded to the server and saved with appropriate timestamps and extensions.

## Dependencies

- **Express**: Web framework for Node.js.
- **Multer**: Middleware for handling `multipart/form-data`, used for uploading files.

## License

This project is licensed under the MIT License.