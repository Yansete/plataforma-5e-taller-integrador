import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


def normalizar_url(url: str) -> str:
    """Acepta las URL que entregan Neon, Render o dbmate (postgres:// o postgresql://) y usa psycopg 3."""
    for prefijo in ("postgres://", "postgresql://"):
        if url.startswith(prefijo):
            return "postgresql+psycopg://" + url[len(prefijo):]
    return url


DATABASE_URL = normalizar_url(os.getenv("DATABASE_URL", "sqlite:///./demo.db"))

if DATABASE_URL.startswith("sqlite"):
    # SQLite requiere connect_args especiales para subprocesos
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # pool_pre_ping evita errores cuando la base gratuita se suspende por inactividad (Neon, Render).
    # prepare_threshold=None: sin sentencias preparadas, compatible con el pooler de Neon (PgBouncer).
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300, connect_args={"prepare_threshold": None})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
