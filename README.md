# Daily Task Manager

A Firebase-powered task, assignment and test management system.

## Roles

### Super Admin
Super Admin can see:

- All Admins
- All Students
- All Tasks
- All Assignments
- All Tests
- Admin/class progress
- Individual student progress

### Admin

Admin can register directly using:

- Name
- Email
- Password

Admin can then:

- Create students
- Assign tasks
- Create assignments
- Add tests
- Give marks
- Update results
- Delete records
- View individual student progress
- View class progress

### Student

Students are created by Admin.

Students can:

- Login
- View their tasks
- Accept tasks
- Complete tasks
- View assignments
- Submit assignments
- View test results

Students cannot see:

- Progress graphs
- Other students
- Admins
- Super Admin data

## Firebase Setup

1. Create a Firebase project.

2. Enable Authentication.

3. Enable Email/Password sign-in.

4. Create a Firestore Database.

5. Copy the Firebase Web App configuration.

6. Open `script.js`.

7. Replace:

```javascript
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};
