FROM python:3.9-slim

WORKDIR /app

# Set environment variables for Gunicorn
# These can be overridden at runtime (e.g., via docker run -e or docker-compose.yml)
ENV MODULE_NAME="app.main" \
    VARIABLE_NAME="app" \
    WORKER_CLASS="uvicorn.workers.UvicornWorker" \
    # Default to 2 workers, adjust based on your server's cores
    WEB_CONCURRENCY="2" \
    # Default port
    PORT="8000"

# Install system dependencies including Node.js
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    postgresql-server-dev-all \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
# Ensure gunicorn is in requirements.txt or add RUN pip install gunicorn
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Expose the port the app runs on
EXPOSE $PORT

# Use Gunicorn to run the Uvicorn workers
CMD ["gunicorn", \
     "--bind", "0.0.0.0:$PORT", \
     "--workers", "$WEB_CONCURRENCY", \
     "--worker-class", "$WORKER_CLASS", \
     "$MODULE_NAME:$VARIABLE_NAME"]
