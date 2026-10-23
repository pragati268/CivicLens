from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, String, DateTime, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy import (
    create_engine,
    String,
    DateTime,
    Float,
    select,
    inspect,
    text,
)

from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles

import os
from io import BytesIO
from uuid import uuid4

from dotenv import load_dotenv
from inference_sdk import InferenceHTTPClient
from PIL import Image, ImageDraw

DATABASE_URL = "sqlite:///./civiclens.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    report_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    issue: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(200))
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    annotated_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    pothole_count: Mapped[int] = mapped_column(default=0)
    confidence: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    priority: Mapped[str] = mapped_column(String(10), default="Medium")
    status: Mapped[str] = mapped_column(String(30), default="Reported")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ReportCreate(BaseModel):
    issue: str = Field(min_length=3, max_length=100)
    location: str = Field(min_length=2, max_length=200)
    priority: Literal["Low", "Medium", "High"] = "Medium"
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    image_url: str | None = Field(default=None, max_length=500)
    annotated_url: str | None = Field(default=None, max_length=500)
    pothole_count: int = Field(default=0, ge=0)
    confidence: float | None = Field(default=None, ge=0, le=1)


def get_db():
    with SessionLocal() as db:
        yield db


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    columns = {
        column["name"]
        for column in inspect(engine).get_columns("reports")
    }

    migrations = {
        "latitude": "FLOAT",
        "longitude": "FLOAT",
        "image_url": "VARCHAR(500)",
        "annotated_url": "VARCHAR(500)",
        "pothole_count": "INTEGER NOT NULL DEFAULT 0",
        "confidence": "FLOAT",
    }

    with engine.begin() as connection:
        for column_name, column_type in migrations.items():
            if column_name not in columns:
                connection.execute(
                    text(
                        f"ALTER TABLE reports ADD COLUMN "
                        f"{column_name} {column_type}"
                    )
                )

    # Insert a sample report only when the database is empty.
    with SessionLocal() as db:
        first_report = db.scalar(select(Report).limit(1))

        if first_report is None:
            db.add(
                Report(
                    report_code="CL-1001",
                    issue="Large pothole",
                    location="Majitha Road",
                    priority="High",
                    status="Reported",
                )
            )
            db.commit()

    yield


app = FastAPI(
    title="CivicLens API",
    description="Road hazard detection and civic issue reporting",
    version="0.2.0",
    lifespan=lifespan,
)

# Store uploaded road images inside the backend folder
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(Path(__file__).resolve().parent / ".env")

ROBOFLOW_MODEL_ID = (
    "s-workspace-cojhy/"
    "pothole-detection-yolo-8j0qo-14-yolo26s-t1"
)

DETECTION_DIR = UPLOAD_DIR / "detections"
DETECTION_DIR.mkdir(parents=True, exist_ok=True)


def get_roboflow_client():
    api_key = os.getenv("ROBOFLOW_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ROBOFLOW_API_KEY is missing from backend/.env",
        )

    return InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=api_key,
    )

# Make uploaded images accessible through the browser
app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def report_to_dict(report: Report):
    return {
        "id": report.report_code,
        "issue": report.issue,
        "location": report.location,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "priority": report.priority,
        "status": report.status,
        "image_url": report.image_url,
        "annotated_url": report.annotated_url,
        "pothole_count": report.pothole_count,
        "confidence": report.confidence,
        "created_at": (
            report.created_at.isoformat()
            if report.created_at
            else None
        ),
    }


