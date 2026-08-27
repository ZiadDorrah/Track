# Postman API Testing Guide (Track Enterprise Multi-User)

This guide provides instructions and examples for testing the REST APIs of the **Track Enterprise Multi-User Task Tracker** application using Postman.

---

## Getting Started

### 1. Launch the Server
Before testing API endpoints, ensure your local server is running:
```bash
npm run server
# Or run both client and server concurrently:
npm run dev
```
The backend server will start on `http://localhost:3005` connected to the embedded SQLite database (`data/track.db`).

### 2. Import the Postman Collection
1. Open **Postman**.
2. Click the **Import** button in the top-left section.
3. Drag and drop the `Track_API_Postman_Collection.json` file from the project root directory.
4. Click **Import** to add the collection to your Postman workspace.

---

## Postman Collection Environment & Variables

The collection includes a pre-configured variable:
- `baseUrl`: `http://localhost:3005`

Postman automatically captures the HTTP-only `session_token` cookie returned upon successful login (`/api/auth/login`). All subsequent requests will automatically transmit this cookie to authenticate calls.

---

## Testing Workflow & Endpoints

### Step 1: User Registration & Provisioning

#### Option A: Self Signup (`/api/auth/signup`)
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/signup`
- **Request Body**:
  ```json
  {
    "username": "johndoe",
    "password": "Password123!",
    "email": "john.doe@company.com",
    "displayName": "John Doe",
    "jobTitle": "Senior Frontend Developer"
  }
  ```
- **Behavior**: The first user registered in a clean system is automatically assigned Administrator privileges (`isAdmin: true`). Subsequent registrations default to standard users (`isAdmin: false`).

#### Option B: Admin Provisioning (`/api/admin/users`)
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/admin/users` *(Requires Admin session cookie)*
- **Request Body**:
  ```json
  {
    "username": "janedoe",
    "password": "SecurePassword456!",
    "email": "jane.doe@company.com",
    "displayName": "Jane Doe",
    "jobTitle": "Engineering Manager",
    "isAdmin": true,
    "managerIds": []
  }
  ```

---

### Step 2: User Login & Session Persistence (`/api/auth/login`)
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/login`
- **Request Body**:
  ```json
  {
    "username": "johndoe",
    "password": "Password123!"
  }
  ```
- **Response**: `200 OK` with user profile payload and HTTP-only `session_token` cookie.
- **Note**: Sessions are stored in SQLite and survive server restarts.

---

### Step 3: Verify Profile (`/api/auth/me`)
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/auth/me`
- **Response**: Returns the currently authenticated user's ID, username, email, display name, job title, and admin status.

---

### Step 4: Admin User & Hierarchy Management

#### Get All Users
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/admin/users` *(Admin only)*
- **Response**: Returns list of all registered users with their `managerIds` and `employeeIds`.

#### Assign Manager to Employee
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/admin/managers` *(Admin only)*
- **Request Body**:
  ```json
  {
    "managerId": "<MANAGER_USER_UUID>",
    "employeeId": "<EMPLOYEE_USER_UUID>"
  }
  ```
- **Behavior**: Establishes a management hierarchy link. Application checks for graph cycles; if an assignment would create a circular management loop, a `400 Bad Request` error is returned.

#### Remove Manager Link
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/admin/managers` *(Admin only)*
- **Request Body**:
  ```json
  {
    "managerId": "<MANAGER_USER_UUID>",
    "employeeId": "<EMPLOYEE_USER_UUID>"
  }
  ```

---

### Step 5: Projects Management

#### Get All Accessible Projects
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/projects`
- **Response**: Returns projects owned by or shared with the authenticated user, including full task list and project members.

#### Create Project
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/projects`
- **Request Body**:
  ```json
  {
    "name": "Mobile Application Redesign",
    "description": "Cross-platform React Native overhaul",
    "url": "https://mobile.company.local",
    "github": "https://github.com/company/mobile-app"
  }
  ```

#### Update Project
- **Method**: `PUT`
- **URL**: `{{baseUrl}}/api/projects/:id`

#### Delete Project
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/projects/:id` *(Only project owner)*

---

### Step 6: Tasks Management

#### Create Task
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/projects/:projectId/tasks`
- **Request Body**:
  ```json
  {
    "title": "Setup OAuth2 Authentication",
    "description": "Integrate keycloak / openid connect flows",
    "status": "in-progress",
    "priority": "high",
    "deadline": "2026-09-15T17:00",
    "scheduleDate": "2026-09-01T09:00",
    "reminder": true,
    "urgent": true,
    "important": true,
    "assigneeId": "<TARGET_USER_UUID>",
    "subtasks": [
      { "id": "s1", "text": "Configure identity provider", "completed": true },
      { "id": "s2", "text": "Add login button to header", "completed": false }
    ]
  }
  ```

#### Update Task
- **Method**: `PUT`
- **URL**: `{{baseUrl}}/api/projects/:projectId/tasks/:taskId`

#### Delete Task
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/projects/:projectId/tasks/:taskId`

#### Bulk Task Action
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/projects/:projectId/tasks/bulk`
- **Request Body**:
  ```json
  {
    "taskIds": ["<TASK_ID_1>", "<TASK_ID_2>"],
    "action": "status", // "status", "priority", or "delete"
    "value": "done"
  }
  ```

---

## Session Cleanup & Logout

- **Logout Route**: `POST /api/auth/logout`
- Invalidates session token in SQLite and clears cookie. Sub-sequent API calls will return `401 Unauthorized`.
