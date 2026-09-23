import { initializeApp, getApps, getApp } from
"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* =========================================================
   FIREBASE CONFIG
   Replace these values with your Firebase project values.
   ========================================================= */

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/*
  Secondary Firebase app.
  It allows an Admin to create a Student account
  without logging the Admin out.
*/
let secondaryApp;

function getSecondaryApp() {
  if (!secondaryApp) {
    const existing = getApps().find(x => x.name === "SecondaryApp");

    secondaryApp = existing || initializeApp(firebaseConfig, "SecondaryApp");
  }

  return secondaryApp;
}

const state = {
  user: null,
  profile: null,
  students: [],
  admins: [],
  tasks: [],
  assignments: [],
  tests: [],
  currentPage: "dashboard"
};

/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

function toast(message, type = "success") {
  const box = document.createElement("div");
  box.className = `toast ${type}`;
  box.textContent = message;

  $("toast").appendChild(box);

  setTimeout(() => {
    box.remove();
  }, 3200);
}

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateString(value) {
  if (!value) return "-";

  if (value.toDate) {
    return value.toDate().toLocaleDateString();
  }

  return new Date(value).toLocaleDateString();
}

function dateTimeString(value) {
  if (!value) return "-";

  if (value.toDate) {
    return value.toDate().toLocaleString();
  }

  return new Date(value).toLocaleString();
}

function getInitials(name) {
  return String(name || "?")
    .split(" ")
    .map(x => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function percentage(a, b) {
  if (!b || b <= 0) return 0;

  return Math.min(100, Math.round((a / b) * 100));
}

function showModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modal").classList.remove("hidden");
}

function closeModal() {
  $("modal").classList.add("hidden");
}

function getStudent(id) {
  return state.students.find(s => s.id === id);
}

function getStudentName(id) {
  const s = getStudent(id);
  return s ? s.name : "Unknown Student";
}

function currentUserIsAdmin() {
  return state.profile?.role === "admin";
}

function currentUserIsSuper() {
  return state.profile?.role === "superadmin";
}

function currentUserIsStudent() {
  return state.profile?.role === "student";
}

/* =========================================================
   AUTH UI
   ========================================================= */

$("loginTab").onclick = () => {
  $("loginTab").classList.add("active");
  $("registerTab").classList.remove("active");

  $("loginForm").classList.remove("hidden");
  $("registerForm").classList.add("hidden");
};

$("registerTab").onclick = () => {
  $("registerTab").classList.add("active");
  $("loginTab").classList.remove("active");

  $("registerForm").classList.remove("hidden");
  $("loginForm").classList.add("hidden");
};

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    await signInWithEmailAndPassword(auth, email, password);

    toast("Login successful");
  } catch (error) {
    toast(getFirebaseError(error), "error");
  }
});

$("registerForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;
  const confirm = $("registerConfirm").value;

  if (password !== confirm) {
    toast("Passwords do not match", "error");
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      name,
      email,
      role: "admin",
      active: true,
      createdAt: serverTimestamp()
    });

    toast("Admin account created successfully");
  } catch (error) {
    toast(getFirebaseError(error), "error");
  }
});

function getFirebaseError(error) {
  const code = error?.code || "";

  const messages = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Invalid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-not-found": "Account not found.",
    "auth/wrong-password": "Incorrect password.",
    "auth/network-request-failed": "Network error. Check your internet."
  };

  return messages[code] || error.message || "Something went wrong.";
}

/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(auth, async user => {
  if (!user) {
    showAuth();
    return;
  }

  try {
    const profileRef = doc(db, "users", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      await signOut(auth);
      toast("Your account profile is missing.", "error");
      return;
    }

    state.user = user;
    state.profile = {
      id: profileSnap.id,
      ...profileSnap.data()
    };

    if (state.profile.active === false) {
      await signOut(auth);
      toast("Your account has been disabled.", "error");
      return;
    }

    showApp();
    await loadAllData();

  } catch (error) {
    console.error(error);
    toast("Unable to load account data.", "error");
  }
});

function showAuth() {
  $("authScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");
}

function showApp() {
  $("authScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  const role = state.profile.role;

  $("roleLabel").textContent =
    role === "superadmin"
      ? "Super Admin"
      : role === "admin"
        ? "Admin"
        : "Student";

  $("sideRole").textContent =
    role === "superadmin"
      ? "Super Admin"
      : role === "admin"
        ? "Admin / Teacher"
        : "Student";

  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle(
      "hidden",
      !(role === "admin" || role === "superadmin")
    );
  });

  document.querySelectorAll(".super-only").forEach(el => {
    el.classList.toggle(
      "hidden",
      role !== "superadmin"
    );
  });

  document.querySelectorAll(".student-only").forEach(el => {
    el.classList.toggle(
      "hidden",
      role !== "student"
    );
  });
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {
  await signOut(auth);
  location.reload();
}

