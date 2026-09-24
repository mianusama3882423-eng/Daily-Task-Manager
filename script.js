// ============================================================
// DAILY TASK MANAGER v2.0.0
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// ============================================================
// VERSION
// ============================================================

const VERSION = "2.0.0";


// ============================================================
// FIREBASE
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBHerMjZdE-OTlqtdsZ35k3V15SEyHzuVc",
  authDomain: "daily-task-manager-6c31b.firebaseapp.com",
  projectId: "daily-task-manager-6c31b",
  storageBucket: "daily-task-manager-6c31b.firebasestorage.app",
  messagingSenderId: "372365923221",
  appId: "1:372365923221:web:fa91cd423524d150669c9c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ============================================================
// STATE
// ============================================================

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


// ============================================================
// HELPERS
// ============================================================

const $ = id => document.getElementById(id);

function roleName(role) {
  return {
    superadmin: "Super Admin",
    admin: "Admin",
    student: "Student"
  }[role] || "Account";
}

function isAdmin() {
  return state.profile?.role === "admin";
}

function isSuperAdmin() {
  return state.profile?.role === "superadmin";
}

function isStudent() {
  return state.profile?.role === "student";
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name) {
  return (name || "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase() || "U";
}

function getDateObject(value) {
  if (!value) return null;

  if (value?.toDate) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const date = getDateObject(value);

  if (!date) return "-";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value) {
  const date = getDateObject(value);

  if (!date) return "-";

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatSeconds(seconds) {
  seconds = Number(seconds);

  if (!Number.isFinite(seconds)) {
    return "-";
  }

  seconds = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  if (minutes) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

function todayISO() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function toast(message, type = "success") {
  const box = $("toast");

  if (!box) return;

  box.textContent = message;

  box.className = `toast ${type} show`;

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    box.classList.remove("show");
  }, 3000);
}

function setBusy(button, busy, text = "Saving...") {
  if (!button) return;

  if (busy) {
    button.dataset.oldText = button.textContent;
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;
    button.textContent =
      button.dataset.oldText || button.textContent;
  }
}

function emptyState(message, icon = "○") {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <strong>${escapeHtml(message)}</strong>
    </div>
  `;
}

function statusBadge(status) {
  const value = String(status || "pending").toLowerCase();

  let cls = "";

  if (
    value === "completed" ||
    value === "submitted" ||
    value === "passed"
  ) {
    cls = "success";
  }

  if (
    value === "accepted" ||
    value === "pending"
  ) {
    cls = "warning";
  }

  if (
    value === "overdue" ||
    value === "failed"
  ) {
    cls = "danger";
  }

  return `
    <span class="status-badge ${cls}">
      ${escapeHtml(value)}
    </span>
  `;
}

function getFirebaseError(error) {
  const map = {
    "auth/invalid-credential":
      "Invalid email or password.",

    "auth/invalid-login-credentials":
      "Invalid email or password.",

    "auth/user-not-found":
      "Account not found.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/weak-password":
      "Password must contain at least 6 characters.",

    "auth/invalid-email":
      "Please enter a valid email.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "permission-denied":
      "You do not have permission for this action."
  };

  return map[error?.code] ||
    error?.message ||
    "Something went wrong.";
}


// ============================================================
// AUTH UI
// ============================================================

function showAuth() {
  $("authScreen")?.classList.remove("hidden");
  $("appScreen")?.classList.add("hidden");
}

function showApp() {
  $("authScreen")?.classList.add("hidden");
  $("appScreen")?.classList.remove("hidden");
}

function setupAuthTabs() {
  $("loginTab")?.addEventListener("click", () => {
    $("loginTab").classList.add("active");
    $("registerTab")?.classList.remove("active");

    $("loginPanel")?.classList.remove("hidden");
    $("registerPanel")?.classList.add("hidden");
  });

  $("registerTab")?.addEventListener("click", () => {
    $("registerTab").classList.add("active");
    $("loginTab")?.classList.remove("active");

    $("registerPanel")?.classList.remove("hidden");
    $("loginPanel")?.classList.add("hidden");
  });
}


// ============================================================
// ADMIN REGISTRATION
// ============================================================

function setupAdminRegistration() {
  $("registerForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const button =
      form.querySelector("button[type='submit']");

    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;
    const confirm = $("registerConfirm").value;

    if (!name || !email || !password) {
      toast("Please fill all required fields.", "error");
      return;
    }

    if (password.length < 6) {
      toast(
        "Password must contain at least 6 characters.",
        "error"
      );
      return;
    }

    if (password !== confirm) {
      toast("Passwords do not match.", "error");
      return;
    }

    setBusy(button, true, "Creating...");

    try {
      const response = await fetch(
        "/api/register-admin",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            email,
            password
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          "Registration failed."
        );
      }

      form.reset();

      $("loginTab")?.click();

      $("loginEmail").value = email;

      toast("Admin account created successfully.");
    } catch (error) {
      console.error(error);

      toast(
        error.message ||
        "Registration failed.",
        "error"
      );
    } finally {
      setBusy(button, false);
    }
  });
}


// ============================================================
// LOGIN
// ============================================================

function setupLogin() {
  $("loginForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const button =
      form.querySelector("button[type='submit']");

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    if (!email || !password) {
      toast(
        "Please enter email and password.",
        "error"
      );
      return;
    }

    setBusy(button, true, "Signing in...");

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      toast("Login successful.");
    } catch (error) {
      toast(
        getFirebaseError(error),
        "error"
      );
    } finally {
      setBusy(button, false);
    }
  });
}


// ============================================================
// LOGOUT
// ============================================================

function setupLogout() {
  document
    .querySelectorAll(
      "[data-action='logout'], #logoutBtn, #sideLogout"
    )
    .forEach(button => {
      button.addEventListener("click", async () => {
        try {
          await signOut(auth);
        } catch (error) {
          toast(
            getFirebaseError(error),
            "error"
          );
        }
      });
    });
}


// ============================================================
// LOAD DATA
// ============================================================

async function loadAllData() {
  if (!state.user || !state.profile) {
    return;
  }

  if (isSuperAdmin()) {
    await loadSuperAdminData();
  } else if (isAdmin()) {
    await loadAdminData();
  } else if (isStudent()) {
    await loadStudentData();
  }

  renderEverything();
}


async function loadAdminData() {
  const uid = state.user.uid;

  const [
    studentsSnap,
    tasksSnap,
    assignmentsSnap,
    testsSnap
  ] = await Promise.all([
    getDocs(
      query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("adminId", "==", uid)
      )
    ),

    getDocs(
      query(
        collection(db, "tasks"),
        where("adminId", "==", uid)
      )
    ),

    getDocs(
      query(
        collection(db, "assignments"),
        where("adminId", "==", uid)
      )
    ),

    getDocs(
      query(
        collection(db, "tests"),
        where("adminId", "==", uid)
      )
    )
  ]);

  state.students =
    studentsSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  state.admins = [];

  state.tasks =
    tasksSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  state.assignments =
    assignmentsSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  state.tests =
    testsSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
}


async function loadSuperAdminData() {
  const [
    usersSnap,
    tasksSnap,
    assignmentsSnap,
    testsSnap
  ] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "tasks")),
    getDocs(collection(db, "assignments")),
    getDocs(collection(db, "tests"))
  ]);

  const users =
    usersSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  state.students =
    users.filter(user => user.role === "student");

  state.admins =
    users.filter(user => user.role === "admin");

  state.tasks =
    tasksSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  state.assignments =
    assignmentsSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  state.tests =
    testsSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
}


async function loadStudentData() {
  const uid = state.user.uid;

  const [
    tasksSnap,
    assignmentsSnap,
    testsSnap
  ] = await Promise.all([
    getDocs(
      query(
        collection(db, "tasks"),
        where("studentId", "==", uid)
      )
    ),

    getDocs(
      query(
        collection(db, "assignments"),
        where("studentId", "==", uid)
      )
    ),

    getDocs(
      query(
        collection(db, "tests"),
        where("studentId", "==", uid)
      )
    )
  ]);

  state.students = [];
  state.admins = [];

  state.tasks =
    tasksSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  state.assignments =
    assignmentsSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  state.tests =
    testsSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
}


// ============================================================
// USER INFO
// ============================================================

function renderUserInfo() {
  const name =
    state.profile?.name ||
    state.user?.email ||
    "User";

  document
    .querySelectorAll("[data-user-name]")
    .forEach(element => {
      if (element.classList.contains("avatar")) {
        element.textContent = initials(name);
      } else {
        element.textContent = name;
      }
    });

  document
    .querySelectorAll("[data-user-email]")
    .forEach(element => {
      element.textContent =
        state.profile?.email ||
        state.user?.email ||
        "";
    });

  document
    .querySelectorAll("[data-user-role]")
    .forEach(element => {
      element.textContent =
        roleName(state.profile?.role);
    });
}


// ============================================================
// ROLE VISIBILITY
// ============================================================

function updateRoleVisibility() {
  const role = state.profile?.role;

  document
    .querySelectorAll("[data-role]")
    .forEach(element => {
      const allowed =
        element.dataset.role
          .split(",")
          .map(x => x.trim());

      element.style.display =
        allowed.includes(role)
          ? ""
          : "none";
    });

  const adminControls =
    isAdmin() || isSuperAdmin();

  [
    "addStudentBtn",
    "addTaskBtn",
    "addAssignmentBtn",
    "addTestBtn"
  ].forEach(id => {
    if ($(id)) {
      $(id).style.display =
        adminControls ? "" : "none";
    }
  });
}


// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {
  const stats = $("statsGrid");
  if (!stats) return;

  const today =
    new Date().toLocaleDateString(
      undefined,
      {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );

  setText("dashboardDate", today);

  if (isStudent()) {
    renderStudentDashboard(stats);
  } else {
    renderAdminDashboard(stats);
  }

  renderRecentActivity();
  renderDashboardProgress();
}


function statCard(icon, label, value, note) {
  return `
    <div class="stat-card">
      <div class="stat-top">
        <span class="stat-label">
          ${escapeHtml(label)}
        </span>

        <span class="stat-icon">
          ${icon}
        </span>
      </div>

      <div class="stat-value">
        ${escapeHtml(value)}
      </div>

      <div class="stat-note">
        ${escapeHtml(note || "")}
      </div>
    </div>
  `;
}


function renderAdminDashboard(container) {
  const totalStudents =
    state.students.length;

  const completedTasks =
    state.tasks.filter(
      task => task.status === "completed"
    ).length;

  const submittedAssignments =
    state.assignments.filter(
      item => item.submitted === true
    ).length;

  const totalTests =
    state.tests.length;

  container.innerHTML = `
    ${statCard(
      "♟",
      "Students",
      totalStudents,
      "Students under management"
    )}

    ${statCard(
      "✓",
      "Completed Tasks",
      completedTasks,
      `${state.tasks.length} total tasks`
    )}

    ${statCard(
      "▤",
      "Submissions",
      submittedAssignments,
      `${state.assignments.length} assignments`
    )}

    ${statCard(
      "▣",
      "Tests",
      totalTests,
      "Recorded tests"
    )}
  `;

  setText(
    "dashboardTitle",
    isSuperAdmin()
      ? "Super Admin Dashboard"
      : "Admin Dashboard"
  );

  setText(
    "dashboardSubtitle",
    isSuperAdmin()
      ? "Manage the complete platform."
      : "Manage your students and academic work."
  );
}


function renderStudentDashboard(container) {
  const completed =
    state.tasks.filter(
      task => task.status === "completed"
    ).length;

  const submitted =
    state.assignments.filter(
      assignment =>
        assignment.submitted === true
    ).length;

  const progress =
    calculateOverallProgress();

  container.innerHTML = `
    ${statCard(
      "✓",
      "My Tasks",
      state.tasks.length,
      `${completed} completed`
    )}

    ${statCard(
      "▤",
      "Assignments",
      state.assignments.length,
      `${submitted} submitted`
    )}

    ${statCard(
      "▣",
      "Tests",
      state.tests.length,
      "Available results"
    )}

    ${statCard(
      "%",
      "Overall Progress",
      `${progress}%`,
      "Current academic progress"
    )}
  `;

  setText(
    "dashboardTitle",
    "Student Dashboard"
  );

  setText(
    "dashboardSubtitle",
    `Welcome back, ${state.profile?.name || "Student"}.`
  );
}


// ============================================================
// RECENT ACTIVITY
// ============================================================

function renderRecentActivity() {
  const container = $("recentActivity");
  if (!container) return;

  const activities = [];

  state.tasks.forEach(task => {
    activities.push({
      date:
        getDateObject(task.createdAt) ||
        getDateObject(task.assignedAt),

      title:
        `Task: ${task.title || "Untitled"}`,

      detail:
        task.status || "pending"
    });
  });

  state.assignments.forEach(item => {
    activities.push({
      date:
        getDateObject(item.createdAt) ||
        getDateObject(item.deadline),

      title:
        `Assignment: ${item.title || "Untitled"}`,

      detail:
        item.submitted
          ? "Submitted"
          : "Pending"
    });
  });

  state.tests.forEach(test => {
    activities.push({
      date:
        getDateObject(test.createdAt),

      title:
        `Test: ${test.title || "Untitled"}`,

      detail:
        test.marks != null
          ? `${test.marks}/${test.totalMarks || 100}`
          : "Result pending"
    });
  });

  activities.sort(
    (a, b) =>
      (b.date?.getTime() || 0) -
      (a.date?.getTime() || 0)
  );

  if (!activities.length) {
    container.innerHTML =
      emptyState(
        "No recent activity yet.",
        "◌"
      );

    return;
  }

  container.innerHTML =
    activities
      .slice(0, 8)
      .map(item => `
        <div class="activity-item">
          <div class="activity-dot"></div>

          <div>
            <strong>
              ${escapeHtml(item.title)}
            </strong>

            <span>
              ${escapeHtml(item.detail)}
              ·
              ${formatDateTime(item.date)}
            </span>
          </div>
        </div>
      `)
      .join("");
}


// ============================================================
// PROGRESS
// ============================================================

function calculateTaskProgress(tasks) {
  if (!tasks.length) return null;

  const completed =
    tasks.filter(
      task => task.status === "completed"
    ).length;

  return Math.round(
    (completed / tasks.length) * 100
  );
}

function calculateAssignmentProgress(assignments) {
  if (!assignments.length) return null;

  const submitted =
    assignments.filter(
      item => item.submitted === true
    ).length;

  return Math.round(
    (submitted / assignments.length) * 100
  );
}

function calculateTestProgress(tests) {
  if (!tests.length) return null;

  const percentages =
    tests
      .filter(
        test =>
          test.marks !== undefined &&
          test.marks !== null &&
          Number(test.totalMarks) > 0
      )
      .map(
        test =>
          (Number(test.marks) /
            Number(test.totalMarks)) *
          100
      );

  if (!percentages.length) return null;

  return Math.round(
    percentages.reduce(
      (sum, value) => sum + value,
      0
    ) / percentages.length
  );
}

function calculateOverallProgress() {
  const values = [
    calculateTaskProgress(state.tasks),
    calculateAssignmentProgress(state.assignments),
    calculateTestProgress(state.tests)
  ].filter(
    value => value !== null
  );

  if (!values.length) return 0;

  return Math.round(
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function progressRow(label, value) {
  const safeValue =
    value === null ? 0 : value;

  return `
    <div class="progress-row">

      <div class="progress-head">
        <span>${escapeHtml(label)}</span>
        <strong>${safeValue}%</strong>
      </div>

      <div class="progress-bar">
        <span style="width:${safeValue}%"></span>
      </div>

    </div>
  `;
}

function renderDashboardProgress() {
  const container =
    $("dashboardProgress");

  if (!container) return;

  if (isStudent()) {
    container.innerHTML = `
      <div class="progress-summary">
        ${progressRow(
          "Tasks",
          calculateTaskProgress(state.tasks)
        )}

        ${progressRow(
          "Assignments",
          calculateAssignmentProgress(
            state.assignments
          )
        )}

        ${progressRow(
          "Tests",
          calculateTestProgress(state.tests)
        )}

        ${progressRow(
          "Overall",
          calculateOverallProgress()
        )}
      </div>
    `;

    return;
  }

  if (!state.students.length) {
    container.innerHTML =
      emptyState(
        "No students available.",
        "♟"
      );

    return;
  }

  container.innerHTML =
    state.students
      .slice(0, 6)
      .map(student => {
        const progress =
          getStudentProgress(student.id);

        return `
          <div class="progress-row">
            <div class="progress-head">
              <span>
                ${escapeHtml(student.name || "Student")}
              </span>

              <strong>
                ${progress.overall}%
              </strong>
            </div>

            <div class="progress-bar">
              <span style="width:${progress.overall}%"></span>
            </div>
          </div>
        `;
      })
      .join("");
}


// ============================================================
// STUDENT PROGRESS
// ============================================================

function getStudentProgress(studentId) {
  const tasks =
    state.tasks.filter(
      task => task.studentId === studentId
    );

  const assignments =
    state.assignments.filter(
      item => item.studentId === studentId
    );

  const tests =
    state.tests.filter(
      test => test.studentId === studentId
    );

  const taskProgress =
    calculateTaskProgress(tasks);

  const assignmentProgress =
    calculateAssignmentProgress(
      assignments
    );

  const testProgress =
    calculateTestProgress(tests);

  const values = [
    taskProgress,
    assignmentProgress,
    testProgress
  ].filter(
    value => value !== null
  );

  const overall =
    values.length
      ? Math.round(
          values.reduce(
            (a, b) => a + b,
            0
          ) / values.length
        )
      : 0;

  return {
    tasks,
    assignments,
    tests,
    taskProgress,
    assignmentProgress,
    testProgress,
    overall
  };
}


// ============================================================
// STUDENTS
// ============================================================

function renderStudents() {
  const container =
    $("studentsList");

  if (!container) return;

  if (!isAdmin() && !isSuperAdmin()) {
    container.innerHTML = "";
    return;
  }

  const search =
    $("studentSearch")?.value
      .trim()
      .toLowerCase() || "";

  const students =
    state.students.filter(student => {
      const text =
        `${student.name || ""} ${student.email || ""} ${student.className || ""}`
          .toLowerCase();

      return text.includes(search);
    });

  if (!students.length) {
    container.innerHTML =
      emptyState(
        search
          ? "No students match your search."
          : "No students found.",
        "♟"
      );

    return;
  }

  container.innerHTML =
    students.map(student => {
      const progress =
        getStudentProgress(student.id);

      return `
        <div class="student-card">

          <div class="card-top">

            <div class="person">

              <div class="mini-avatar">
                ${initials(student.name)}
              </div>

              <div>
                <h3>
                  ${escapeHtml(
                    student.name ||
                    "Student"
                  )}
                </h3>

                <p>
                  ${escapeHtml(
                    student.email || ""
                  )}
                </p>
              </div>

            </div>

            ${statusBadge(
              student.active === false
                ? "inactive"
                : "active"
            )}

          </div>

          <div class="card-meta">

            <div>
              Age:
              <strong>
                ${escapeHtml(
                  student.age ?? "-"
                )}
              </strong>
            </div>

            <div>
              Class:
              <strong>
                ${escapeHtml(
                  student.className ||
                  "Not set"
                )}
              </strong>
            </div>

            <div>
              Overall:
              <strong>
                ${progress.overall}%
              </strong>
            </div>

          </div>

          <div class="progress-bar">
            <span
              style="width:${progress.overall}%">
            </span>
          </div>

          <div class="card-actions">

            <button
              onclick="window.viewStudent('${student.id}')">
              View Progress
            </button>

            <button
              class="danger"
              onclick="window.deleteStudent('${student.id}')">
              Delete
            </button>

          </div>

        </div>
      `;
    }).join("");
}

$("studentSearch")?.addEventListener(
  "input",
  renderStudents
);


// ============================================================
// ADD STUDENT
// ============================================================

function openAddStudent() {
  if (!isAdmin() && !isSuperAdmin()) {
    toast(
      "You do not have permission.",
      "error"
    );
    return;
  }

  let adminOptions = "";

  if (isSuperAdmin()) {
    adminOptions = `
      <div>
        <label>Assign Admin</label>

        <select id="studentAdminId">
          <option value="">
            No Admin Assigned
          </option>

          ${state.admins.map(admin => `
            <option value="${admin.id}">
              ${escapeHtml(
                admin.name ||
                admin.email
              )}
            </option>
          `).join("")}
        </select>
      </div>
    `;
  }

  showModal(
    "Add Student",
    `
      <form id="studentForm">

        <div class="form-grid">

          <div>
            <label>Student Name</label>
            <input
              id="studentName"
              required
              placeholder="Enter student name">
          </div>

          <div>
            <label>Email</label>
            <input
              id="studentEmail"
              type="email"
              required
              placeholder="student@email.com">
          </div>

          <div>
            <label>Password</label>
            <input
              id="studentPassword"
              type="password"
              minlength="6"
              required
              placeholder="Minimum 6 characters">
          </div>

          <div>
            <label>Age</label>
            <input
              id="studentAge"
              type="number"
              min="1"
              max="100"
              placeholder="Age">
          </div>

          <div>
            <label>Class</label>
            <input
              id="studentClass"
              placeholder="e.g. CIT 1st Year">
          </div>

          ${adminOptions}

        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="secondary-btn"
            onclick="window.closeAppModal()">
            Cancel
          </button>

          <button
            class="primary-btn"
            type="submit">
            Create Student
          </button>

        </div>

      </form>
    `
  );

  $("studentForm")?.addEventListener(
    "submit",
    createStudent
  );
}


async function createStudent(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button =
    form.querySelector(
      "button[type='submit']"
    );

  const payload = {
    name: $("studentName").value.trim(),
    email: $("studentEmail").value.trim(),
    password: $("studentPassword").value,
    age: $("studentAge").value
      ? Number($("studentAge").value)
      : null,

    className:
      $("studentClass").value.trim(),

    adminId:
      isSuperAdmin()
        ? ($("studentAdminId")?.value || null)
        : null
  };

  if (
    !payload.name ||
    !payload.email ||
    !payload.password
  ) {
    toast(
      "Please fill all required fields.",
      "error"
    );
    return;
  }

  setBusy(
    button,
    true,
    "Creating..."
  );

  try {
    const idToken =
      await state.user.getIdToken();

    const response =
      await fetch(
        "/api/create-user",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${idToken}`
          },

          body:
            JSON.stringify(payload)
        }
      );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Student creation failed."
      );
    }

    closeAppModal();

    await loadAllData();

    toast(
      "Student account created successfully."
    );

  } catch (error) {
    console.error(error);

    toast(
      error.message ||
      "Student creation failed.",
      "error"
    );
  } finally {
    setBusy(button, false);
  }
}


