# Google Cloud Platform Deployment Guide (Option B - Backend Only)

## Overview
The backend server and database for this project are deployed using **Google Compute Engine (GCE)** on a single Ubuntu virtual machine, while the frontend is independently hosted on **Firebase Hosting** for maximum scalability.

## Architecture
* **Frontend Platform:** Firebase Hosting (Static Asset Delivery)
* **Compute (Backend):** Google Compute Engine (E2-micro)
* **Operating System:** Ubuntu 22.04 LTS
* **Backend Runtime:** Node.js (v22.x) + Express
* **Database:** SQLite
* **Process Manager:** PM2
* **Web Server / Reverse Proxy:** Nginx
* **Network Port:** 8080 (Internal Express Port forwarded via HTTP Port 80)
* **Storage:** Persistent Disk

---

## Prerequisites
* Google Cloud Project (`civic-pulse-500811`)
* Billing enabled
* Compute Engine API enabled
* Google Cloud CLI installed locally (or using Google Cloud Shell)

---

## Step 1: Create a Virtual Machine
Create an Ubuntu 22.04 LTS VM instance via the GCP Console or Cloud Shell.

**Recommended Configuration:**
* **Instance Name:** `civic-pulse-backend`
* **Machine Type:** `e2-micro` (Free-tier eligible)
* **Region:** `asia-south1`
* **Zone:** `asia-south1-a`
* **Boot Disk:** Ubuntu 22.04 LTS (Standard Persistent Disk)
* **Firewall:** Check **Allow HTTP traffic** and **Allow HTTPS traffic**

---

## Step 2: Connect to the VM
Open your local terminal or Google Cloud Shell and run:
```bash
gcloud compute ssh civic-pulse-backend --zone=asia-south1-a

```

---

## Step 3: Update the Server

Once connected inside the VM instance terminal, update the core system repositories:

```bash
sudo apt update && sudo apt upgrade -y

```

---

## Step 4: Install Required Software

### Install Git:

```bash
sudo apt install git -y

```

### Install Node.js (v22):

```bash
curl -fsSL [https://deb.nodesource.com/setup_22.x](https://deb.nodesource.com/setup_22.x) | sudo -E bash -  
sudo apt install nodejs -y

```

### Verify Node & NPM installation:

```bash
node -v  
npm -v

```

### Install PM2 Globally:

```bash
sudo npm install -g pm2

```

### Install Nginx:

```bash
sudo apt install nginx -y

```

---

## Step 5: Clone Repository

Clone your project repository directly into the VM's directory:

```bash
git clone [https://github.com/Adityashar07/Civic-Pulse.git](https://github.com/Adityashar07/Civic-Pulse.git)
cd Civic-Pulse

```

---

## Step 6: Install Dependencies

```bash
npm install

```

---

## Step 7: Configure Environment Variables

Create a local `.env` file to instruct the Express app to execute safely on production port `8080`:

```bash
nano .env

```

**Paste the following variables into the file, save, and exit (Ctrl+O, Enter, Ctrl+X):**

```env
PORT=8080  
NODE_ENV=production

```

---

## Step 8: Initialize SQLite Database

If your repository includes an active seeding script to create database tables:

```bash
node seed.js

```

*(The SQLite database file `database.sqlite` will generate safely inside your root backend path automatically).*

---

## Step 9: Start the Application with PM2

Run your backend application continuously using PM2 process manager:

```bash
pm2 start server.js --name civic-pulse-api  
pm2 save  
pm2 startup

```

Verify the background task status:

```bash
pm2 status

```

---

## Step 10: Configure Nginx Reverse Proxy

Configure Nginx to intercept incoming traffic on HTTP Port 80 and forward it securely to your internal Express server processing on port `8080`.

### Create the configuration profile:

```bash
sudo nano /etc/nginx/sites-available/civic-pulse-api

```

### Paste this exact server configuration block:

```nginx
server {  
    listen 80;  
    server_name _;  

    location / {  
        proxy_pass http://localhost:8080;  
        proxy_http_version 1.1;  
        proxy_set_header Upgrade $http_upgrade;  
        proxy_set_header Connection "upgrade";  
        proxy_set_header Host $host;  
        proxy_cache_bypass $http_upgrade;  
    }  
}

```

### Enable the configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/civic-pulse-api /etc/nginx/sites-enabled/  
sudo rm /etc/nginx/sites-enabled/default  
sudo nginx -t  
sudo systemctl restart nginx

```

---

## Step 11: Configure OS Firewalls

Ensure the Ubuntu OS security engine unblocks HTTP and HTTPS communication web paths:

```bash
sudo ufw allow 80  
sudo ufw allow 443  
sudo ufw enable

```

---

## Step 12: Access and Link the Live Backend Backend API

1. Copy the **External IP** address of your VM from your Google Cloud Console dashboard.
2. Your live API base link endpoint is: `http://YOUR_VM_EXTERNAL_IP/`
3. Update your frontend production fetch configurations or environments to point straight to this External IP address instead of `localhost`!

---

## Maintenance & Monitoring Commands

### Pull fresh repository changes:

```bash
git pull  
npm install  
pm2 restart civic-pulse-api

```

### Inspect streaming runtime log errors:

```bash
pm2 logs civic-pulse-api

