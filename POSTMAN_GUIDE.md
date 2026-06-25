# Postman API Testing Guide

This guide will help you test the REST APIs for the **Track. Multi-Project Task Tracker** application using Postman.

## Getting Started

### 1. Launch the Server
Before testing, make sure your local server is running:
- Double-click `start.bat` in the project root directory.
- This will run `npm install` (if it's the first run) and start the backend server on `http://localhost:3000`.

### 2. Import the Postman Collection
1. Open Postman on your computer.
2. Click the **Import** button in the top-left area.
3. Drag and drop the `Track_API_Postman_Collection.json` file (located in the project folder) or browse to select it.
4. Click **Import** to add the collection to your workspace.

---

## Testing Workflow

### Step 1: User Registration (Signup)
1. In the **Authentication** folder, open the **Sign Up (Register User)** request.
2. Go to the **Body** tab. You'll see a JSON request:
   ```json
   {
       "username": "testuser",
       "password": "password123"
       // You can change these to test with different usernames/passwords
   }
   ```
3. Click **Send**. You should receive a `201 Created` response indicating registration success. A local user data file is also created automatically at `data/user_<id>.json`.

### Step 2: Authenticate (Login)
1. Open the **Login (Sign In)** request in the **Authentication** folder.
2. Make sure the username and password match what you registered.
3. Click **Send**.
4. You will receive a `200 OK` response with a JSON summary of your user details.
5. **IMPORTANT**: Postman will automatically capture the returned `session_token` cookie. All subsequent requests (Projects, Tasks, and Settings) will use this cookie automatically to authorize your calls!

### Step 3: Verify Session
1. Open the **Get Current User (Me)** request and click **Send**.
2. If you are successfully authenticated, it will return your user ID and username.

### Step 4: Manage Projects
1. Open the **Create Project** request in the **Projects** folder.
2. Inspect the JSON body:
   ```json
   {
       "name": "E-Commerce Website",
       "description": "Building online store platform",
       "url": "https://mystore.com",
       "github": "https://github.com/myuser/mystore"
   }
   ```
3. Click **Send**. The response will return the newly created project, including a generated UUID (`id`).
4. **Copy the project `id`** from the response body to test the tasks endpoints next.
5. You can also run **Get All Projects** to see your list.

### Step 5: Manage Tasks
1. Open **Create Task in Project** in the **Tasks** folder.
2. Look at the request path: `{{baseUrl}}/api/projects/:projectId/tasks`.
3. In the **Variables** tab (or Path Variables table), replace the `projectId` value with the UUID of the project you copied in Step 4.
4. Go to the **Body** tab. You'll see the task JSON. Note that tasks now support advanced Pro properties:
   ```json
   {
       "title": "Design Database Schema",
       "description": "Create projects and tasks tables.",
       "status": "todo",
       "priority": "high",
       "scheduleDate": "2026-06-23T09:00",
       "deadline": "2026-06-25T17:00",
       "reminder": true,
       "recurring": "weekly", // Options: "none", "daily", "weekly", "monthly"
       "subtasks": [
           { "id": "sub1", "text": "Draft project fields", "completed": false },
           { "id": "sub2", "text": "Draft task fields", "completed": false }
       ],
       "timeLogged": 0, // In seconds
       "timeSessions": [], // Session log history
       "timerStarted": null, // ISO string when active, else null
       "pomodoroSessions": [] // Logged pomodoro focus periods
   }
   ```
5. Click **Send**. The response returns the task with its own unique UUID (`id`). **Copy this task `id`** to test editing or deleting.
6. Open **Update Task Details** and populate both `projectId` and `taskId` in the variables table, edit status (e.g. from `todo` to `in-progress` or `done`), and click **Send**. Note that changing status to `done` on a task with `"recurring": "weekly"` will automatically generate a fresh cloned task forward in time.

### Step 6: Settings & Startup
1. Open **Get Windows Startup Status** and click **Send**. It checks if the app is scheduled to run on startup.
2. Open **Configure Windows Startup** and toggle the JSON body:
   ```json
   {
       "enabled": true // Or false to disable
   }
   ```
3. Click **Send**. If set to `true`, a hidden boot file (`TaskTracker.vbs`) will be created in your Windows Startup directory (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`), pointing directly to this workspace.

---

## Session Cleanup (Logout)
- To invalidate the session, open the **Logout** request and click **Send**. 
- Any subsequent calls to projects or tasks will now return `401 Unauthorized` until you log in again.