// ============================================================
// VIEW STUDENT
// ============================================================

function viewStudent(studentId) {
  const student =
    state.students.find(
      x => x.id === studentId
    );

  if (!student) {
    toast(
      "Student not found.",
      "error"
    );
    return;
  }

  const progress =
    getStudentProgress(studentId);

  showModal(
    `${student.name || "Student"} — Progress`,
    `
      <div class="student-detail-grid">

        <div class="detail-box">
          <small>Tasks</small>
          <strong>
            ${progress.taskProgress ?? 0}%
          </strong>
        </div>

        <div class="detail-box">
          <small>Assignments</small>
          <strong>
            ${progress.assignmentProgress ?? 0}%
          </strong>
        </div>

        <div class="detail-box">
          <small>Tests</small>
          <strong>
            ${progress.testProgress ?? 0}%
          </strong>
        </div>

        <div class="detail-box">
          <small>Overall</small>
          <strong>
            ${progress.overall}%
          </strong>
        </div>

        <div class="detail-box">
          <small>Age</small>
          <strong>
            ${escapeHtml(
              student.age ?? "-"
            )}
          </strong>
        </div>

        <div class="detail-box">
          <small>Class</small>
          <strong>
            ${escapeHtml(
              student.className ||
              "-"
            )}
          </strong>
        </div>

      </div>

      <div style="margin-top:20px">
        ${progressRow(
          "Tasks",
          progress.taskProgress
        )}

        ${progressRow(
          "Assignments",
          progress.assignmentProgress
        )}

        ${progressRow(
          "Tests",
          progress.testProgress
        )}

        ${progressRow(
          "Overall",
          progress.overall
        )}
      </div>
    `
  );
}