$("logoutBtn").onclick = logout;
$("sideLogout").onclick = logout;

/* =========================================================
   NAVIGATION
   ========================================================= */

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", async () => {

    const page = btn.dataset.page;

    document.querySelectorAll(".nav-item")
      .forEach(x => x.classList.remove("active"));

    btn.classList.add("active");

    document.querySelectorAll(".page")
      .forEach(x => x.classList.add("hidden"));

    const target = $(`page-${page}`);

    if (target) {
      target.classList.remove("hidden");
    }

    state.currentPage = page;

    $("sidebar").classList.remove("open");

    await renderPage(page);
  });
});

$("menuBtn").onclick = () => {
  $("sidebar").classList.toggle("open");
};

async function renderPage(page) {

  if (page === "dashboard") {
    renderDashboard();
  }

  if (page === "students") {
    renderStudents();
  }

  if (page === "tasks") {
    renderTasks();
  }

  if (page === "assignments") {
    renderAssignments();
  }

  if (page === "tests") {
    renderTests();
  }

  if (page === "admins") {
    renderAdmins();
  }

  if (page === "myTasks") {
    renderMyTasks();
  }

  if (page === "myAssignments") {
    renderMyAssignments();
  }

  if (page === "myTests") {
    renderMyTests();
  }
}

/* =========================================================
   LOAD DATA
   ========================================================= */

async function loadAllData() {

  state.students = [];
  state.admins = [];
  state.tasks = [];
  state.assignments = [];
  state.tests = [];

  if (currentUserIsAdmin()) {
    await loadAdminData();
  }

  if (currentUserIsSuper()) {
    await loadSuperData();
  }

  if (currentUserIsStudent()) {
    await loadStudentData();
  }

  renderDashboard();
}

