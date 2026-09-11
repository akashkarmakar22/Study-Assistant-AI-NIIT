import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

from file_processing import extract_text

load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")

client = Groq(api_key=GROQ_API_KEY)

app = FastAPI(title="AI Study Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict this to your real frontend domain once deployed
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a helpful, patient study assistant. Explain concepts clearly, "
        "use simple examples, and check the student's understanding when useful.\n\n"
        "Format every response in clean Markdown so it's easy to scan:\n"
        "- Use short paragraphs, not walls of text.\n"
        "- Use bullet points or numbered lists for steps, lists of items, or "
        "multiple related points.\n"
        "- Use **bold** to highlight key terms or the most important takeaway.\n"
        "- Use ## headings to separate distinct sections in longer answers.\n"
        "- Use code blocks (```) for any code, formulas, or equations.\n"
        "- Keep answers as concise as the question allows - don't pad with "
        "unnecessary structure for a one-line answer."
    ),
}


class ChatRequest(BaseModel):
    message: str
    # The frontend keeps the running conversation in memory (it resets on
    # refresh, since there's no database) and sends it back each time so
    # the model has context.
    history: list[dict] = []


class ChatResponse(BaseModel):
    reply: str


class UploadResponse(BaseModel):
    filename: str
    summary: str


MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

SUMMARY_PROMPT = {
    "role": "system",
    "content": (
        "You are a study assistant. Summarize the following document for a "
        "student, formatted in clean Markdown:\n"
        "## Overview\nA short 2-3 sentence summary.\n\n"
        "## Key Points\nA bullet list of the main points.\n\n"
        "## Important Terms\nA bullet list of key terms/definitions worth "
        "remembering, if any (omit this section if there are none)."
    ),
}


@app.get("/")
def health_check():
    return {"status": "ok", "message": "AI Study Assistant backend is running"}


@app.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File is too large (max 10MB).")

    extracted_text = extract_text(file.filename, contents)

    try:
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[SUMMARY_PROMPT, {"role": "user", "content": extracted_text}],
            temperature=0.4,
            max_tokens=1024,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {str(e)}")

    summary = completion.choices[0].message.content
    return UploadResponse(filename=file.filename, summary=summary)


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")

    messages = [SYSTEM_PROMPT] + req.history + [{"role": "user", "content": req.message}]

    try:
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.5,
            max_tokens=1024,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {str(e)}")

    reply = completion.choices[0].message.content
    return ChatResponse(reply=reply)