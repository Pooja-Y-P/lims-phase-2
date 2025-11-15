# backend/core/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Configuration settings for the application, loaded from environment variables.
    """
    model_config = SettingsConfigDict(
        env_file='.env', 
        env_file_encoding='utf-8', 
        extra='ignore' # Ignore keys in .env that are not defined here
    )

    # --- Application Settings ---
    APP_ENV: str = "development"
    APP_NAME: str = "Nextage LIMS API"
    APP_PORT: int = 8000

    # --- Database Settings ---
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/limsdbp1"

    # --- JWT/Security Settings ---
    JWT_SECRET: str
    REFRESH_TOKEN_SECRET: str
    ALGORITHM: str = "HS256" # Default algorithm for JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 2
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 15
    TIMEZONE: str = "UTC"

    # --- SMTP/Email Settings ---
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    FROM_EMAIL: str

    # === THIS IS THE MISSING SETTING THAT NEEDS TO BE ADDED ===
    # --- Frontend URL ---
    # This is the URL for your React/Vue/Svelte frontend application.
    FRONTEND_URL: str = "http://localhost:5173"
    # ==========================================================

    # --- Delayed Email Settings ---
    DELAYED_EMAIL_DELAY_MINUTES: int = 3


# Create an instance of the settings for import throughout the application
settings = Settings()