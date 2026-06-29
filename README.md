# Civic Pulse 🏙️

Civic Pulse is a synchronized web application engineered to bridge the communication gap between citizens and local administrative authorities. The platform offers an intuitive portal where users can instantly submit localized civic complaints (such as infrastructure deterioration, public safety hazards, or utility disruptions), which are captured dynamically and mapped visually onto a centralized web dashboard.

## 🚀 Live Demo & Deployment
* **Frontend Application:** Deployed globally using [Firebase Hosting](https://civic-pulse-500811.web.app/) for ultra-low latency.
* **Backend Runtime:** Node.js paired with an Express.js REST API framework configured to run locally on port `8080` for evaluation.

---

## ✨ Key Features
* **Interactive Reporting Form:** Allows users to select civic categories (Utilities, Roads, Safety) and input structured descriptions.
* **Real-Time Data Visualization:** A clean, responsive user interface mapping ongoing neighborhood issues dynamically within the viewport.
* **Lifecycle Status Management:** Backend-driven tracking states (e.g., Pending, In Progress, Resolved) to ensure civic transparency and public accountability.
* **Responsive Layouts:** Highly optimized for flawless mobile and desktop navigation.

---

## 🛠️ Tech Stack & Architecture

### Frontend
* HTML5, CSS3
* JavaScript (ES6+ asynchronous architecture)

### Backend & Database
* **Node.js & Express.js:** Handles API endpoints, state logic, and request routing.
* **SQLite:** A lightweight, serverless relational database engine providing local persistent storage for rapid prototyping.

### Process & Environment Management
* **PM2:** Production process tracking ecosystem.
* **Docker:** Containerized environment structures via an integrated project `Dockerfile`.

---

## ⚙️ Local Setup Instructions

Follow these steps to run the backend engine and review the application locally:

### 1. Clone the Repository
```bash
git clone [https://github.com/Adityashar07/Civic-Pulse.git](https://github.com/Adityashar07/Civic-Pulse.git)
cd Civic-Pulse

```
### 2. Install Dependencies
Make sure you have Node.js installed, then run:
```bash
npm install

```
### 3. Initialize and Start the Backend Server
Start the Express API server on port 8080:
```bash
node server.js

```
### 4. Open the Interface
Ensure your frontend configuration points to http://localhost:8080 to successfully process data requests locally through the web UI.

## 🗺️ Future Cloud Architecture Blueprints
The production scaling strategy for Civic Pulse includes deploying the containerized backend using **Google Cloud Platform (GCP)** blueprints, leveraging **Google Compute Engine (GCE)** micro-instances to handle heavy multi-user workloads securely.
```
