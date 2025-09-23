# Vertex AI Setup Guide

## Required Environment Variables

Create a `.env` file in the `backend/` directory with these values from your Google Cloud service account JSON:

```bash
# From your service account JSON file:
GCP_SA_PROJECT_ID=your-project-id-here
GCP_SA_PRIVATE_KEY_ID=your-private-key-id-here
GCP_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-actual-private-key-content-here\n-----END PRIVATE KEY-----"
GCP_SA_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GCP_SA_CLIENT_ID=your-client-id-here
GCP_SA_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com

# Optional (defaults to us-central1):
GCP_LOCATION=us-central1

# Your existing config:
DATABASE_URL=postgresql://postgres:pirate228@92.242.187.70:5432/Ai_ArtBase
APP_ENV=development
```

## JSON File Mapping

Your downloaded JSON file will look like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-123456",           → GCP_SA_PROJECT_ID
  "private_key_id": "abc123def456...",           → GCP_SA_PRIVATE_KEY_ID
  "private_key": "-----BEGIN PRIVATE KEY-----\n...→ GCP_SA_PRIVATE_KEY
  "client_email": "aiartbase@project.iam...",    → GCP_SA_CLIENT_EMAIL
  "client_id": "123456789012345678901",          → GCP_SA_CLIENT_ID
  "client_x509_cert_url": "https://www.google..." → GCP_SA_CLIENT_CERT_URL
}
```

## Important Notes

1. **Private Key**: Copy the entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
2. **Newlines**: Keep the `\n` characters in the private key
3. **Quotes**: Wrap the private key in double quotes in the .env file
4. **Region**: Imagen3 is available in: `us-central1`, `us-east4`, `us-west1`, `europe-west4`

## Test Your Setup

After creating the .env file, restart your backend and test:

```bash
curl -X POST "http://localhost:8000/generate/image/?prompt=test&user_id=4&number_of_images=1"
```

You should see real AI-generated images instead of mock placeholders!






