from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base
from sqlalchemy.sql import func
from enum import Enum as PyEnum

class UserType(enum.Enum):
    ADMIN = "admin"
    CANDIDATE = "candidate"

class QuestionStatus(str, PyEnum):
    NOT_ATTEMPTED = "NOT_ATTEMPTED"
    SKIPPED = "SKIPPED"
    ANSWERED = "ANSWERED"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    user_type = Column(Enum(UserType), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    interviews = relationship("Interview", back_populates="user")
    job_descriptions = relationship("JobDescription", back_populates="user")
    resumes = relationship("Resume", back_populates="user")

class Interview(Base):
    __tablename__ = "interviews"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    friendly_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="interviews")
    questions = relationship("InterviewQuestion", back_populates="interview")

class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    section = Column(String)
    question_text = Column(String)
    status = Column(Enum(QuestionStatus))
    recording_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    interview = relationship("Interview", back_populates="questions")

class JobDescription(Base):
    __tablename__ = "job_descriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="job_descriptions")

class Resume(Base):
    __tablename__ = "resumes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="resumes")


