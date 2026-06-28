# Google Cloud Platform Deployment Guide (Option B)

## Overview

This project is deployed using **Google Compute Engine (GCE)** with a single Ubuntu virtual machine.

### Architecture

* **Compute:** Google Compute Engine (E2-micro)
* **Operating System:** Ubuntu 22.04 LTS
* **Backend:** Node.js + Express
* **Database:** SQLite
* **Process Manager:** PM2
* **Web Server:** Nginx
* **Storage:** Persistent Disk

---

# Prerequisites

* Google Cloud Project
* Billing enabled
* Compute Engine API enabled
* Google Cloud CLI installed

---

# Step 1: Create a Virtual Machine

Create an Ubuntu 22.04 LTS VM.

Recommended configuration:

* Machine Type: **E2-micro**
* Region: **asia-south1**
* Zone: **asia-south1-a**
* Allow HTTP Traffic
* Allow HTTPS Traffic

---

# Step 2: Connect to the VM

```bash
gcloud compute ssh YOUR_VM_NAME --zone=YOUR_ZONE
```

---

# Step 3: Update the Server

```bash
sudo apt update
sudo apt upgrade -y
```

---

# Step 4: Install Required Software

Install Git:

```bash
sudo apt install git -y
```

Install Node.js:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install nodejs -y
```

Verify installation:

```bash
node -v
npm -v
```

Install PM2:

```bash
sudo npm install -g pm2
```

Install Nginx:

```bash
sudo apt install nginx -y
```

---

# Step 5: Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

cd YOUR_REPOSITORY
```

---

# Step 6: Install Dependencies

```bash
npm install
```

---

# Step 7: Configure Environment Variables

Create a `.env` file if required.

Example:

```text
PORT=3000
NODE_ENV=production
```

---

# Step 8: Initialize SQLite Database

If your project includes a database seed script:

```bash
node backend/seed.js
```

The SQLite database file will be created automatically if it does not already exist.

---

# Step 9: Start the Application

```bash
pm2 start backend/server.js --name my-app

pm2 save

pm2 startup
```

Verify:

```bash
pm2 status
```

---

# Step 10: Configure Nginx Reverse Proxy

Create a configuration:

```bash
sudo nano /etc/nginx/sites-available/my-app
```

Paste:

```nginx
server {

    listen 80;

    server_name _;

    location / {

        proxy_pass http://localhost:3000;

        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;

        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;

        proxy_cache_bypass $http_upgrade;

    }

}
```

Enable configuration:

```bash
sudo ln -s /etc/nginx/sites-available/my-app /etc/nginx/sites-enabled/

sudo rm /etc/nginx/sites-enabled/default

sudo nginx -t

sudo systemctl restart nginx
```

---

# Step 11: Configure Firewall

```bash
sudo ufw allow 80

sudo ufw allow 443

sudo ufw enable
```

---

# Step 12: Access the Application

Retrieve the VM External IP from Google Cloud Console.

Open:

```
http://YOUR_EXTERNAL_IP
```

---

# Updating the Application

```bash
git pull

npm install

pm2 restart my-app
```

---

# Monitoring

View application logs:

```bash
pm2 logs
```

View running processes:

```bash
pm2 status
```

Restart application:

```bash
pm2 restart my-app
```

Stop application:

```bash
pm2 stop my-app
```

---

# Production Recommendations

* Use HTTPS with Let's Encrypt.
* Configure a custom domain.
* Enable automatic backups.
* Regularly update system packages.
* Monitor VM resource usage.

---

# Deployment Summary

| Component        | Service               |
| ---------------- | --------------------- |
| Compute          | Google Compute Engine |
| Operating System | Ubuntu 22.04 LTS      |
| Backend          | Node.js + Express     |
| Database         | SQLite                |
| Web Server       | Nginx                 |
| Process Manager  | PM2                   |
| Storage          | Persistent Disk       |
| Deployment Type  | Single VM (Option B)  |
