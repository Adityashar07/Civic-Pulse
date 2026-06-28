# CivicPulse - GCP Cloud Run & Cloud SQL Auto-Deployer
# Uses 'cmd /c gcloud' to bypass PowerShell execution policy restrictions.

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   CIVICPULSE GCP AUTO-DEPLOYER (OPTION A)   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify gcloud CLI is accessible via cmd
Write-Host "Verifying Google Cloud CLI..." -ForegroundColor Yellow
$gcloudVersion = cmd /c "gcloud --version" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Google Cloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
}
Write-Host "Google Cloud CLI detected:" -ForegroundColor Green
Write-Host ($gcloudVersion | Select-Object -First 1)
Write-Host ""

# 2. Authenticate (opens browser for Google login)
Write-Host "Step 1/7: Authenticating with Google Cloud..." -ForegroundColor Yellow
Write-Host "(A browser window will open — please log in with your Google account.)" -ForegroundColor Cyan
cmd /c "gcloud auth login --quiet"
if ($LASTEXITCODE -ne 0) { Write-Host "Authentication failed." -ForegroundColor Red; exit 1 }
Write-Host "Authentication successful." -ForegroundColor Green
Write-Host ""

# 3. Get User Inputs
$projectId = Read-Host "Step 2/7: Enter your GCP Project ID"
if ([string]::IsNullOrWhiteSpace($projectId)) {
    Write-Host "Project ID cannot be empty." -ForegroundColor Red; exit 1
}

$dbPassword = Read-Host "Step 3/7: Enter a secure password for the PostgreSQL database user"
if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    Write-Host "Database password cannot be empty." -ForegroundColor Red; exit 1
}

Write-Host ""
Write-Host "Setting active GCP project to: $projectId ..." -ForegroundColor Yellow
cmd /c "gcloud config set project $projectId"
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to set project." -ForegroundColor Red; exit 1 }
Write-Host "Project set successfully." -ForegroundColor Green
Write-Host ""

# 4. Enable required GCP APIs
Write-Host "Step 4/7: Enabling required Google Cloud APIs..." -ForegroundColor Yellow
Write-Host "(This may take 1-2 minutes on first run)" -ForegroundColor Cyan
cmd /c "gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com"
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to enable APIs. Make sure billing is linked to your project." -ForegroundColor Red; exit 1 }
Write-Host "All APIs enabled." -ForegroundColor Green
Write-Host ""

# 5. Provision Cloud SQL (PostgreSQL)
$dbInstance = "civicpulse-db"
$dbName     = "civicpulse"
$region     = "us-central1"

Write-Host "Step 5/7: Provisioning Cloud SQL PostgreSQL instance..." -ForegroundColor Yellow

$instanceCheck = cmd /c "gcloud sql instances list --filter=name=$dbInstance --format=value(name)" 2>&1
if ([string]::IsNullOrWhiteSpace($instanceCheck)) {
    Write-Host "Creating Cloud SQL instance '$dbInstance' (this takes 3-5 minutes)..." -ForegroundColor Cyan
    cmd /c "gcloud sql instances create $dbInstance --database-version=POSTGRES_15 --tier=db-f1-micro --region=$region"
    if ($LASTEXITCODE -ne 0) { Write-Host "Failed to create Cloud SQL instance." -ForegroundColor Red; exit 1 }
    Write-Host "Cloud SQL instance created." -ForegroundColor Green
} else {
    Write-Host "Cloud SQL instance '$dbInstance' already exists. Skipping." -ForegroundColor Green
}

# Create database
$dbCheck = cmd /c "gcloud sql databases list --instance=$dbInstance --filter=name=$dbName --format=value(name)" 2>&1
if ([string]::IsNullOrWhiteSpace($dbCheck)) {
    cmd /c "gcloud sql databases create $dbName --instance=$dbInstance"
    if ($LASTEXITCODE -ne 0) { Write-Host "Failed to create database." -ForegroundColor Red; exit 1 }
    Write-Host "Database '$dbName' created." -ForegroundColor Green
} else {
    Write-Host "Database '$dbName' already exists. Skipping." -ForegroundColor Green
}

# Set DB user password
Write-Host "Setting database password..." -ForegroundColor Yellow
cmd /c "gcloud sql users set-password postgres --instance=$dbInstance --password=$dbPassword"
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to set DB password." -ForegroundColor Red; exit 1 }

# Retrieve connection name
$instanceConnection = cmd /c "gcloud sql instances describe $dbInstance --format=value(connectionName)" 2>&1
Write-Host "Cloud SQL Connection Name: $instanceConnection" -ForegroundColor Green
Write-Host ""

# 6. Create Artifact Registry repo and build Docker image
$repoName = "civicpulse-repo"
$imageTag = "$region-docker.pkg.dev/$projectId/$repoName/civicpulse-app:v1"

Write-Host "Step 6/7: Building and pushing Docker image via Cloud Build..." -ForegroundColor Yellow

$repoCheck = cmd /c "gcloud artifacts repositories list --location=$region --filter=name:$repoName --format=value(name)" 2>&1
if ([string]::IsNullOrWhiteSpace($repoCheck)) {
    cmd /c "gcloud artifacts repositories create $repoName --repository-format=docker --location=$region --description=Docker repository for CivicPulse"
    Write-Host "Artifact Registry repository created." -ForegroundColor Green
} else {
    Write-Host "Artifact Registry repository already exists. Skipping." -ForegroundColor Green
}

cmd /c "gcloud builds submit --tag $imageTag"
if ($LASTEXITCODE -ne 0) { Write-Host "Docker build failed." -ForegroundColor Red; exit 1 }
Write-Host "Docker image built and pushed successfully." -ForegroundColor Green
Write-Host ""

# 7. Deploy to Cloud Run
Write-Host "Step 7/7: Deploying CivicPulse to Google Cloud Run..." -ForegroundColor Yellow
$dbUrl = "postgresql://postgres:${dbPassword}@localhost/${dbName}?host=/cloudsql/$instanceConnection"

cmd /c "gcloud run deploy civicpulse-service --image=$imageTag --region=$region --allow-unauthenticated --add-cloudsql-instances=$instanceConnection --set-env-vars=DATABASE_URL=$dbUrl"
if ($LASTEXITCODE -ne 0) { Write-Host "Cloud Run deployment failed." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  CIVICPULSE DEPLOYED SUCCESSFULLY ON GCP!   " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your live application URL will be printed above by Cloud Run." -ForegroundColor Yellow
Write-Host "Append '/static/index.html' to the URL to open the dashboard." -ForegroundColor Cyan
Write-Host ""
