# backend/core/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration loaded strictly from environment variables (.env).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -----------------------------
    # Application Settings
    # -----------------------------
    APP_ENV: str
    APP_NAME: str
    APP_PORT: int

    # -----------------------------
    # Database Settings
    # -----------------------------
    DATABASE_URL: str

    # -----------------------------
    # JWT / Security Settings
    # -----------------------------
    JWT_SECRET: str
    REFRESH_TOKEN_SECRET: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_MINUTES: int
    TIMEZONE: str

    # -----------------------------
    # SMTP / Email Settings
    # -----------------------------
    SMTP_SERVER: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    FROM_EMAIL: str

    # Optional (Report Module)
    REPORT_EMAIL_TO: str | None = None

    # -----------------------------
    # Frontend URL
    # -----------------------------
    FRONTEND_URL: str

    # -----------------------------
    # Delayed Email Settings
    # -----------------------------
    DELAYED_EMAIL_DELAY_MINUTES: int


# Singleton instance
settings = Settings()
