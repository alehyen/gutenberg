from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, Column, Integer, String, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import json
import re
import requests
from pydantic import BaseModel
import openai  # Using Groq API


GROQ_API_KEY = "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"

client = openai.OpenAI(base_url="https://api.groq.com/openai/v1", api_key=GROQ_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
DATABASE_URL = "sqlite:///./books.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# SQLAlchemy Book model
class BookModel(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True)
    book_id = Column(Integer, unique=True)
    title = Column(String)
    authors = Column(String)
    languages = Column(String)
    text = Column(Text, nullable=True)
    analysis = Column(JSON, nullable=True)


Base.metadata.create_all(bind=engine)


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models
class BookRequest(BaseModel):
    book_id: int


class BookResponse(BaseModel):
    book_id: int
    title: str
    authors: str
    languages: str
    text: Optional[str] = None
    analysis: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


# Fetch book data
def fetch_book_data(book_id: int) -> BookResponse:
    content_url = f"https://www.gutenberg.org/files/{book_id}/{book_id}-0.txt"
    metadata_url = f"https://gutendex.com/books/{book_id}"

    metadata_response = requests.get(metadata_url)
    if metadata_response.status_code != 200:
        raise HTTPException(status_code=404, detail="Book metadata not found")

    content = json.loads(metadata_response.text)
    authors = (" | ").join([author["name"] for author in content["authors"]])
    languages = (" | ").join(content["languages"])

    content_response = requests.get(content_url)
    if content_response.status_code != 200:
        content_response = None
        print("Book content not found")
    else:
        content_response = content_response.text

    return BookResponse(
        book_id=book_id,
        title=content["title"],
        authors=authors,
        languages=languages,
        text=content_response,
    )



@app.get("/books/")
def list_books(db: Session = Depends(get_db)):
    books = db.query(BookModel).all()
    return {"books": [BookResponse.model_validate(book) for book in books]}


@app.get("/books/{book_id}")
def get_book(book_id: int, db: Session = Depends(get_db)):
    book_data = db.query(BookModel).filter(BookModel.book_id == book_id).first()

    if not book_data:
        book_data = fetch_book_data(book_id)
        db_book = BookModel(
            book_id=book_data.book_id,
            title=book_data.title,
            authors=book_data.authors,
            languages=book_data.languages,
            text=book_data.text,
        )
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
    return BookResponse.model_validate(book_data)


def clean_json_content(content):
    # Remove markdown code block indicators (```)
    content = re.sub(r'```json\n|```\n|```|\\n', '', content)
    
    # Try to extract JSON content (in case there's text before or after)
    match = re.search(r'({[\s\S]*})', content)
    if match:
        content = match.group(1)
    
    return content

# Groq API integration for text analysis
def analyze_text(text: str):
    response = client.chat.completions.create(
        model="llama-3.3-70b-specdec",
        messages=[
            {
                "role": "system",
                "content": """
            Analyze the following book text and return a structured JSON object containing the following details:
            Brief Summary: A very short overview of the book (max 3-4 sentences).
            Theme(s): The main themes explored in the book.
            Main Characters: If the book contains a story, list the primary characters with a short description.
            Main Places: If the book is a story, list significant locations mentioned in the book.
            Target Audience: The intended or most suitable readers for the book.
            Writing Style: A brief description of the author's writing style (e.g., formal, poetic, philosophical, etc.).
            Key Insights: Any notable ideas, arguments, or philosophical insights from the book.
            Sentiment Analysis: A general sentiment of the book (e.g., uplifting, dark, neutral, etc.).
            Return the response strictly in the following JSON format:

            {
            "summary": "A very short overview of the book.",
            "themes": ["Theme 1", "Theme 2", "Theme 3"],
            "main_characters": [
                {
                "name": "Character Name",
                "description": "Short description of the character."
                }
            ],
            "main_places": ["Place 1", "Place 2"],
            "target_audience": "Intended readers of the book.",
            "writing_style": "Description of the author's writing style.",
            "key_insights": ["Key insight 1", "Key insight 2"],
            "sentiment_analysis": "Overall sentiment of the book."
            }
             """,
            },
            {"role": "user", "content": text},
        ],
    )
    return json.loads(clean_json_content(response.choices[0].message.content))
 


@app.get("/books/{book_id}/analyze")
def analyze_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(BookModel).filter(BookModel.book_id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if not book.analysis:
        analysis = analyze_text(book.text[:20000]) # limit the number of token to not exceed the number allowed
        book.analysis = analysis
        db.commit()
        db.refresh(book)
    
    return BookResponse.model_validate(book)