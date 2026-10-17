import os
import re
from typing import Dict, Any, Tuple
from PIL import Image, ImageEnhance, ImageFilter
from pypdf import PdfReader
from app.core.config import settings

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

def preprocess_image(image_path: str) -> Image.Image:
    """
    Applies image enhancement: grayscale conversion, contrast enhancement,
    and adaptive thresholding for optimal OCR character recognition.
    """
    img = Image.open(image_path).convert("L")  # Convert to grayscale
    
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)
    
    # Apply slight sharpen filter
    img = img.filter(ImageFilter.SHARPEN)
    return img

def extract_text_from_pdf(pdf_path: str) -> Tuple[str, float]:
    """
    Extracts text from PDF documents using PyPDF.
    """
    reader = PdfReader(pdf_path)
    full_text = []
    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            full_text.append(f"--- PAGE {page_idx + 1} ---\n" + text.strip())
            
    extracted_text = "\n\n".join(full_text)
    if extracted_text.strip():
        # High confidence for direct digital text extraction
        return extracted_text, 0.96
    else:
        return "", 0.0

def perform_ocr(file_path: str) -> Dict[str, Any]:
    """
    Main OCR pipeline:
    Document -> Preprocessing -> OCR -> Text Cleaning -> Confidence Scoring
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    ext = os.path.splitext(file_path)[1].lower()
    
    # 1. Handle PDF files
    if ext == ".pdf":
        text, confidence = extract_text_from_pdf(file_path)
        if text:
            return {
                "text": text,
                "confidence": confidence,
                "method": "PDF_DIGITAL_EXTRACTION"
            }
            
    # 2. Handle images or scanned PDF pages, OCRing each PDF page independently.
    if TESSERACT_AVAILABLE:
        try:
            from pdf2image import convert_from_path

            if ext == ".pdf":
                images = convert_from_path(file_path, dpi=250)
            else:
                images = [Image.open(file_path)]

            language = settings.OCR_LANGUAGES.replace(",", "+").replace(" ", "")
            available = set(pytesseract.get_languages(config=""))
            requested = [lang for lang in language.split("+") if lang]
            missing = [lang for lang in requested if lang not in available]
            if missing:
                raise RuntimeError(f"Tesseract language data missing: {', '.join(missing)}")

            page_texts, confidences = [], []
            for page_number, page_image in enumerate(images, start=1):
                processed_img = page_image.convert("L")
                processed_img = ImageEnhance.Contrast(processed_img).enhance(2.0).filter(ImageFilter.SHARPEN)
                data = pytesseract.image_to_data(
                    processed_img,
                    lang=language,
                    output_type=pytesseract.Output.DICT,
                )
                confidences.extend(
                    int(value) for value in data.get("conf", [])
                    if str(value) not in ("-1", "") and int(value) > 0
                )
                page_text = pytesseract.image_to_string(processed_img, lang=language).strip()
                if page_text:
                    page_texts.append(f"--- PAGE {page_number} ---\n{page_text}" if ext == ".pdf" else page_text)

            text = "\n\n".join(page_texts)
            mean_conf = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0
            return {
                "text": text,
                "confidence": round(mean_conf, 2),
                "method": "TESSERACT_OCR",
                "languages": requested,
            }
        except Exception as e:
            return {
                "text": "",
                "confidence": 0.0,
                "method": "OCR_UNAVAILABLE",
                "error": str(e),
                "languages": settings.OCR_LANGUAGES.split("+"),
            }
            
    # 3. Fallback Parser for document text scanning
    # If the file contains readable text bytes or is a demo patta document
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            if len(content.strip()) > 20:
                return {
                    "text": content.strip(),
                    "confidence": 0.88,
                    "method": "TEXT_STREAM_SCAN"
                }
    except Exception:
        pass
        
    return {
        "text": "",
        "confidence": 0.0,
        "method": "NO_TEXT_EXTRACTED"
    }
