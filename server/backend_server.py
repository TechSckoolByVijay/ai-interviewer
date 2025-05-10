from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends, Body
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from gtts import gTTS
from dotenv import load_dotenv
import os
import shutil
from pydantic import BaseModel
from .database import get_db
from .models import *
from .auth import get_current_user, oauth2_scheme
from .auth import router as auth_router
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from typing import Optional
import tempfile
import logging

# Setup logging configuration at the top of the file
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from fastapi import UploadFile, File, Form, HTTPException
from pathlib import Path
from .models import Resume, JobDescription



# Load environment variables
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Specify exact origin instead of "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include the auth router
app.include_router(auth_router)

# Directory to store uploaded files and generated audio
UPLOAD_FOLDER = "uploads"
AUDIO_FOLDER = os.path.join(os.path.dirname(__file__), "..", "audio")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(AUDIO_FOLDER, exist_ok=True)

print(f"Audio files directory: {AUDIO_FOLDER}")  # Add this for debugging

# Predefined sections with questions
SECTIONS = {
    "strengths": [
        "What are your strengths?",
        "How do your strengths align with this role?"
    ],
    "weaknesses": [
        "What are your weaknesses?",
        "Can you share an example of overcoming a weakness?"
    ],
    "future": [
        "Where do you see yourself in 5 years?",
        "What are your career goals?"
    ],
    "challenges": [
        "Tell me about a challenging situation you faced",
        "How do you handle difficult decisions?"
    ]
}

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Mount the uploads directory
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/interviews/create")
async def create_interview(
    friendly_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    interview = Interview(
        user_id=current_user.id,
        friendly_name=friendly_name
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview

@app.get("/get_question")
async def get_question(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Generate the next question (replace with AI logic)
    question = f"Hello, User {current_user.id}. What are your strengths?"

    # Generate TTS audio
    audio_file_path = os.path.join(AUDIO_FOLDER, f"{current_user.id}_question.mp3")
    try:
        tts = gTTS(text=question, lang="en")
        tts.save(audio_file_path)
        print(f"Audio generated: {audio_file_path}")
    except Exception as e:
        print(f"Error generating audio: {e}")
        # Fallback to default audio
        question = "Apologies, I did not get what question to ask."
        audio_file_path = os.path.join(AUDIO_FOLDER, "default_question.mp3")
        if not os.path.exists(audio_file_path):
            tts = gTTS(text=question, lang="en")
            tts.save(audio_file_path)

    # Store in database
    question_record = InterviewQuestion(
        interview_id=interview_id,
        question_text=question,
        status=QuestionStatus.NOT_ATTEMPTED
    )
    db.add(question_record)
    db.commit()

    return {"question": question, "audio_url": f"/audio/{os.path.basename(audio_file_path)}"}

@app.get("/get_questions")
async def get_questions(user_id: str):
    """
    Generate six AI-driven questions and return them in one response.
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")

    # Generate six questions (replace with AI logic)
    questions = [
        f"Hello, User {user_id}. What are your strengths?",
        f"User {user_id}, what are your weaknesses?",
        f"User {user_id}, where do you see yourself in 5 years?",
        f"User {user_id}, why should we hire you?",
        f"User {user_id}, tell us about a challenging situation you faced.",
        f"User {user_id}, do you have any questions for us?"
    ]

    return {"questions": questions}


@app.post("/process_recording")
async def process_recording(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Process the uploaded recording and prepare the next question.
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")

    # Save the uploaded file
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Process the recording (replace with AI logic)
    print(f"Processing file: {file_path} for user {user_id}")

    # Generate the next question based on the response
    next_question = f"Thank you for your response, User {user_id}. What are your weaknesses?"

    # Generate TTS audio for the next question
    audio_file_path = os.path.join(AUDIO_FOLDER, f"{user_id}_next_question.mp3")
    try:
        tts = gTTS(text=next_question, lang="en")
        tts.save(audio_file_path)
        print(f"Audio generated: {audio_file_path}")
    except Exception as e:
        print(f"Error generating audio: {e}")
        # Fallback to default audio
        next_question = "Apologies, I did not get what question to ask."
        audio_file_path = os.path.join(AUDIO_FOLDER, "default_question.mp3")
        if not os.path.exists(audio_file_path):
            tts = gTTS(text=next_question, lang="en")
            tts.save(audio_file_path)

    return {"next_question": next_question, "audio_url": f"/audio/{os.path.basename(audio_file_path)}"}


@app.get("/audio/{filename}")
async def get_audio(filename: str):
    """
    Serve the generated audio file.
    """
    file_path = os.path.join(AUDIO_FOLDER, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path)


@app.get("/get_section_questions")
async def get_section_questions(
    section: str,
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify interview belongs to user
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Get questions from SECTIONS dictionary
    questions = SECTIONS.get(section, [])
    if not questions:
        raise HTTPException(status_code=404, detail=f"No questions found for section: {section}")

    # Store questions in database
    db_questions = []
    for question_text in questions:
        # Check if question already exists
        existing_question = db.query(InterviewQuestion).filter(
            InterviewQuestion.interview_id == interview_id,
            InterviewQuestion.section == section,
            InterviewQuestion.question_text == question_text
        ).first()

        if not existing_question:
            db_question = InterviewQuestion(
                interview_id=interview_id,
                section=section,
                question_text=question_text,
                status=QuestionStatus.NOT_ATTEMPTED
            )
            db.add(db_question)
            db_questions.append(db_question)

    db.commit()

    # Return all questions for this section
    all_questions = db.query(InterviewQuestion).filter(
        InterviewQuestion.interview_id == interview_id,
        InterviewQuestion.section == section
    ).order_by(InterviewQuestion.created_at).all()

    return {
        "questions": [{
            "id": q.id,
            "text": q.question_text,
            "status": q.status.value,
            "recording_path": q.recording_path
        } for q in all_questions]
    }

class QuestionStatusUpdate(BaseModel):
    question_id: int
    status: str
    recording_path: Optional[str] = None

@app.options("/update_question_status")
async def update_question_status_options():
    return {}

@app.post("/update_question_status")
async def update_question_status(
    data: QuestionStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        question = db.query(InterviewQuestion).join(Interview).filter(
            InterviewQuestion.id == data.question_id,
            Interview.user_id == current_user.id
        ).first()

        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        question.status = QuestionStatus(data.status)
        if data.recording_path:
            question.recording_path = data.recording_path
        question.updated_at = datetime.utcnow()

        db.commit()
        return JSONResponse(
            content={"message": "Question status updated successfully"},
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Credentials": "true"
            }
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/")
async def root():
    """
    Root endpoint for testing.
    """
    return {"message": "Welcome to the AI Interview API"}

@app.get("/interviews")
async def get_interviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    interviews = db.query(Interview).filter(
        Interview.user_id == current_user.id
    ).order_by(Interview.created_at.desc()).all()
    
    return [{
        "id": interview.id,
        "friendly_name": interview.friendly_name,
        "created_at": interview.created_at.isoformat()
    } for interview in interviews]

class InterviewCreate(BaseModel):
    friendly_name: str

@app.post("/interviews")
async def create_interview(
    data: InterviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Check if interview with same name exists
        existing_interview = db.query(Interview).filter(
            Interview.user_id == current_user.id,
            Interview.friendly_name == data.friendly_name
        ).first()
        
        if existing_interview:
            raise HTTPException(
                status_code=400,
                detail="Interview with this name already exists"
            )

        # Create new interview
        interview = Interview(
            user_id=current_user.id,
            friendly_name=data.friendly_name
        )
        db.add(interview)
        db.commit()
        db.refresh(interview)
        
        return {
            "id": interview.id,
            "friendly_name": interview.friendly_name,
            "created_at": interview.created_at.isoformat()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/user/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "user_type": current_user.user_type
    }

@app.get("/interviews/{interview_id}")
async def get_interview(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        interview = db.query(Interview).filter(
            Interview.id == interview_id,
            Interview.user_id == current_user.id
        ).first()
        
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        return {
            "id": interview.id,
            "friendly_name": interview.friendly_name,
            "created_at": interview.created_at.isoformat()
        }
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid interview ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(
    file: UploadFile,
    interview_id: str = Form(),
    question_id: str = Form(),
    file_type: str = Form(),
    current_user: User = Depends(get_current_user)
):
    try:
        print(f"Received upload request: {interview_id}, {question_id}, {file_type}")
        
        upload_dir = Path(UPLOAD_FOLDER)
        user_dir = upload_dir / str(current_user.email)
        interview_dir = user_dir / str(interview_id)
        
        # Create directories if they don't exist
        interview_dir.mkdir(parents=True, exist_ok=True)
        
        # Construct filename
        filename = f"{current_user.email}-{interview_id}-{question_id}_{file_type}.webm"
        file_path = interview_dir / filename
        
        # Save file
        with file_path.open("wb") as buffer:
            contents = await file.read()
            buffer.write(contents)
            
        return {
            "success": True,
            "path": str(file_path),
            "filename": filename
        }
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_question_audio")
async def get_question_audio(
    text: str,
    current_user: User = Depends(get_current_user)
):
    try:
        # Create a filename based on the question text
        filename = f"question_{hash(text)}.mp3"
        file_path = os.path.join(AUDIO_FOLDER, filename)

        # Only generate if file doesn't exist
        if not os.path.exists(file_path):
            tts = gTTS(text=text, lang="en")
            tts.save(file_path)
            print(f"New audio file created: {file_path}")

        return FileResponse(
            file_path,
            media_type='audio/mpeg',
            filename=filename
        )
    except Exception as e:
        print(f"Error generating audio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/audio-files")
async def list_audio_files(current_user: User = Depends(get_current_user)):
    """List all audio files in the AUDIO_FOLDER"""
    files = []
    for file in os.listdir(AUDIO_FOLDER):
        if file.endswith('.mp3'):
            file_path = os.path.join(AUDIO_FOLDER, file)
            files.append({
                'name': file,
                'size': os.path.getsize(file_path),
                'created': os.path.getctime(file_path)
            })
    return files

# Add constants for file paths
RESUME_FOLDER = Path("uploads/resumes")
JD_FOLDER = Path("uploads/jd")
RESUME_FOLDER.mkdir(parents=True, exist_ok=True)
JD_FOLDER.mkdir(parents=True, exist_ok=True)

@app.post("/upload/resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Starting resume upload for user: {current_user.id}")
        logger.debug(f"Received file: {file.filename}")

        # Create upload directory if it doesn't exist
        upload_path = UPLOAD_DIR / "resumes"
        upload_path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Upload directory confirmed: {upload_path}")

        # Save file
        file_path = upload_path / f"{current_user.id}_resume.pdf"
        logger.debug(f"Saving file to: {file_path}")
        
        with open(file_path, "wb") as buffer:
            logger.debug("Writing file content...")
            content = await file.read()
            buffer.write(content)
        
        logger.debug("File saved successfully, updating database...")

        # Update database
        try:
            resume = Resume(
                user_id=current_user.id,
                file_path=str(file_path)
            )
            db.add(resume)
            db.commit()
            logger.info("Database updated successfully")
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")

        return {"message": "File uploaded successfully", "path": str(file_path)}

    except Exception as e:
        logger.error(f"Error in upload_resume: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload/jd")
async def upload_jd(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Starting JD upload for user: {current_user.id}")
        logger.debug(f"Received file: {file.filename}")

        # Create upload directory if it doesn't exist
        upload_path = UPLOAD_DIR / "jd"
        upload_path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Upload directory confirmed: {upload_path}")

        # Save file
        file_path = upload_path / f"{current_user.id}_jd.pdf"
        logger.debug(f"Saving file to: {file_path}")
        
        with open(file_path, "wb") as buffer:
            logger.debug("Writing file content...")
            content = await file.read()
            buffer.write(content)
        
        logger.debug("File saved successfully, updating database...")

        # Update database
        try:
            jd = JobDescription(
                user_id=current_user.id,
                file_path=str(file_path)
            )
            db.add(jd)
            db.commit()
            logger.info("Database updated successfully")
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")

        return {"message": "File uploaded successfully", "path": str(file_path)}

    except Exception as e:
        logger.error(f"Error in upload_jd: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))