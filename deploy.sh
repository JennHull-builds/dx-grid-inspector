#!/bin/bash
set -e

# Configuration
# Change this if you use a different Project ID for your sandbox
PROJECT_ID="dx-grid-sandbox-1"
REGION="us-central1"
SERVICE_NAME="dx-grid-inspector"

echo "======================================================"
echo " Deploying $SERVICE_NAME to Google Cloud Run"
echo " Project: $PROJECT_ID | Region: $REGION"
echo "======================================================"

# Ensure the user is authenticated (uncomment if needed)
# gcloud auth login

# Deploy directly from source. 
# Cloud Build will automatically find the Dockerfile, build the image, 
# and deploy it to Cloud Run.
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --max-instances 1 \
  --port 8080

echo "======================================================"
echo " Deployment Complete!"
echo "======================================================"