declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      FRONTEND_URL: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;
      RAZORPAY_KEY_ID: string;
      RAZORPAY_KEY_SECRET: string;
      SMTP_HOST: string;
      SMTP_PORT: string;
      SMTP_USER: string;
      SMTP_PASS: string;
      TWILIO_ACCOUNT_SID: string;
      TWILIO_AUTH_TOKEN: string;
      TWILIO_PHONE_NUMBER: string;
      APP_NAME: string;
      APP_URL: string;
      MAX_FILE_SIZE: string;
      UPLOAD_PATH: string;
      RATE_LIMIT_WINDOW_MS: string;
      RATE_LIMIT_MAX_REQUESTS: string;
      ENCRYPTION_KEY: string;
      API_KEY: string;
      LOG_LEVEL: string;
      
      // Backblaze B2 Configuration
      B2_APPLICATION_KEY_ID: string;
      B2_APPLICATION_KEY: string;
      B2_BUCKET_ID?: string;
      B2_BUCKET_NAME?: string;
      B2_BUCKET_PRIVATE?: string;
      B2_CUSTOM_DOMAIN?: string;
    }
  }
}

export {};