# Deployment To-Do List

## Pinned: GCP Sandbox Deployment (Pending)

The foundational files for GCP Cloud Run deployment (`Dockerfile`, `.dockerignore`, `nginx.conf.template`, `deploy.sh`) have been committed and pushed to `main`. `gcloud` has been successfully installed and authenticated locally.

When you are ready to return to this, you will pick up directly at project creation.

### Next Steps to Execute:

1. **Create the Project:**
   ```bash
   gcloud projects create dx-grid-sandbox-1 --name="DX Grid Inspector Sandbox"
   ```
   *(Note: Adjust the ID if `dx-grid-sandbox-1` is taken globally).*

2. **Set Active Project:**
   ```bash
   gcloud config set project dx-grid-sandbox-1
   ```

3. **Link Billing:**
   ```bash
   gcloud billing accounts list
   gcloud billing projects link dx-grid-sandbox-1 --billing-account=YOUR_BILLING_ACCOUNT_ID
   ```

4. **Enable APIs:**
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

5. **Deploy:**
   *(Ensure `PROJECT_ID` in `deploy.sh` matches the ID used in step 1)*
   ```bash
   ./deploy.sh
   ```