// ============================================================
// DELETE STUDENT
// ============================================================

async function deleteStudent(studentId) {
  if (!isAdmin() && !isSuperAdmin()) {
    toast(
      "You do not have permission.",
      "error"
    );
    return;
  }

  const student =
    state.students.find(
      x => x.id === studentId
    );

  if (!student) return;

  const confirmed =
    confirm(
      `Delete ${student.name || "this student"}?\n\nThis will permanently delete the student account and related tasks, assignments and tests.`
    );

  if (!confirmed) return;

  try {
    const token =
      await state.user.getIdToken();

    const response =
      await fetch(
        "/api/delete-user",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`
          },

          body:
            JSON.stringify({
              userId: studentId
            })
        }
      );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Delete failed."
      );
    }

    await loadAllData();

    toast(
      "Student deleted successfully."
    );

  } catch (error) {
    console.error(error);

    toast(
      error.message ||
      "Student deletion failed.",
      "error"
    );
  }
}


// ============================================================
// TASKS
// ============================================================

function renderTasks() {
  const container =
    $("tasksList");

  if (!container) return;

  if (!isAdmin() && !isSuperAdmin()) {
    container.innerHTML = "";
    return;
  }

  if (!state.tasks.length) {
    container.innerHTML =
      emptyState(
        "No tasks have been created yet.",
        "✓"
      );
    return;
  }

  container.innerHTML = `
    <table class="data-table">

      <thead>
        <tr>
          <th>Task</th>
          <th>Student</th>
          <th>Assigned</th>
          <th>Status</th>
          <th>Time</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>

        ${state.tasks.map(task => {

          const student =
            state.students.find(
              x => x.id === task.studentId
            );

          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    task.title ||
                    "Untitled"
                  )}
                </strong>

                <div class="muted">
                  ${escapeHtml(
                    task.description ||
                    ""
                  )}
                </div>
              </td>

              <td>
                ${escapeHtml(
                  student?.name ||
                  task.studentName ||
                  "Student"
                )}
              </td>

              <td>
                ${formatDate(
                  task.assignedAt ||
                  task.createdAt
                )}
              </td>

              <td>
                ${statusBadge(
                  task.status ||
                  "pending"
                )}
              </td>

              <td>
                ${formatSeconds(
                  task.completionSeconds
                )}
              </td>

              <td>

                <button
                  class="table-btn danger"
                  onclick="window.deleteTask('${task.id}')">
                  Delete
                </button>

              </td>

            </tr>
          `;

        }).join("")}

      </tbody>

    </table>
  `;
}


function openAddTask() {
  if (!isAdmin() && !isSuperAdmin()) {
    toast(
      "You do not have permission.",
      "error"
    );
    return;
  }

  if (!state.students.length) {
    toast(
      "Create a student first.",
      "error"
    );
    return;
  }

  showModal(
    "Create Task",
    `
      <form id="taskForm">

        <div class="form-grid">

          <div>
            <label>Task Title</label>
            <input
              id="taskTitle"
              required
              placeholder="e.g. Complete practical">
          </div>

          <div>
            <label>Student</label>

            <select
              id="taskStudent"
              required>

              <option value="">
                Select student
              </option>

              ${state.students.map(
                student => `
                  <option
                    value="${student.id}">
                    ${escapeHtml(
                      student.name ||
                      student.email
                    )}
                  </option>
                `
              ).join("")}

            </select>
          </div>

          <div class="full">
            <label>Description</label>

            <textarea
              id="taskDescription"
              placeholder="Task instructions">
            </textarea>
          </div>

        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="secondary-btn"
            onclick="window.closeAppModal()">
            Cancel
          </button>

          <button
            class="primary-btn"
            type="submit">
            Create Task
          </button>

        </div>

      </form>
    `
  );

  $("taskForm")?.addEventListener(
    "submit",
    createTask
  );
}


async function createTask(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button =
    form.querySelector(
      "button[type='submit']"
    );

  const studentId =
    $("taskStudent").value;

  const student =
    state.students.find(
      x => x.id === studentId
    );

  setBusy(
    button,
    true,
    "Creating..."
  );

  try {
    await addDoc(
      collection(db, "tasks"),
      {
        title:
          $("taskTitle").value.trim(),

        description:
          $("taskDescription").value.trim(),

        studentId,

        studentName:
          student?.name || "",

        adminId:
          state.profile.role === "admin"
            ? state.user.uid
            : (
                student?.adminId ||
                null
              ),

        status: "pending",

        assignedAt:
          serverTimestamp(),

        createdAt:
          serverTimestamp(),

        acceptedAt: null,

        completedAt: null,

        completionSeconds: null,

        updatedAt:
          serverTimestamp()
      }
    );

    closeAppModal();

    await loadAllData();

    toast("Task created successfully.");

  } catch (error) {
    console.error(error);

    toast(
      getFirebaseError(error),
      "error"
    );
  } finally {
    setBusy(button, false);
  }
}


async function acceptTask(taskId) {
  if (!isStudent()) return;

  const task =
    state.tasks.find(
      x => x.id === taskId
    );

  if (!task) return;

  try {
    if (
      task.status !== "completed"
    ) {
      if (
        task.status !== "accepted"
      ) {
        await updateDoc(
          doc(db, "tasks", taskId),
          {
            status: "accepted",
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
        );

        toast(
          "Task accepted. Timer started."
        );

      } else {
        const start =
          getDateObject(
            task.assignedAt ||
            task.acceptedAt
          );

        const end =
          new Date();

        const seconds =
          start
            ? Math.max(
                0,
                Math.floor(
                  (end - start) / 1000
                )
              )
            : null;

        await updateDoc(
          doc(db, "tasks", taskId),
          {
            status: "completed",
            completedAt:
              serverTimestamp(),

            completionSeconds:
              seconds,

            updatedAt:
              serverTimestamp()
          }
        );

        toast(
          "Task completed successfully."
        );
      }

      await loadAllData();
    }
  } catch (error) {
    toast(
      getFirebaseError(error),
      "error"
    );
  }
}


async function deleteTask(taskId) {
  if (!isAdmin() && !isSuperAdmin()) return;

  if (!confirm("Delete this task?")) return;

  try {
    await deleteDoc(
      doc(db, "tasks", taskId)
    );

    await loadAllData();

    toast("Task deleted.");
  } catch (error) {
    toast(
      getFirebaseError(error),
      "error"
    );
  }
}


// ============================================================
// STUDENT TASK PAGE
// ============================================================

function renderMyTasks() {
  const container =
    $("myTasksGrid");

  if (!container || !isStudent()) return;

  if (!state.tasks.length) {
    container.innerHTML =
      emptyState(
        "You have no tasks right now.",
        "✓"
      );
    return;
  }

  container.innerHTML =
    state.tasks.map(task => {

      let action = "";

      if (task.status === "pending") {
        action = `
          <button
            class="primary-btn"
            onclick="window.acceptTask('${task.id}')">
            Accept Task
          </button>
        `;
      } else if (task.status === "accepted") {
        action = `
          <button
            class="primary-btn"
            onclick="window.acceptTask('${task.id}')">
            Complete Task
          </button>
        `;
      } else {
        action = statusBadge("completed");
      }

      return `
        <div class="task-card">

          <div class="card-top">

            <div>
              <h3 style="margin:0 0 5px">
                ${escapeHtml(
                  task.title ||
                  "Untitled Task"
                )}
              </h3>

              <div class="task-student">
                Assigned:
                ${formatDate(
                  task.assignedAt
                )}
              </div>
            </div>

            ${statusBadge(
              task.status ||
              "pending"
            )}

          </div>

          <p
            class="muted"
            style="font-size:12px;line-height:1.6">
            ${escapeHtml(
              task.description ||
              "No description."
            )}
          </p>

          ${
            task.completionSeconds
              ? `
                <div class="timer">
                  Completion time:
                  ${formatSeconds(
                    task.completionSeconds
                  )}
                </div>
              `
              : ""
          }

          <div class="card-actions">
            ${action}
          </div>

        </div>
      `;
    }).join("");
}


// ============================================================
// ASSIGNMENTS
// ============================================================

function renderAssignments() {
  const container =
    $("assignmentsList");

  if (!container) return;

  if (!isAdmin() && !isSuperAdmin()) {
    container.innerHTML = "";
    return;
  }

  if (!state.assignments.length) {
    container.innerHTML =
      emptyState(
        "No assignments have been created yet.",
        "▤"
      );
    return;
  }

  container.innerHTML = `
    <table class="data-table">

      <thead>
        <tr>
          <th>Assignment</th>
          <th>Student</th>
          <th>Deadline</th>
          <th>Status</th>
          <th>Submitted</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>

        ${state.assignments.map(item => {

          const student =
            state.students.find(
              x => x.id === item.studentId
            );

          let status =
            item.submitted
              ? "submitted"
              : "pending";

          if (
            !item.submitted &&
            item.deadline &&
            new Date(
              `${item.deadline}T23:59:59`
            ) < new Date()
          ) {
            status = "overdue";
          }

          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    item.title ||
                    "Untitled"
                  )}
                </strong>

                <div class="muted">
                  ${escapeHtml(
                    item.description ||
                    ""
                  )}
                </div>
              </td>

              <td>
                ${escapeHtml(
                  student?.name ||
                  item.studentName ||
                  "Student"
                )}
              </td>

              <td>
                ${formatDate(
                  item.deadline
                )}
              </td>

              <td>
                ${statusBadge(status)}
              </td>

              <td>
                ${formatDate(
                  item.submissionDate
                )}
              </td>

              <td>
                <button
                  class="table-btn danger"
                  onclick="window.deleteAssignment('${item.id}')">
                  Delete
                </button>
              </td>

            </tr>
          `;
        }).join("")}

      </tbody>

    </table>
  `;
}


function openAddAssignment() {
  if (!isAdmin() && !isSuperAdmin()) {
    toast(
      "You do not have permission.",
      "error"
    );
    return;
  }

  if (!state.students.length) {
    toast(
      "Create a student first.",
      "error"
    );
    return;
  }

  showModal(
    "Create Assignment",
    `
      <form id="assignmentForm">

        <div class="form-grid">

          <div>
            <label>Assignment Title</label>
            <input
              id="assignmentTitle"
              required
              placeholder="Assignment title">
          </div>

          <div>
            <label>Student</label>
            <select
              id="assignmentStudent"
              required>

              <option value="">
                Select student
              </option>

              ${state.students.map(
                student => `
                  <option value="${student.id}">
                    ${escapeHtml(
                      student.name ||
                      student.email
                    )}
                  </option>
                `
              ).join("")}

            </select>
          </div>

          <div>
            <label>Deadline</label>
            <input
              id="assignmentDeadline"
              type="date"
              required>
          </div>

          <div class="full">
            <label>Description</label>
            <textarea
              id="assignmentDescription"
              placeholder="Assignment instructions">
            </textarea>
          </div>

        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="secondary-btn"
            onclick="window.closeAppModal()">
            Cancel
          </button>

          <button
            class="primary-btn"
            type="submit">
            Create Assignment
          </button>

        </div>

      </form>
    `
  );

  $("assignmentForm")
    ?.addEventListener(
      "submit",
      createAssignment
    );
}


async function createAssignment(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const button =
    form.querySelector(
      "button[type='submit']"
    );

  const studentId =
    $("assignmentStudent").value;

  const student =
    state.students.find(
      x => x.id === studentId
    );

  setBusy(
    button,
    true,
    "Creating..."
  );

  try {
    await addDoc(
      collection(db, "assignments"),
      {
        title:
          $("assignmentTitle")
            .value.trim(),

        description:
          $("assignmentDescription")
            .value.trim(),

        studentId,

        studentName:
          student?.name || "",

        adminId:
          state.profile.role === "admin"
            ? state.user.uid
            : (
                student?.adminId ||
                null
              ),

        deadline:
          $("assignmentDeadline").value,

        submitted: false,

        submissionDate: null,

        submittedLate: false,

        createdAt:
          serverTimestamp()
      }
    );

    closeAppModal();

    await loadAllData();

    toast(
      "Assignment created successfully."
    );

  } catch (error) {
    toast(
      getFirebaseError(error),
      "error"
    );
  } finally {
    setBusy(button, false);
  }
}


async function submitAssignment(id) {
  if (!isStudent()) return;

  const item =
    state.assignments.find(
      x => x.id === id
    );

  if (!item || item.submitted) return;

  const late =
    item.deadline &&
    new Date(
      `${item.deadline}T23:59:59`
    ) < new Date();

  try {
    await updateDoc(
      doc(db, "assignments", id),
      {
        submitted: true,
        submissionDate:
          todayISO(),
        submittedLate: late
      }
    );

    await loadAllData();

    toast(
      late
        ? "Assignment submitted late."
        : "Assignment submitted successfully."
    );

  } catch (error) {
    toast(
      getFirebaseError(error),
      "error"
    );
  }
}


async function deleteAssignment(id) {
  if (!isAdmin() && !isSuperAdmin()) return;

  if (!confirm("Delete this assignment?")) {
    return;
  }

  try {
    await deleteDoc(
      doc(db, "assignments", id)
    );

    await loadAllData();

    toast("Assignment deleted.");
  } catch (error) {
    toast(
      getFirebaseError(error),
      "error"
    );
  }
}


// ============================================================
// STUDENT ASSIGNMENTS
// ============================================================

function renderMyAssignments() {
  const container =
    $("myAssignmentsTable");

  if (!container || !isStudent()) return;

  if (!state.assignments.length) {
    container.innerHTML =
      emptyState(
        "You have no assignments.",
        "▤"
      );
    return;
  }

  container.innerHTML = `
    <table class="data-table">

      <thead>
        <tr>
          <th>Assignment</th>
          <th>Deadline</th>
          <th>Status</th>
          <th>Submission</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>

        ${state.assignments.map(item => {

          const submitted =
            item.submitted === true;

          const late =
            item.submittedLate === true;

          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    item.title ||
                    "Assignment"
                  )}
                </strong>

                <div class="muted">
                  ${escapeHtml(
                    item.description ||
                    ""
                  )}
                </div>
              </td>

              <td>
                ${formatDate(
                  item.deadline
                )}
              </td>

              <td>
                ${statusBadge(
                  submitted
                    ? "submitted"
                    : "pending"
                )}
              </td>

              <td>
                ${
                  submitted
                    ? (
                      late
                        ? "Late"
                        : formatDate(
                            item.submissionDate
                          )
                    )
                    : "-"
                }
              </td>

              <td>

                ${
                  submitted
                    ? statusBadge(
                        late
                          ? "overdue"
                          : "submitted"
                      )
                    : `
                      <button
                        class="table-btn"
                        onclick="window.submitAssignment('${item.id}')">
                        Submit
                      </button>
                    `
                }

              </td>

            </tr>
          `;
        }).join("")}

      </tbody>

    </table>
  `;
}


// ============================================================
// TESTS
// ============================================================

function renderTests() {
  const container =
    $("testsList");

  if (!container) return;

  if (!isAdmin() && !isSuperAdmin()) {
    container.innerHTML = "";
    return;
  }

  if (!state.tests.length) {
    container.innerHTML =
      emptyState(
        "No tests have been created yet.",
        "▣"
      );
    return;
  }

  container.innerHTML = `
    <table class="data-table">

      <thead>
        <tr>
          <th>Test</th>
          <th>Student</th>
          <th>Marks</th>
          <th>Percentage</th>
          <th>Date</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>

        ${state.tests.map(test => {

          const student =
            state.students.find(
              x => x.id === test.studentId
            );

          const total =
            Number(test.totalMarks || 0);

          const marks =
            Number(test.marks || 0);

          const percentage =
            total > 0
              ? Math.round(
                  (marks / total) * 100
                )
              : 0;

          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    test.title ||
                    "Test"
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  student?.name ||
                  test.studentName ||
                  "Student"
                )}
              </td>

              <td>
                ${marks}/${total}
              </td>

              <td>
                <strong class="score">
                  ${percentage}%
                </strong>
              </td>

              <td>
                ${formatDate(
                  test.testDate ||
                  test.createdAt
                )}
              </td>

              <td>
                <button
                  class="table-btn danger"
                  onclick="window.deleteTest('${test.id}')">
                  Delete
                </button>
              </td>

            </tr>
          `;
        }).join("")}

      </tbody>

    </table>
  `;
}


function openAddTest() {
  if (!isAdmin() && !isSuperAdmin()) {
    toast(
      "You do not have permission.",
      "error"
    );
    return;
  }

  if (!state.students.length) {
    toast(
      "Create a student first.",
      "error"
    );
    return;
  }

  showModal(
    "Add Test Result",
    `
      <form id="testForm">

        <div class="form-grid">

          <div>
            <label>Test Title</label>
            <input
              id="testTitle"
              required
              placeholder="e.g. CIT Practical">
          </div>

          <div>
            <label>Student</label>
            <select
              id="testStudent"
              required>

              <option value="">
                Select student
              </option>

              ${state.students.map(
                student => `
                  <option value="${student.id}">
                    ${escapeHtml(
                      student.name ||
                      student.email
                    )}
                  </option>
                `
              ).join("")}

            </select>
          </div>

          <div>
            <label>Total Marks</label>
            <input
              id="testTotal"
              type="number"
              min="1"
              required
              value="100">
          </div>

          <div>
            <label>Obtained Marks</label>
            <input
              id="testMarks"
              type="number"
              min="0"
              required
              value="0">
          </div>

          <div>
            <label>Test Date</label>
            <input
              id="testDate"
              type="date"
              value="${todayISO()}">
          </div>

        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="secondary-btn"
            onclick="window.closeAppModal()">
            Cancel
          </button>

          <button
            class="primary-btn"
            type="submit">
            Save Result
          </button>

        </div>

      </form>
    `
  );

  $("testForm")
    ?.addEventListener(
      "submit",
      createTest
    );
}


async function createTest(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const button =
    form.querySelector(
      "button[type='submit']"
    );

  const studentId =
    $("testStudent").value;

  const student =
    state.students.find(
      x => x.id === studentId
    );

  const total =
    Number($("testTotal").value);

  const marks =
    Number($("testMarks").value);

  if (marks > total) {
    toast(
      "Obtained marks cannot exceed total marks.",
      "error"
    );
    return;
  }

  setBusy(
    button,
    true,
    "Saving..."
  );

  try {
    await addDoc(
      collection(db, "tests"),
      {
        title:
          $("testTitle").value.trim(),

        studentId,

        studentName:
          student?.name || "",

        adminId:
          state.profile.role === "admin"
            ? state.user.uid
            : (
                student?.adminId ||
                null
              ),

        totalMarks: total,

        marks,

        testDate:
          $("testDate").value,

        createdAt:
          serverTimestamp()
      }
    );

    closeAppModal();

    await loadAllData();

    toast(
      "Test result saved successfully."
    );

  } catch (error) {
    toast(
      getFirebaseError(error),
      "error"
    );
  } finally {
    setBusy(button, false);
  }
}


async function deleteTest(id) {
  if (!isAdmin() && !isSuperAdmin()) return;

  if (!confirm("Delete this test result?")) {
    return;
  }

  try {
    await deleteDoc(
      doc(db, "tests", id)
    );

    await loadAllData();

    toast("Test deleted.");
  } catch (error) {
    toast(
      getFirebaseError(error),
      "error"
    );
  }
}


// ============================================================
// STUDENT TESTS
// ============================================================

function renderMyTests() {
  const container =
    $("myTestsTable");

  if (!container || !isStudent()) return;

  if (!state.tests.length) {
    container.innerHTML =
      emptyState(
        "No test results available.",
        "▣"
      );
    return;
  }

  container.innerHTML = `
    <table class="data-table">

      <thead>
        <tr>
          <th>Test</th>
          <th>Marks</th>
          <th>Percentage</th>
          <th>Date</th>
        </tr>
      </thead>

      <tbody>

        ${state.tests.map(test => {

          const total =
            Number(
              test.totalMarks || 0
            );

          const marks =
            Number(
              test.marks || 0
            );

          const percentage =
            total > 0
              ? Math.round(
                  marks / total * 100
                )
              : 0;

          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    test.title ||
                    "Test"
                  )}
                </strong>
              </td>

              <td>
                ${marks}/${total}
              </td>

              <td>
                <strong class="score">
                  ${percentage}%
                </strong>
              </td>

              <td>
                ${formatDate(
                  test.testDate ||
                  test.createdAt
                )}
              </td>

            </tr>
          `;
        }).join("")}

      </tbody>

    </table>
  `;
}


