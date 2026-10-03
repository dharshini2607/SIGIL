from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import alerts, events, entities, investigations, auth, users, notes
from app.core.database import engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown logic

app = FastAPI(
    title="SIGIL API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])
app.include_router(events.router, prefix="/api/v1/events", tags=["Events"])
app.include_router(entities.router, prefix="/api/v1/entities", tags=["Entities"])
app.include_router(investigations.router, prefix="/api/v1/investigations", tags=["Investigations"])
app.include_router(notes.router, prefix="/api/v1/notes", tags=["Notes"])

@app.get("/api/v1/debug/status")
def status():
    return {"status": "online"}