@app.get("/")
def home():
    return {
        "message": "Welcome to CivicLens API",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/reports")
def get_reports(db: Session = Depends(get_db)):
    reports = db.scalars(
        select(Report).order_by(Report.id.desc())
    ).all()

    return {
        "count": len(reports),
        "reports": [report_to_dict(report) for report in reports],
    }


@app.post("/api/reports", status_code=201)
def create_report(
    report: ReportCreate,
    db: Session = Depends(get_db),
):
    new_report = Report(
        report_code="TEMP",
        issue=report.issue,
        location=report.location,
        latitude=report.latitude,
        longitude=report.longitude,
        priority=report.priority,
        status="Reported",
        image_url=report.image_url,
        annotated_url=report.annotated_url,
        pothole_count=report.pothole_count,
        confidence=report.confidence,
    )

    db.add(new_report)
    db.flush()

    new_report.report_code = f"CL-{1000 + new_report.id}"
    db.commit()
    db.refresh(new_report)

    return report_to_dict(new_report)

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}

    extension = Path(file.filename or "").suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, JPEG, PNG, or WEBP image.",
        )

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file must be an image.",
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image must be smaller than 8 MB.",
        )

    filename = f"{uuid4().hex}{extension}"
    destination = UPLOAD_DIR / filename

    with destination.open("wb") as image_file:
        image_file.write(content)

    return {
        "filename": filename,
        "url": f"http://127.0.0.1:8000/uploads/{filename}",
        "message": "Image uploaded successfully.",
    }

@app.post("/api/detect-pothole")
async def detect_pothole(file: UploadFile = File(...)):
    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    extension = Path(file.filename or "").suffix.lower()

    if extension not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, JPEG, PNG, or WEBP image.",
        )

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Image is empty.")

    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image must be smaller than 8 MB.",
        )

    try:
        # Decode and validate the uploaded image.
        try:
            with Image.open(BytesIO(content)) as source:
                image = source.convert("RGB")
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid image.",
            ) from exc

        # Save a temporary image for Roboflow inference.
        temp_path = UPLOAD_DIR / f"detect_{uuid4().hex}.jpg"
        output_name = f"result_{uuid4().hex}.jpg"
        output_path = DETECTION_DIR / output_name

        image.save(temp_path, format="JPEG", quality=95)

        try:
            client = get_roboflow_client()
            result = client.infer(
                str(temp_path),
                model_id=ROBOFLOW_MODEL_ID,
            )
        finally:
            if temp_path.exists():
                temp_path.unlink()

        predictions = result.get("predictions", [])
        detections = []

        # Draw detection boxes on the original image.
        annotated = image.copy()
        draw = ImageDraw.Draw(annotated)
        image_width, image_height = image.size

        for prediction in predictions:
            label = str(prediction.get("class", "unknown"))
            confidence = float(prediction.get("confidence", 0))

            center_x = float(prediction.get("x", 0))
            center_y = float(prediction.get("y", 0))
            box_width = float(prediction.get("width", 0))
            box_height = float(prediction.get("height", 0))

            x1 = max(0, center_x - box_width / 2)
            y1 = max(0, center_y - box_height / 2)
            x2 = min(image_width, center_x + box_width / 2)
            y2 = min(image_height, center_y + box_height / 2)

            detections.append({
                "label": label,
                "confidence": round(confidence, 4),
                "box": [
                    round(x1, 2),
                    round(y1, 2),
                    round(x2, 2),
                    round(y2, 2),
                ],
            })

            draw.rectangle(
                [x1, y1, x2, y2],
                outline="red",
                width=4,
            )
            draw.text(
                (x1, max(0, y1 - 20)),
                f"{label} {confidence:.0%}",
                fill="red",
                stroke_width=1,
                stroke_fill="white",
            )

        annotated.save(output_path, format="JPEG", quality=90)

        # Match the actual model's class names.
        potholes = [
            item for item in detections
            if "pothole" in item["label"].lower()
        ]

        return {
            "message": "Detection completed.",
            "model": ROBOFLOW_MODEL_ID,
            "detection_count": len(detections),
            "pothole_count": len(potholes),
            "hazard_detected": len(potholes) > 0,
            "detections": detections,
            "annotated_url": (
                "http://127.0.0.1:8000/uploads/detections/"
                + output_name
            ),
            "note": "AI predictions require human review.",
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Roboflow inference failed: {str(exc)[:300]}",
        ) from exc