// ============================================================
// ADMINS
// ============================================================

function renderAdmins() {
  const container =
    $("adminsList");

  if (!container || !isSuperAdmin()) {
    if (container) {
      container.innerHTML = "";
    }

    return;
  }

  if (!state.admins.length) {
    container.innerHTML =
      emptyState(
        "No admin accounts found.",
        "♟"
      );
    return;
  }

  container.innerHTML =
    state.admins.map(admin => {

      const students =
        state.students.filter(
          student =>
            student.adminId === admin.id
        );

      const tasks =
        state.tasks.filter(
          task =>
            task.adminId === admin.id
        );

      const assignments =
        state.assignments.filter(
          item =>
            item.adminId === admin.id
        );

      return `
        <div class="admin-card">

          <div class="card-top">

            <div class="person">

              <div class="mini-avatar">
                ${initials(
                  admin.name
                )}
              </div>

              <div>
                <h3>
                  ${escapeHtml(
                    admin.name ||
                    "Admin"
                  )}
                </h3>

                <p>
                  ${escapeHtml(
                    admin.email ||
                    ""
                  )}
                </p>
              </div>

            </div>

            ${statusBadge(
              admin.active === false
                ? "inactive"
                : "active"
            )}

          </div>

          <div class="card-meta">

            <div>
              Students:
              <strong>
                ${students.length}
              </strong>
            </div>

            <div>
              Tasks:
              <strong>
                ${tasks.length}
              </strong>
            </div>

            <div>
              Assignments:
              <strong>
                ${assignments.length}
              </strong>
            </div>

          </div>

          <div class="muted">
            Created:
            ${formatDate(
              admin.createdAt
            )}
          </div>

        </div>
      `;
    }).join("");
}