async function loadAdminData() {

  const studentsQuery = query(
    collection(db, "users"),
    where("role", "==", "student"),
    where("adminId", "==", state.user.uid)
  );

  const studentsSnap = await getDocs(studentsQuery);

  state.students = studentsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const tasksQuery = query(
    collection(db, "tasks"),
    where("adminId", "==", state.user.uid)
  );

  const tasksSnap = await getDocs(tasksQuery);

  state.tasks = tasksSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const assignmentsQuery = query(
    collection(db, "assignments"),
    where("adminId", "==", state.user.uid)
  );

  const assignmentsSnap = await getDocs(assignmentsQuery);

  state.assignments = assignmentsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const testsQuery = query(
    collection(db, "tests"),
    where("adminId", "==", state.user.uid)
  );

  const testsSnap = await getDocs(testsQuery);

  state.tests = testsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

async function loadSuperData() {

  const usersSnap = await getDocs(collection(db, "users"));

  const users = usersSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  state.students = users.filter(x => x.role === "student");
  state.admins = users.filter(x => x.role === "admin");

  const tasksSnap = await getDocs(collection(db, "tasks"));
  state.tasks = tasksSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const assignmentsSnap = await getDocs(collection(db, "assignments"));
  state.assignments = assignmentsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const testsSnap = await getDocs(collection(db, "tests"));
  state.tests = testsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

async function loadStudentData() {

  const taskQuery = query(
    collection(db, "tasks"),
    where("studentId", "==", state.user.uid)
  );

  const tasksSnap = await getDocs(taskQuery);

  state.tasks = tasksSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const assignmentQuery = query(
    collection(db, "assignments"),
    where("studentId", "==", state.user.uid)
  );

  const assignmentsSnap = await getDocs(assignmentQuery);

  state.assignments = assignmentsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const testQuery = query(
    collection(db, "tests"),
    where("studentId", "==", state.user.uid)
  );

  const testsSnap = await getDocs(testQuery);

  state.tests = testsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const role = state.profile.role;

  let stats = [];

  if (role === "superadmin") {

    stats = [
      ["👨‍🏫", state.admins.length, "Admins"],
      ["👨‍🎓", state.students.length, "Students"],
      ["📝", state.tasks.length, "Tasks"],
      ["📚", state.assignments.length, "Assignments"]
    ];

    $("dashboardTitle").textContent = "Super Admin Dashboard";
    $("dashboardSubtitle").textContent =
      "Complete system overview.";
  }

  else if (role === "admin") {

    const completedTasks =
      state.tasks.filter(x => x.status === "completed").length;

    stats = [
      ["👨‍🎓", state.students.length, "Students"],
      ["📝", state.tasks.length, "Tasks"],
      ["📚", state.assignments.length, "Assignments"],
      ["🧪", state.tests.length, "Tests"]
    ];

    $("dashboardTitle").textContent = "Admin Dashboard";
    $("dashboardSubtitle").textContent =
      `Welcome, ${state.profile.name || "Admin"}.`;
  }

  else {

    const completedTasks =
      state.tasks.filter(x => x.status === "completed").length;

    const completedAssignments =
      state.assignments.filter(x => x.submitted).length;

    stats = [
      ["📝", state.tasks.length, "My Tasks"],
      ["✓", completedTasks, "Completed Tasks"],
      ["📚", state.assignments.length, "Assignments"],
      ["🧪", state.tests.length, "Tests"]
    ];

    $("dashboardTitle").textContent = "My Dashboard";
    $("dashboardSubtitle").textContent =
      `Welcome, ${state.profile.name || "Student"}.`;
  }

  $("statsGrid").innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="icon">${s[0]}</div>
      <div class="number">${s[1]}</div>
      <div class="label">${s[2]}</div>
    </div>
  `).join("");

  renderRecentActivity();
  renderDashboardProgress();
}

function renderRecentActivity() {

  let items = [];

  state.tasks.slice(-5).reverse().forEach(t => {
    items.push({
      icon: "📝",
      title: escapeHTML(t.title),
      subtitle: `Task • ${dateString(t.createdAt)}`
    });
  });

  state.assignments.slice(-3).reverse().forEach(a => {
    items.push({
      icon: "📚",
      title: escapeHTML(a.title),
      subtitle: `Assignment • ${dateString(a.givenDate)}`
    });
  });

  if (!items.length) {
    $("recentActivity").innerHTML =
      `<div class="empty">No activity yet.</div>`;
    return;
  }

  $("recentActivity").innerHTML = items.slice(0, 7).map(i => `
    <div class="activity-item">
      <div class="activity-icon">${i.icon}</div>
      <div>
        <strong>${i.title}</strong>
        <small>${i.subtitle}</small>
      </div>
    </div>
  `).join("");
}

function renderDashboardProgress() {

  /*
    Student ko progress graph nahi dikhaya jata.
    Admin aur Super Admin ko hi progress graph milta hai.
  */

  if (currentUserIsStudent()) {

    $("dashboardProgress").innerHTML = `
      <div class="empty">
        Progress graph is available only to Admin and Super Admin.
      </div>
    `;

    return;
  }

  if (!state.students.length) {
    $("dashboardProgress").innerHTML =
      `<div class="empty">No students available.</div>`;
    return;
  }

  const rows = state.students.slice(0, 8).map(student => {

    const tasks = state.tasks.filter(
      t => t.studentId === student.id
    );

    const completed = tasks.filter(
      t => t.status === "completed"
    ).length;

    const p = percentage(completed, tasks.length);

    return `
      <div class="progress-box">
        <div class="progress-label">
          <span>${escapeHTML(student.name)}</span>
          <span>${p}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${p}%"></div>
        </div>
      </div>
    `;
  }).join("");

  $("dashboardProgress").innerHTML = rows;
}

/* =========================================================
   STUDENTS
   ========================================================= */

$("addStudentBtn").onclick = openAddStudent;

async function openAddStudent() {

  showModal("Create Student", `
    <form id="studentForm">

      <div class="form-grid">

        <div>
          <label>Student Name</label>
          <input id="studentName" required placeholder="Student name">
        </div>

        <div>
          <label>Email</label>
          <input id="studentEmail" type="email" required placeholder="student@email.com">
        </div>

        <div>
          <label>Password</label>
          <input id="studentPassword" type="password" minlength="6" required placeholder="Minimum 6 characters">
        </div>

        <div>
          <label>Class / Group</label>
          <input id="studentClass" placeholder="Example: CIT 1st Year">
        </div>

      </div>

      <div class="form-actions">
        <button type="button" class="secondary-btn" onclick="closeModal()">Cancel</button>
        <button class="primary-btn">Create Student</button>
      </div>

    </form>
  `);

  $("studentForm").onsubmit = createStudent;
}

async function createStudent(e) {

  e.preventDefault();

  const name = $("studentName").value.trim();
  const email = $("studentEmail").value.trim();
  const password = $("studentPassword").value;
  const studentClass = $("studentClass").value.trim();

  try {

    const secondary = getSecondaryApp();

    const {
      getAuth,
      createUserWithEmailAndPassword,
      signOut
    } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
    );

    const secondaryAuth = getAuth(secondary);

    const result = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );

    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      name,
      email,
      role: "student",
      adminId: state.user.uid,
      className: studentClass,
      active: true,
      createdAt: serverTimestamp()
    });

    await signOut(secondaryAuth);

    closeModal();

    await loadAllData();

    renderStudents();

    toast("Student account created successfully.");

  } catch (error) {

    console.error(error);
    toast(getFirebaseError(error), "error");
  }
}

function renderStudents() {

  const search = $("studentSearch")?.value?.toLowerCase() || "";

  const students = state.students.filter(s =>
    String(s.name || "").toLowerCase().includes(search) ||
    String(s.email || "").toLowerCase().includes(search)
  );

  if (!students.length) {

    $("studentsGrid").innerHTML = `
      <div class="empty">
        No students found.
      </div>
    `;

    return;
  }

  $("studentsGrid").innerHTML = students.map(student => {

    const tasks = state.tasks.filter(
      t => t.studentId === student.id
    );

    const completed = tasks.filter(
      t => t.status === "completed"
    ).length;

    const p = percentage(completed, tasks.length);

    return `
      <div class="person-card">

        <div class="person-top">

          <div class="avatar">
            ${getInitials(student.name)}
          </div>

          <div>
            <h3>${escapeHTML(student.name)}</h3>
            <p>${escapeHTML(student.email)}</p>
          </div>

        </div>

        <div class="progress-box">

          <div class="progress-label">
            <span>Task Progress</span>
            <strong>${p}%</strong>
          </div>

          <div class="progress-track">
            <div class="progress-fill" style="width:${p}%"></div>
          </div>

        </div>

        <p>Class: ${escapeHTML(student.className || "Not set")}</p>

        <div class="card-actions">
          <button class="small-btn primary"
            onclick="viewStudent('${student.id}')">
            View Progress
          </button>

          <button class="small-btn danger"
            onclick="deleteStudent('${student.id}')">
            Delete
          </button>
        </div>

      </div>
    `;
  }).join("");
}

$("studentSearch").addEventListener("input", renderStudents);

window.viewStudent = async function(id) {

  const student = getStudent(id);

  if (!student) return;

  const tasks = state.tasks.filter(t => t.studentId === id);
  const assignments = state.assignments.filter(a => a.studentId === id);
  const tests = state.tests.filter(t => t.studentId === id);

  const completedTasks =
    tasks.filter(t => t.status === "completed").length;

  const submitted =
    assignments.filter(a => a.submitted).length;

  const taskProgress = percentage(
    completedTasks,
    tasks.length
  );

  const assignmentProgress = percentage(
    submitted,
    assignments.length
  );

  const testMarks = tests.reduce(
    (sum, t) => sum + Number(t.obtainedMarks || 0),
    0
  );

  const testTotal = tests.reduce(
    (sum, t) => sum + Number(t.totalMarks || 0),
    0
  );

  const testProgress = percentage(
    testMarks,
    testTotal
  );

  $("studentModalTitle").textContent = student.name;

  $("studentModalBody").innerHTML = `

    <div class="stats-grid">

      <div class="stat-card">
        <div class="number">${tasks.length}</div>
        <div class="label">Tasks</div>
      </div>

      <div class="stat-card">
        <div class="number">${taskProgress}%</div>
        <div class="label">Task Progress</div>
      </div>

      <div class="stat-card">
        <div class="number">${assignmentProgress}%</div>
        <div class="label">Assignments</div>
      </div>

      <div class="stat-card">
        <div class="number">${testProgress}%</div>
        <div class="label">Test Performance</div>
      </div>

    </div>

    <div class="panel">
      <h3>Student Progress</h3>

      ${progressLine("Tasks", taskProgress)}
      ${progressLine("Assignments", assignmentProgress)}
      ${progressLine("Tests", testProgress)}

    </div>

    <div class="panel" style="margin-top:15px">

      <h3>Student Information</h3>

      <p><strong>Name:</strong> ${escapeHTML(student.name)}</p>
      <p><strong>Email:</strong> ${escapeHTML(student.email)}</p>
      <p><strong>Class:</strong> ${escapeHTML(student.className || "-")}</p>

    </div>
  `;

  $("studentModal").classList.remove("hidden");
};

function progressLine(name, value) {

  return `
    <div class="progress-box">
      <div class="progress-label">
        <span>${name}</span>
        <strong>${value}%</strong>
      </div>

      <div class="progress-track">
        <div class="progress-fill" style="width:${value}%"></div>
      </div>
    </div>
  `;
}

window.deleteStudent = async function(id) {

  if (!confirm("Delete this student profile?")) return;

  try {

    await deleteDoc(doc(db, "users", id));

    state.students =
      state.students.filter(s => s.id !== id);

    renderStudents();

    toast("Student profile deleted.");

  } catch (error) {

    toast(error.message, "error");
  }
};

/* =========================================================
   TASKS
   ========================================================= */

$("addTaskBtn").onclick = openAddTask;

function openAddTask() {

  if (!state.students.length) {
    toast("Create a student first.", "error");
    return;
  }

  showModal("Assign Task", `

    <form id="taskForm">

      <div class="form-grid">

        <div class="full">
          <label>Student</label>

          <select id="taskStudent" required>
            ${state.students.map(s => `
              <option value="${s.id}">
                ${escapeHTML(s.name)}
              </option>
            `).join("")}
          </select>
        </div>

        <div>
          <label>Task Title</label>
          <input id="taskTitle" required placeholder="Task title">
        </div>

        <div>
          <label>Deadline</label>
          <input id="taskDeadline" type="datetime-local" required>
        </div>

        <div class="full">
          <label>Description</label>
          <textarea id="taskDescription"
            placeholder="Task details"></textarea>
        </div>

      </div>

      <div class="form-actions">
        <button type="button" class="secondary-btn"
          onclick="closeModal()">Cancel</button>

        <button class="primary-btn">
          Assign Task
        </button>
      </div>

    </form>
  `);

  $("taskForm").onsubmit = createTask;
}

async function createTask(e) {

  e.preventDefault();

  const studentId = $("taskStudent").value;

  try {

    await addDoc(collection(db, "tasks"), {

      adminId: state.user.uid,

      studentId,

      title: $("taskTitle").value.trim(),

      description:
        $("taskDescription").value.trim(),

      deadline:
        $("taskDeadline").value,

      assignedAt:
        new Date().toISOString(),

      status: "pending",

      acceptedAt: null,

      completedAt: null,

      completionSeconds: null,

      createdAt: serverTimestamp()

    });

    closeModal();

    await loadAllData();

    renderTasks();

    toast("Task assigned successfully.");

  } catch (error) {

    toast(error.message, "error");
  }
}

function renderTasks() {

  if (!state.tasks.length) {

    $("tasksTable").innerHTML =
      `<div class="empty">No tasks yet.</div>`;

    return;
  }

  $("tasksTable").innerHTML = `

    <table>

      <thead>
        <tr>
          <th>Task</th>
          <th>Student</th>
          <th>Assigned</th>
          <th>Deadline</th>
          <th>Status</th>
          <th>Completion Time</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>

        ${state.tasks.map(task => `

          <tr>

            <td>
              <strong>${escapeHTML(task.title)}</strong>
            </td>

            <td>${escapeHTML(getStudentName(task.studentId))}</td>

            <td>${dateTimeString(task.assignedAt)}</td>

            <td>${dateTimeString(task.deadline)}</td>

            <td>
              <span class="status ${task.status === "completed" ? "completed" : "pending"}">
                ${escapeHTML(task.status || "pending")}
              </span>
            </td>

            <td>
              ${formatSeconds(task.completionSeconds)}
            </td>

            <td>

              <button
                class="small-btn danger"
                onclick="deleteTask('${task.id}')">
                Delete
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}

function formatSeconds(seconds) {

  if (!seconds) return "-";

  const s = Number(seconds);

  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  return `${h}h ${m}m ${sec}s`;
}

window.deleteTask = async function(id) {

  if (!confirm("Delete this task?")) return;

  await deleteDoc(doc(db, "tasks", id));

  await loadAllData();

  renderTasks();

  toast("Task deleted.");
};

/* =========================================================
   STUDENT TASKS
   ========================================================= */

function renderMyTasks() {

  if (!state.tasks.length) {

    $("myTasksGrid").innerHTML =
      `<div class="empty">No tasks assigned to you.</div>`;

    return;
  }

  $("myTasksGrid").innerHTML =
    state.tasks.map(task => {

      let action = "";

      if (task.status === "completed") {

        action = `
          <span class="status completed">
            Completed
          </span>
        `;

      } else if (!task.acceptedAt) {

        action = `
          <button class="small-btn primary"
            onclick="acceptTask('${task.id}')">
            Accept Task
          </button>
        `;

      } else {

        action = `
          <button class="small-btn primary"
            onclick="completeTask('${task.id}')">
            Complete Task
          </button>
        `;
      }

      return `
        <div class="task-card">

          <h3>${escapeHTML(task.title)}</h3>

          <p>${escapeHTML(task.description || "No description")}</p>

          <p>
            <strong>Assigned:</strong>
            ${dateTimeString(task.assignedAt)}
          </p>

          <p>
            <strong>Deadline:</strong>
            ${dateTimeString(task.deadline)}
          </p>

          <div class="card-actions">
            ${action}
          </div>

        </div>
      `;

    }).join("");
}

window.acceptTask = async function(id) {

  try {

    await updateDoc(doc(db, "tasks", id), {

      acceptedAt: new Date().toISOString(),

      status: "active"

    });

    await loadAllData();

    renderMyTasks();

    toast("Task accepted.");

  } catch (error) {

    toast(error.message, "error");
  }
};

window.completeTask = async function(id) {

  const task = state.tasks.find(x => x.id === id);

  if (!task) return;

  const accepted =
    new Date(task.acceptedAt).getTime();

  const completed =
    Date.now();

  const completionSeconds =
    Math.max(
      0,
      Math.floor((completed - accepted) / 1000)
    );

  await updateDoc(doc(db, "tasks", id), {

    completedAt: new Date().toISOString(),

    completionSeconds,

    status: "completed"

  });

  await loadAllData();

  renderMyTasks();

  toast("Task completed successfully.");
};

/* =========================================================
   ASSIGNMENTS
   ========================================================= */

$("addAssignmentBtn").onclick = openAddAssignment;

function openAddAssignment() {

  if (!state.students.length) {

    toast("Create a student first.", "error");

    return;
  }

  showModal("Create Assignment", `

    <form id="assignmentForm">

      <div class="form-grid">

        <div class="full">
          <label>Student</label>

          <select id="assignmentStudent" required>

            ${state.students.map(s => `
              <option value="${s.id}">
                ${escapeHTML(s.name)}
              </option>
            `).join("")}

          </select>
        </div>

        <div>
          <label>Assignment Title</label>
          <input id="assignmentTitle" required>
        </div>

        <div>
          <label>Total Marks</label>
          <input id="assignmentTotal" type="number" min="0" required>
        </div>

        <div>
          <label>Given Date</label>
          <input id="assignmentDate" type="date" required>
        </div>

        <div>
          <label>Submission Deadline</label>
          <input id="assignmentDeadline" type="date" required>
        </div>

        <div class="full">
          <label>Description</label>
          <textarea id="assignmentDescription"></textarea>
        </div>

      </div>

      <div class="form-actions">

        <button type="button"
          class="secondary-btn"
          onclick="closeModal()">
          Cancel
        </button>

        <button class="primary-btn">
          Create Assignment
        </button>

      </div>

    </form>
  `);

  $("assignmentForm").onsubmit =
    createAssignment;
}

async function createAssignment(e) {

  e.preventDefault();

  await addDoc(collection(db, "assignments"), {

    adminId: state.user.uid,

    studentId:
      $("assignmentStudent").value,

    title:
      $("assignmentTitle").value.trim(),

    description:
      $("assignmentDescription").value.trim(),

    totalMarks:
      Number($("assignmentTotal").value),

    givenDate:
      $("assignmentDate").value,

    deadline:
      $("assignmentDeadline").value,

    submitted: false,

    submissionDate: null,

    obtainedMarks: null,

    submittedLate: false,

    createdAt: serverTimestamp()

  });

  closeModal();

  await loadAllData();

  renderAssignments();

  toast("Assignment created.");
}

function renderAssignments() {

  if (!state.assignments.length) {

    $("assignmentsTable").innerHTML =
      `<div class="empty">No assignments yet.</div>`;

    return;
  }

  $("assignmentsTable").innerHTML = `

    <table>

      <thead>
        <tr>
          <th>Assignment</th>
          <th>Student</th>
          <th>Given</th>
          <th>Deadline</th>
          <th>Submitted</th>
          <th>Marks</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>

        ${state.assignments.map(a => `

          <tr>

            <td>
              <strong>${escapeHTML(a.title)}</strong>
            </td>

            <td>${escapeHTML(getStudentName(a.studentId))}</td>

            <td>${dateString(a.givenDate)}</td>

            <td>${dateString(a.deadline)}</td>

            <td>

              ${
                a.submitted
                ? `<span class="status completed">
                    ${dateString(a.submissionDate)}
                   </span>`
                : `<span class="status pending">
                    Not submitted
                   </span>`
              }

            </td>

            <td>
              ${a.obtainedMarks ?? "-"} /
              ${a.totalMarks}
            </td>

            <td>

              <button class="small-btn primary"
                onclick="editAssignment('${a.id}')">
                Update
              </button>

              <button class="small-btn danger"
                onclick="deleteAssignment('${a.id}')">
                Delete
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}

window.editAssignment = function(id) {

  const a = state.assignments.find(x => x.id === id);

  if (!a) return;

  showModal("Update Assignment", `

    <form id="editAssignmentForm">

      <label>Total Marks</label>
      <input id="editAssignmentTotal"
        type="number"
        value="${a.totalMarks}"
        min="0">

      <label>Obtained Marks</label>
      <input id="editAssignmentObtained"
        type="number"
        value="${a.obtainedMarks ?? ""}"
        min="0">

      <label>Submission Date</label>
      <input id="editAssignmentSubmission"
        type="date"
        value="${a.submissionDate || ""}">

      <div class="form-actions">

        <button type="button"
          class="secondary-btn"
          onclick="closeModal()">
          Cancel
        </button>

        <button class="primary-btn">
          Save
        </button>

      </div>

    </form>
  `);

  $("editAssignmentForm").onsubmit =
    async e => {

      e.preventDefault();

      const submission =
        $("editAssignmentSubmission").value;

      await updateDoc(
        doc(db, "assignments", id),
        {
          totalMarks:
            Number($("editAssignmentTotal").value),

          obtainedMarks:
            Number($("editAssignmentObtained").value || 0),

          submissionDate:
            submission || null,

          submitted:
            Boolean(submission),

          submittedLate:
            submission
              ? new Date(submission) >
                new Date(a.deadline)
              : false
        }
      );

      closeModal();

      await loadAllData();

      renderAssignments();

      toast("Assignment updated.");
    };
};

window.deleteAssignment = async function(id) {

  if (!confirm("Delete this assignment?")) return;

  await deleteDoc(
    doc(db, "assignments", id)
  );

  await loadAllData();

  renderAssignments();

  toast("Assignment deleted.");
};

/* =========================================================
   STUDENT ASSIGNMENTS
   ========================================================= */

function renderMyAssignments() {

  if (!state.assignments.length) {

    $("myAssignmentsTable").innerHTML =
      `<div class="empty">No assignments.</div>`;

    return;
  }

  $("myAssignmentsTable").innerHTML = `

    <table>

      <thead>

        <tr>
          <th>Assignment</th>
          <th>Given Date</th>
          <th>Deadline</th>
          <th>Marks</th>
          <th>Status</th>
          <th>Action</th>
        </tr>

      </thead>

      <tbody>

        ${state.assignments.map(a => `

          <tr>

            <td>
              <strong>${escapeHTML(a.title)}</strong>
            </td>

            <td>${dateString(a.givenDate)}</td>

            <td>${dateString(a.deadline)}</td>

            <td>
              ${a.obtainedMarks ?? "-"} / ${a.totalMarks}
            </td>

            <td>

              ${
                a.submitted
                ? `<span class="status completed">Submitted</span>`
                : `<span class="status pending">Pending</span>`
              }

            </td>

            <td>

              ${
                !a.submitted
                ? `
                  <button class="small-btn primary"
                    onclick="submitAssignment('${a.id}')">
                    Submit
                  </button>
                `
                : "-"
              }

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}

window.submitAssignment = async function(id) {

  const a =
    state.assignments.find(x => x.id === id);

  if (!a) return;

  const today =
    new Date().toISOString().slice(0, 10);

  const late =
    new Date(today) >
    new Date(a.deadline);

  await updateDoc(
    doc(db, "assignments", id),
    {
      submitted: true,
      submissionDate: today,
      submittedLate: late
    }
  );

  await loadAllData();

  renderMyAssignments();

  toast(
    late
      ? "Assignment submitted late."
      : "Assignment submitted on time."
  );
};

/* =========================================================
   TESTS
   ========================================================= */

$("addTestBtn").onclick = openAddTest;

function openAddTest() {

  if (!state.students.length) {

    toast("Create a student first.", "error");

    return;
  }

  showModal("Add Test", `

    <form id="testForm">

      <div class="form-grid">

        <div class="full">
          <label>Student</label>

          <select id="testStudent">

            ${state.students.map(s => `
              <option value="${s.id}">
                ${escapeHTML(s.name)}
              </option>
            `).join("")}

          </select>
        </div>

        <div>
          <label>Test Title</label>
          <input id="testTitle" required>
        </div>

        <div>
          <label>Test Date</label>
          <input id="testDate" type="date" required>
        </div>

        <div>
          <label>Total Marks</label>
          <input id="testTotal" type="number" min="0" required>
        </div>

        <div>
          <label>Obtained Marks</label>
          <input id="testObtained" type="number" min="0" required>
        </div>

      </div>

      <div class="form-actions">

        <button type="button"
          class="secondary-btn"
          onclick="closeModal()">
          Cancel
        </button>

        <button class="primary-btn">
          Save Test
        </button>

      </div>

    </form>
  `);

  $("testForm").onsubmit = createTest;
}

async function createTest(e) {

  e.preventDefault();

  const total =
    Number($("testTotal").value);

  const obtained =
    Number($("testObtained").value);

  await addDoc(collection(db, "tests"), {

    adminId:
      state.user.uid,

    studentId:
      $("testStudent").value,

    title:
      $("testTitle").value.trim(),

    date:
      $("testDate").value,

    totalMarks:
      total,

    obtainedMarks:
      obtained,

    percentage:
      percentage(obtained, total),

    createdAt:
      serverTimestamp()
  });

  closeModal();

  await loadAllData();

  renderTests();

  toast("Test result saved.");
}

function renderTests() {

  if (!state.tests.length) {

    $("testsTable").innerHTML =
      `<div class="empty">No tests yet.</div>`;

    return;
  }

  $("testsTable").innerHTML = `

    <table>

      <thead>

        <tr>
          <th>Test</th>
          <th>Student</th>
          <th>Date</th>
          <th>Marks</th>
          <th>Percentage</th>
          <th>Action</th>
        </tr>

      </thead>

      <tbody>

        ${state.tests.map(t => `

          <tr>

            <td>
              <strong>${escapeHTML(t.title)}</strong>
            </td>

            <td>
              ${escapeHTML(getStudentName(t.studentId))}
            </td>

            <td>${dateString(t.date)}</td>

            <td>
              ${t.obtainedMarks} / ${t.totalMarks}
            </td>

            <td>
              ${t.percentage || 0}%
            </td>

            <td>

              <button class="small-btn danger"
                onclick="deleteTest('${t.id}')">
                Delete
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}

window.deleteTest = async function(id) {

  if (!confirm("Delete this test result?")) return;

  await deleteDoc(
    doc(db, "tests", id)
  );

  await loadAllData();

  renderTests();

  toast("Test deleted.");
};

/* =========================================================
   STUDENT TESTS
   ========================================================= */

function renderMyTests() {

  if (!state.tests.length) {

    $("myTestsTable").innerHTML =
      `<div class="empty">No test results.</div>`;

    return;
  }

  $("myTestsTable").innerHTML = `

    <table>

      <thead>

        <tr>
          <th>Test</th>
          <th>Date</th>
          <th>Marks</th>
          <th>Percentage</th>
        </tr>

      </thead>

      <tbody>

        ${state.tests.map(t => `

          <tr>

            <td>
              <strong>${escapeHTML(t.title)}</strong>
            </td>

            <td>${dateString(t.date)}</td>

            <td>
              ${t.obtainedMarks} / ${t.totalMarks}
            </td>

            <td>${t.percentage || 0}%</td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}

/* =========================================================
   SUPER ADMIN
   ========================================================= */

function renderAdmins() {

  if (!state.admins.length) {

    $("adminsGrid").innerHTML =
      `<div class="empty">No admins found.</div>`;

    return;
  }

  $("adminsGrid").innerHTML =
    state.admins.map(admin => {

      const students =
        state.students.filter(
          s => s.adminId === admin.id
        );

      const adminTasks =
        state.tasks.filter(
          t => t.adminId === admin.id
        );

      const completed =
        adminTasks.filter(
          t => t.status === "completed"
        ).length;

      const progress =
        percentage(
          completed,
          adminTasks.length
        );

      return `

        <div class="person-card">

          <div class="person-top">

            <div class="avatar">
              ${getInitials(admin.name)}
            </div>

            <div>

              <h3>
                ${escapeHTML(admin.name)}
              </h3>

              <p>
                ${escapeHTML(admin.email)}
              </p>

            </div>

          </div>

          <p>
            Students:
            <strong>${students.length}</strong>
          </p>

          <p>
            Tasks:
            <strong>${adminTasks.length}</strong>
          </p>

          <div class="progress-box">

            <div class="progress-label">
              <span>Class Task Progress</span>
              <strong>${progress}%</strong>
            </div>

            <div class="progress-track">
              <div
                class="progress-fill"
                style="width:${progress}%">
              </div>
            </div>

          </div>

        </div>
      `;

    }).join("");
}

/* =========================================================
   MODAL CLOSE
   ========================================================= */

$("closeModal").onclick = closeModal;

$("modal").addEventListener("click", e => {

  if (e.target === $("modal")) {
    closeModal();
  }

});

$("closeStudentModal").onclick = () => {
  $("studentModal").classList.add("hidden");
};

$("studentModal").addEventListener("click", e => {

  if (e.target === $("studentModal")) {
    $("studentModal").classList.add("hidden");
  }

});

/* =========================================================
   INITIAL
   ========================================================= */

window.closeModal = closeModal;
