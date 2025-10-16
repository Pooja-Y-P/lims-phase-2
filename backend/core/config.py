# backend/core/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict

# Define the environment file (.env) where your secrets are stored
# NOTE: The keys below MUST match the keys in your provided environment block.
# JWT_SECRET and REFRESH_TOKEN_SECRET are critical here.

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
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/lims_phase1"

    # --- JWT/Security Settings ---
    # These must be non-empty strings for python-jose to work correctly.
    # The aliases are not strictly needed if the variable names match, 
    # but explicitly defining the type 'str' is essential.
    JWT_SECRET: str
    REFRESH_TOKEN_SECRET: str
    ALGORITHM: str = "HS256" # Default algorithm for JWT

    # Access Token Lifetime (e.g., 15 minutes)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # Refresh Token Lifetime (e.g., 7 days)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7 

    # --- SMTP/Email Settings ---
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    FROM_EMAIL: str


# Create an instance of the settings for import throughout the application
settings = Settings()