// ============================================================
// PROGRESS PAGE
// ============================================================

function renderProgress() {
  const container =
    $("progressList");

  if (!container) return;

  if (!isAdmin() && !isSuperAdmin()) {
    container.innerHTML = "";
    return;
  }

  if (!state.students.length) {
    container.innerHTML =
      emptyState(
        "No students available.",
        "♟"
      );
    return;
  }

  container.innerHTML =
    state.students.map(student => {

      const progress =
        getStudentProgress(student.id);

      return `
        <div class="progress-card">

          <div class="card-top">

            <div class="person">

              <div class="mini-avatar">
                ${initials(
                  student.name
                )}
              </div>

              <div>
                <h3>
                  ${escapeHtml(
                    student.name ||
                    "Student"
                  )}
                </h3>

                <p>
                  ${escapeHtml(
                    student.className ||
                    "Class not set"
                  )}
                </p>
              </div>

            </div>

            <strong class="score">
              ${progress.overall}%
            </strong>

          </div>

          <div
            style="
              display:grid;
              gap:12px;
              margin-top:18px;
            ">

            ${progressRow(
              "Tasks",
              progress.taskProgress
            )}

            ${progressRow(
              "Assignments",
              progress.assignmentProgress
            )}

            ${progressRow(
              "Tests",
              progress.testProgress
            )}

          </div>

        </div>
      `;
    }).join("");
}


