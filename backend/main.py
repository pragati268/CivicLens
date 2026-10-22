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

    with engine.begin() as connection:
        if "latitude" not in columns:
            connection.execute(
                text("ALTER TABLE reports ADD COLUMN latitude FLOAT")
            )

        if "longitude" not in columns:
            connection.execute(
                text("ALTER TABLE reports ADD COLUMN longitude FLOAT")
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5175",
        "http://127.0.0.1:5175",
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
    )

    db.add(new_report)
    db.flush()

    new_report.report_code = f"CL-{1000 + new_report.id}"
    db.commit()
    db.refresh(new_report)

    return report_to_dict(new_report)