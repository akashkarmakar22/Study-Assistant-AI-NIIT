import io
from fastapi import HTTPException
from PIL import Image
import pytesseract
import pdfplumber
import docx

MAX_EXTRACTED_CHARS = 15000


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    text = "\n\n".join(text_parts).strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail=(
                "Couldn't find readable text in this PDF - it may be a scanned "
                "image rather than text. Try a text-based PDF instead."
            ),
        )
    return text


def extract_text_from_docx(file_bytes: bytes) -> str:
    document = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
    text = "\n".join(paragraphs).strip()

    if not text:
        raise HTTPException(status_code=422, detail="This document appears to be empty.")
    return text


def extract_text_from_image(file_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(file_bytes))
    text = pytesseract.image_to_string(image).strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail="Couldn't read any text in this image. Try a clearer photo or scan.",
        )
    return text


def extract_text(filename: str, file_bytes: bytes) -> str:
    """Dispatches to the right extractor based on file extension, then
    truncates to a safe length before it's sent to the model."""
    lower = filename.lower()

    if lower.endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
    elif lower.endswith(".docx"):
        text = extract_text_from_docx(file_bytes)
    elif lower.endswith((".png", ".jpg", ".jpeg", ".webp")):
        text = extract_text_from_image(file_bytes)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a PDF, DOCX, or image (PNG/JPG/WEBP).",
        )

    if len(text) > MAX_EXTRACTED_CHARS:
        text = text[:MAX_EXTRACTED_CHARS] + "\n\n[...content truncated for length...]"

    return text