// ============================================================
// STUDENT PAGES
// ============================================================

function renderStudentPages() {
  if (!isStudent()) return;

  renderMyTasks();
  renderMyAssignments();
  renderMyTests();
}


// ============================================================
// BUTTON VISIBILITY
// ============================================================

function renderButtons() {
  const admin =
    isAdmin() || isSuperAdmin();

  [
    "addStudentBtn",
    "addTaskBtn",
    "addAssignmentBtn",
    "addTestBtn"
  ].forEach(id => {
    const button = $(id);

    if (button) {
      button.style.display =
        admin ? "" : "none";
    }
  });
}


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {
  document
    .querySelectorAll("[data-page]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          showPage(
            button.dataset.page
          );

          closeSidebar();
        }
      );
    });
}


function showPage(page) {
  const allowedPages = {
    student: [
      "dashboard",
      "myTasks",
      "myAssignments",
      "myTests"
    ],

    admin: [
      "dashboard",
      "students",
      "tasks",
      "assignments",
      "tests",
      "progress"
    ],

    superadmin: [
      "dashboard",
      "students",
      "tasks",
      "assignments",
      "tests",
      "admins",
      "progress"
    ]
  };

  const role =
    state.profile?.role;

  if (
    !allowedPages[role]?.includes(page)
  ) {
    page = "dashboard";
  }

  state.currentPage = page;

  document
    .querySelectorAll("[data-page-section]")
    .forEach(section => {
      section.classList.toggle(
        "hidden",
        section.dataset.pageSection !== page
      );
    });

  document
    .querySelectorAll(".nav-item")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ============================================================
// SIDEBAR
// ============================================================

function setupMenu() {
  const menuBtn =
    $("menuBtn");

  const sidebar =
    $("sidebar");

  const overlay =
    $("sidebarOverlay");

  if (!menuBtn || !sidebar) {
    return;
  }

  menuBtn.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      sidebar.classList.toggle("open");
      overlay?.classList.toggle(
        "open"
      );
    }
  );

  overlay?.addEventListener(
    "click",
    closeSidebar
  );

  document.addEventListener(
    "click",
    event => {

      if (
        window.innerWidth <= 760 &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        event.target !== menuBtn
      ) {
        closeSidebar();
      }

    }
  );
}

