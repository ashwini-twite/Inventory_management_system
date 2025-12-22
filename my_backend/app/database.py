from dotenv import load_dotenv
import os
from pathlib import Path
from supabase import create_client

# Always load .env from correct location
BASE_DIR = Path(__file__).resolve().parent.parent   # my_backend/
ENV_PATH = BASE_DIR / ".env"

print("🔍 Loading .env from:", ENV_PATH)

load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

print("SUPABASE_URL =", SUPABASE_URL)
print("SUPABASE_KEY =", SUPABASE_KEY[:6] + "..." if SUPABASE_KEY else None)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("❌ Supabase env variables not loaded. Check .env file.")

# Create supabase client ONCE
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
