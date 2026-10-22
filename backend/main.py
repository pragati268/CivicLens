from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="CivicLens API",
    description="Road hazard detection and civic issue reporting",
    version="0.1.0",
)

# Allow the local React development server to access the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReportCreate(BaseModel):
    issue: str = Field(min_length=3, max_length=100)
    location: str = Field(min_length=2, max_length=200)
    priority: Literal["Low", "Medium", "High"] = "Medium"


demo_reports = [
    {
        "id": "CL-1001",
        "issue": "Large pothole",
        "location": "Majitha Road",
        "priority": "High",
        "status": "Reported",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
]


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
def get_reports():
    return {"count": len(demo_reports), "reports": demo_reports}


@app.post("/api/reports", status_code=201)
def create_report(report: ReportCreate):
    new_report = {
        "id": f"CL-{1001 + len(demo_reports)}",
        **report.model_dump(),
        "status": "Reported",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    demo_reports.append(new_report)
    return new_report