function closeSidebar() {
  $("sidebar")?.classList.remove(
    "open"
  );

  $("sidebarOverlay")?.classList.remove(
    "open"
  );
}


// ============================================================
// MODAL
// ============================================================

function showModal(title, body) {
  const modal =
    $("appModal");

  if (!modal) return;

  modal.innerHTML = `
    <div class="modal-overlay"></div>

    <div class="modal-box">

      <div class="modal-header">

        <h2>
          ${escapeHtml(title)}
        </h2>

        <button
          class="modal-close"
          type="button"
          aria-label="Close">
          ×
        </button>

      </div>

      <div class="modal-body">
        ${body}
      </div>

    </div>
  `;

  modal.classList.remove(
    "hidden"
  );

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  modal
    .querySelector(".modal-close")
    ?.addEventListener(
      "click",
      closeAppModal
    );

  modal
    .querySelector(".modal-overlay")
    ?.addEventListener(
      "click",
      closeAppModal
    );

  document.body.style.overflow =
    "hidden";
}


function closeAppModal() {
  const modal =
    $("appModal");

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  modal.innerHTML = "";

  document.body.style.overflow =
    "";
}

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape"
    ) {
      closeAppModal();
    }
  }
);


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.openAddStudent =
  openAddStudent;

window.viewStudent =
  viewStudent;

window.deleteStudent =
  deleteStudent;

window.openAddTask =
  openAddTask;

window.acceptTask =
  acceptTask;

window.deleteTask =
  deleteTask;

window.openAddAssignment =
  openAddAssignment;

window.submitAssignment =
  submitAssignment;

window.deleteAssignment =
  deleteAssignment;

window.openAddTest =
  openAddTest;

window.deleteTest =
  deleteTest;

window.closeAppModal =
  closeAppModal;

window.showPage =
  showPage;


// ============================================================
// RENDER
// ============================================================

function renderEverything() {
  renderUserInfo();
  updateRoleVisibility();

  renderDashboard();

  renderStudents();
  renderTasks();
  renderAssignments();
  renderTests();
  renderAdmins();
  renderProgress();

  renderStudentPages();

  renderButtons();
}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {
      state.user = null;
      state.profile = null;

      showAuth();

      return;
    }

    try {
      state.user = user;

      const profileSnap =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );

      if (!profileSnap.exists()) {
        await signOut(auth);

        toast(
          "User profile not found.",
          "error"
        );

        return;
      }

      state.profile = {
        id: profileSnap.id,
        ...profileSnap.data()
      };

      if (
        state.profile.active === false
      ) {
        await signOut(auth);

        toast(
          "This account is inactive.",
          "error"
        );

        return;
      }

      showApp();

      await loadAllData();

      showPage("dashboard");

    } catch (error) {

      console.error(error);

      toast(
        getFirebaseError(error),
        "error"
      );
    }
  }
);


// ============================================================
// START
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupAuthTabs();
    setupAdminRegistration();
    setupLogin();
    setupLogout();
    setupNavigation();
    setupMenu();

  }
);
