// ============================================================
// DAILY TASK MANAGER
// Version 3.0.0
// Firebase Auth + Firestore
// Storage completely removed
// Admin Email OTP Verification
// ============================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

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
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


/* =========================================================
   CONFIG
========================================================= */

const VERSION = "v3.0.0";

const firebaseConfig = {
  apiKey: "AIzaSyBHerMjZdE-OTlqtdzS35k3V15SEHzuVc",
  authDomain: "daily-task-manager-6c31b.firebaseapp.com",
  projectId: "daily-task-manager-6c31b",
  storageBucket: "daily-task-manager-6c31b.firebasestorage.app",
  messagingSenderId: "372365923221",
  appId: "1:372365923221:web:fa91cd423524d150669c9c"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================================
   STATE
========================================================= */

const state = {

  user: null,

  profile: null,

  students: [],

  admins: [],

  tasks: [],

  assignments: [],

  tests: [],

  currentPage: "dashboard",

  unsubscribe: null

};


/* =========================================================
   HELPERS
========================================================= */

const $ = id =>
  document.getElementById(id);


function esc(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function clean(value) {

  return String(value ?? "").trim();

}


function initials(name) {

  const parts =
    clean(name)
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase();

}


function formatDate(value) {

  if (!value) {
    return "—";
  }

  const date =
    value?.toDate
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();

}


function formatDateTime(value) {

  if (!value) {
    return "—";
  }

  const date =
    value?.toDate
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();

}


function getTime(value) {

  if (!value) {
    return 0;
  }

  const date =
    value?.toDate
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();

}


function statusBadge(status) {

  const s =
    clean(status).toLowerCase();

  let cls = "";

  if (
    s === "completed" ||
    s === "submitted" ||
    s === "active" ||
    s === "normal"
  ) {
    cls = "success";
  }

  if (
    s === "pending" ||
    s === "accepted"
  ) {
    cls = "primary";
  }

  if (
    s === "late" ||
    s === "inactive" ||
    s === "warning"
  ) {
    cls = "danger";
  }

  return `
    <span class="badge ${cls}">
      ${esc(status || "Unknown")}
    </span>
  `;

}


function showToast(
  message,
  type = "success"
) {

  const toast =
    $("toast");

  if (!toast) {
    return;
  }

  toast.textContent =
    message;

  toast.className =
    `toast show ${type}`;

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(() => {

      toast.className =
        "toast";

    }, 3500);

}


function setFormMessage(
  id,
  message,
  error = false
) {

  const el =
    $(id);

  if (!el) {
    return;
  }

  el.textContent =
    message;

  el.style.color =
    error
      ? "var(--danger)"
      : "var(--success)";

}


function setBusy(
  button,
  busy,
  busyText = "Please wait..."
) {

  if (!button) {
    return;
  }

  if (busy) {

    if (!button.dataset.originalText) {

      button.dataset.originalText =
        button.textContent;

    }

    button.disabled =
      true;

    button.textContent =
      busyText;

  } else {

    button.disabled =
      false;

    if (button.dataset.originalText) {

      button.textContent =
        button.dataset.originalText;

      delete button.dataset.originalText;

    }

  }

}


function currentRole() {

  return state.profile?.role || "";

}


function isAdmin() {

  return currentRole() === "admin";

}


function isSuperAdmin() {

  return currentRole() === "superadmin";

}


function isStudent() {

  return currentRole() === "student";

}


/* =========================================================
   AUTH UI
========================================================= */

function showAuth() {

  $("authScreen")
    ?.classList.remove("hidden");

  $("appScreen")
    ?.classList.add("hidden");

}


function showApp() {

  $("authScreen")
    ?.classList.add("hidden");

  $("appScreen")
    ?.classList.remove("hidden");

}


function switchAuthTab(type) {

  const login =
    type === "login";

  $("loginTab")
    ?.classList.toggle(
      "active",
      login
    );

  $("registerTab")
    ?.classList.toggle(
      "active",
      !login
    );

  $("loginPanel")
    ?.classList.toggle(
      "hidden",
      !login
    );

  $("registerPanel")
    ?.classList.toggle(
      "hidden",
      login
    );

}


/* =========================================================
   PASSWORD EYE
========================================================= */

function setupPasswordEyes() {

  document
    .querySelectorAll(
      "[data-password-target]"
    )
    .forEach(button => {

      if (
        button.dataset.eyeReady ===
        "true"
      ) {
        return;
      }

      button.dataset.eyeReady =
        "true";

      button.addEventListener(
        "click",
        () => {

          const target =
            $(button.dataset.passwordTarget);

          if (!target) {
            return;
          }

          if (
            target.type ===
            "password"
          ) {

            target.type =
              "text";

            button.textContent =
              "🙈";

          } else {

            target.type =
              "password";

            button.textContent =
              "👁️";

          }

        }
      );

    });

}


/* =========================================================
   OTP REGISTRATION
========================================================= */

let otpSent = false;

let otpCountdownTimer = null;

let otpCountdownSeconds = 0;


function setOtpAreaVisible(
  visible
) {

  const area =
    $("registerOtpArea");

  if (!area) {
    return;
  }

  area.classList.toggle(
    "hidden",
    !visible
  );

}


function startOtpCountdown(
  seconds = 30
) {

  clearInterval(
    otpCountdownTimer
  );

  otpCountdownSeconds =
    seconds;

  const button =
    $("resendOtpBtn");

  const label =
    $("otpCountdown");

  if (button) {
    button.disabled =
      true;
  }

  function tick() {

    if (label) {

      label.textContent =
        otpCountdownSeconds > 0
          ? `Resend available in ${otpCountdownSeconds}s`
          : "";

    }

    if (
      otpCountdownSeconds <= 0
    ) {

      clearInterval(
        otpCountdownTimer
      );

      if (button) {
        button.disabled =
          false;
      }

      return;
    }

    otpCountdownSeconds--;

  }

  tick();

  otpCountdownTimer =
    setInterval(
      tick,
      1000
    );

}


function resetOtpState() {

  otpSent = false;

  clearInterval(
    otpCountdownTimer
  );

  otpCountdownTimer =
    null;

  setOtpAreaVisible(false);

  if ($("registerOtp")) {
    $("registerOtp").value =
      "";
  }

  if ($("otpCountdown")) {
    $("otpCountdown").textContent =
      "";
  }

  if ($("resendOtpBtn")) {
    $("resendOtpBtn").disabled =
      false;
  }

}


async function registerAdmin(event) {

  event.preventDefault();

  const name =
    clean(
      $("registerName")?.value
    );

  const email =
    clean(
      $("registerEmail")?.value
    ).toLowerCase();

  const password =
    $("registerPassword")?.value ||
    "";

  const confirm =
    $("registerConfirm")?.value ||
    "";

  const code =
    clean(
      $("registerOtp")?.value
    );

  setFormMessage(
    "registerMessage",
    ""
  );


  if (
    !name ||
    !email ||
    !password ||
    !confirm
  ) {

    setFormMessage(
      "registerMessage",
      "Please fill all fields.",
      true
    );

    return;
  }


  if (name.length < 2) {

    setFormMessage(
      "registerMessage",
      "Please enter a valid name.",
      true
    );

    return;
  }


  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {

    setFormMessage(
      "registerMessage",
      "Please enter a valid email address.",
      true
    );

    return;
  }


  if (password.length < 6) {

    setFormMessage(
      "registerMessage",
      "Password must contain at least 6 characters.",
      true
    );

    return;
  }


  if (password !== confirm) {

    setFormMessage(
      "registerMessage",
      "Passwords do not match.",
      true
    );

    return;
  }


  if (!otpSent) {

    await sendRegistrationCode(
      name,
      email,
      password,
      event.submitter
    );

    return;
  }


  if (!/^\d{6}$/.test(code)) {

    setFormMessage(
      "registerMessage",
      "Enter the 6-digit verification code.",
      true
    );

    return;
  }


  const button =
    event.submitter;


  try {

    setBusy(
      button,
      true,
      "Verifying..."
    );


    const response =
      await fetch(
        "/api/register-admin",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            action:
              "verify-code",

            name,

            email,

            password,

            code

          })
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.message ||
        "Unable to verify email."
      );

    }


    resetOtpState();


    showToast(
      "Admin account created successfully."
    );


    $("registerForm")
      ?.reset();


    setFormMessage(
      "registerMessage",
      "Email verified. Your account has been created."
    );


    setTimeout(() => {

      switchAuthTab(
        "login"
      );

      if ($("loginEmail")) {

        $("loginEmail").value =
          email;

      }

    }, 1000);


  } catch (error) {

    console.error(
      "OTP VERIFY ERROR:",
      error
    );

    setFormMessage(
      "registerMessage",
      error.message ||
      "Unable to verify email.",
      true
    );


  } finally {

    setBusy(
      button,
      false
    );

  }

}


async function sendRegistrationCode(
  name,
  email,
  password,
  button
) {

  try {

    setBusy(
      button,
      true,
      "Sending Code..."
    );


    const response =
      await fetch(
        "/api/register-admin",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            action:
              "send-code",

            name,

            email,

            password

          })
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.message ||
        "Unable to send verification code."
      );

    }


    otpSent =
      true;


    setOtpAreaVisible(
      true
    );


    if ($("registerOtp")) {

      $("registerOtp")
        .focus();

    }


    if (button) {

      button.textContent =
        "Verify & Create Account";

    }


    startOtpCountdown(
      Number(
        data.resendAfterSeconds ||
        30
      )
    );


    setFormMessage(
      "registerMessage",
      "Verification code sent to your email."
    );


  } catch (error) {

    console.error(
      "OTP SEND ERROR:",
      error
    );

    setFormMessage(
      "registerMessage",
      error.message ||
      "Unable to send verification code.",
      true
    );


  } finally {

    setBusy(
      button,
      false
    );

    if (
      otpSent &&
      button
    ) {

      button.textContent =
        "Verify & Create Account";

    }

  }

}


async function resendOTP() {

  if (
    otpCountdownSeconds > 0
  ) {
    return;
  }


  const name =
    clean(
      $("registerName")?.value
    );

  const email =
    clean(
      $("registerEmail")?.value
    ).toLowerCase();

  const password =
    $("registerPassword")?.value ||
    "";


  if (
    !name ||
    !email ||
    !password
  ) {

    setFormMessage(
      "registerMessage",
      "Fill your registration details first.",
      true
    );

    return;
  }


  await sendRegistrationCode(
    name,
    email,
    password,
    $("resendOtpBtn")
  );

}


/* =========================================================
   LOGIN
========================================================= */

async function loginUser(event) {

  event.preventDefault();

  const email =
    clean(
      $("loginEmail")?.value
    ).toLowerCase();

  const password =
    $("loginPassword")?.value ||
    "";


  if (
    !email ||
    !password
  ) {

    setFormMessage(
      "loginMessage",
      "Please enter email and password.",
      true
    );

    return;
  }


  const button =
    event.submitter;


  try {

    setBusy(
      button,
      true,
      "Logging in..."
    );


    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );


  } catch (error) {

    console.error(error);

    let message =
      "Unable to login.";


    if (
      error.code ===
        "auth/invalid-credential" ||
      error.code ===
        "auth/wrong-password" ||
      error.code ===
        "auth/user-not-found"
    ) {

      message =
        "Invalid email or password.";

    }


    if (
      error.code ===
      "auth/too-many-requests"
    ) {

      message =
        "Too many attempts. Please try again later.";

    }


    setFormMessage(
      "loginMessage",
      message,
      true
    );


  } finally {

    setBusy(
      button,
      false
    );

  }

}


async function logoutUser() {

  try {

    await signOut(
      auth
    );

  } catch (error) {

    console.error(error);

  }

}


/* =========================================================
   PROFILE
========================================================= */

async function loadProfile(
  uid
) {

  const snap =
    await getDoc(
      doc(
        db,
        "users",
        uid
      )
    );


  if (!snap.exists()) {

    throw new Error(
      "Your user profile was not found."
    );

  }


  const data =
    snap.data();


  if (
    data.active === false
  ) {

    throw new Error(
      "Your account is inactive."
    );

  }


  return data;

}


/* =========================================================
   DATA LOADING
========================================================= */

async function loadAllData() {

  state.students = [];

  state.admins = [];

  state.tasks = [];

  state.assignments = [];

  state.tests = [];


  /* ---------------------------------------------------------
     ADMIN
  --------------------------------------------------------- */

  if (isAdmin()) {

    const studentsSnap =
      await getDocs(
        query(
          collection(
            db,
            "users"
          ),
          where(
            "role",
            "==",
            "student"
          ),
          where(
            "adminId",
            "==",
            state.user.uid
          )
        )
      );


    state.students =
      studentsSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    const tasksSnap =
      await getDocs(
        query(
          collection(
            db,
            "tasks"
          ),
          where(
            "adminId",
            "==",
            state.user.uid
          )
        )
      );


    state.tasks =
      tasksSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    const assignmentsSnap =
      await getDocs(
        query(
          collection(
            db,
            "assignments"
          ),
          where(
            "adminId",
            "==",
            state.user.uid
          )
        )
      );


    state.assignments =
      assignmentsSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    const testsSnap =
      await getDocs(
        query(
          collection(
            db,
            "tests"
          ),
          where(
            "adminId",
            "==",
            state.user.uid
          )
        )
      );


    state.tests =
      testsSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    return;

  }


  /* ---------------------------------------------------------
     SUPER ADMIN
  --------------------------------------------------------- */

  if (isSuperAdmin()) {

    const usersSnap =
      await getDocs(
        collection(
          db,
          "users"
        )
      );


    const users =
      usersSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    state.students =
      users.filter(
        u =>
          u.role === "student"
      );


    state.admins =
      users.filter(
        u =>
          u.role === "admin"
      );


    const tasksSnap =
      await getDocs(
        collection(
          db,
          "tasks"
        )
      );


    state.tasks =
      tasksSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    const assignmentsSnap =
      await getDocs(
        collection(
          db,
          "assignments"
        )
      );


    state.assignments =
      assignmentsSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    const testsSnap =
      await getDocs(
        collection(
          db,
          "tests"
        )
      );


    state.tests =
      testsSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    return;

  }


  /* ---------------------------------------------------------
     STUDENT
  --------------------------------------------------------- */

  if (isStudent()) {

    const tasksSnap =
      await getDocs(
        query(
          collection(
            db,
            "tasks"
          ),
          where(
            "studentId",
            "==",
            state.user.uid
          )
        )
      );


    state.tasks =
      tasksSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    const assignmentsSnap =
      await getDocs(
        query(
          collection(
            db,
            "assignments"
          ),
          where(
            "studentId",
            "==",
            state.user.uid
          )
        )
      );


    state.assignments =
      assignmentsSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    const testsSnap =
      await getDocs(
        query(
          collection(
            db,
            "tests"
          ),
          where(
            "studentId",
            "==",
            state.user.uid
          )
        )
      );


    state.tests =
      testsSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );

  }

}


/* =========================================================
   USER UI
========================================================= */

function updateUserUI() {

  const name =
    state.profile?.name ||
    state.user?.displayName ||
    "User";


  const role =
    state.profile?.role ||
    "User";


  document
    .querySelectorAll(
      "[data-user-name]"
    )
    .forEach(el => {

      el.textContent =
        name;

    });


  document
    .querySelectorAll(
      "[data-user-role]"
    )
    .forEach(el => {

      el.textContent =
        role;

    });


  if ($("userAvatar")) {

    $("userAvatar").textContent =
      initials(name);

  }

}


/* =========================================================
   NAVIGATION
========================================================= */

const pageNames = {

  dashboard:
    [
      "Dashboard",
      "Overview"
    ],

  students:
    [
      "Students",
      "Manage student accounts"
    ],

  tasks:
    [
      "Tasks",
      "Manage daily tasks"
    ],

  assignments:
    [
      "Assignments",
      "Manage assignments"
    ],

  tests:
    [
      "Tests",
      "Manage tests"
    ],

  admins:
    [
      "Admins",
      "Administrator accounts"
    ],

  progress:
    [
      "Progress",
      "Student performance"
    ],

  myTasks:
    [
      "My Tasks",
      "Your assigned tasks"
    ],

  myAssignments:
    [
      "My Assignments",
      "Your assignments"
    ],

  myTests:
    [
      "My Tests",
      "Your test results"
    ]

};


function updateNavigationVisibility() {

  const role =
    currentRole();


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(button => {

      const roles =
        button.dataset.role;


      const allowed =
        !roles ||
        roles === "all" ||
        roles
          .split(",")
          .map(x => x.trim())
          .includes(role);


      button.classList.toggle(
        "hidden",
        !allowed
      );

    });

}


async function showPage(page) {

  const allowedPages = [

    "dashboard",

    "students",

    "tasks",

    "assignments",

    "tests",

    "admins",

    "progress",

    "myTasks",

    "myAssignments",

    "myTests"

  ];


  if (
    !allowedPages.includes(page)
  ) {

    page =
      "dashboard";

  }


  const role =
    currentRole();


  const button =
    [
      ...document.querySelectorAll(
        ".nav-item"
      )
    ].find(
      x =>
        x.dataset.page ===
        page
    );


  if (
    button &&
    button.dataset.role
  ) {

    const allowedRoles =
      button.dataset.role
        .split(",")
        .map(x => x.trim());


    if (
      !allowedRoles.includes(role)
    ) {

      page =
        isStudent()
          ? "myTasks"
          : "dashboard";

    }

  }


  state.currentPage =
    page;


  document
    .querySelectorAll(
      "[data-page-section]"
    )
    .forEach(section => {

      section.classList.toggle(
        "hidden",
        section.dataset.pageSection !==
          page
      );

    });


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page ===
          page
      );

    });


  const title =
    pageNames[page] ||
    [
      "Dashboard",
      "Overview"
    ];


  if ($("pageTitle")) {

    $("pageTitle").textContent =
      title[0];

  }


  if ($("pageSubtitle")) {

    $("pageSubtitle").textContent =
      title[1];

  }


  closeSidebar();

  renderCurrentPage();

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const completedTasks =
    state.tasks.filter(
      task =>
        task.status ===
        "completed"
    ).length;


  const submittedAssignments =
    state.assignments.filter(
      x =>
        x.submitted === true
    ).length;


  const totalMarks =
    state.tests.reduce(
      (sum, test) =>
        sum +
        Number(
          test.marks || 0
        ),
      0
    );


  const totalPossible =
    state.tests.reduce(
      (sum, test) =>
        sum +
        Number(
          test.totalMarks || 0
        ),
      0
    );


  const average =
    totalPossible > 0
      ? Math.round(
          totalMarks /
          totalPossible *
          100
        )
      : 0;


  let cards = [];


  if (isStudent()) {

    cards = [

      [
        "✓",
        state.tasks.length,
        "Total Tasks"
      ],

      [
        "✓",
        completedTasks,
        "Completed Tasks"
      ],

      [
        "📝",
        state.assignments.length,
        "Assignments"
      ],

      [
        "📊",
        `${average}%`,
        "Test Average"
      ]

    ];

  } else {

    cards = [

      [
        "👥",
        state.students.length,
        "Students"
      ],

      [
        "✓",
        state.tasks.length,
        "Total Tasks"
      ],

      [
        "✓",
        completedTasks,
        "Completed Tasks"
      ],

      [
        "📝",
        submittedAssignments,
        "Submitted Assignments"
      ]

    ];

  }


  if ($("statsGrid")) {

    $("statsGrid").innerHTML =
      cards
        .map(
          card => `
            <div class="stat-card">

              <div class="stat-icon">
                ${card[0]}
              </div>

              <h3>
                ${esc(card[1])}
              </h3>

              <p>
                ${esc(card[2])}
              </p>

            </div>
          `
        )
        .join("");

  }


  renderRecentActivity();

  renderDashboardProgress();

}


/* =========================================================
   RECENT ACTIVITY
========================================================= */

function renderRecentActivity() {

  const container =
    $("recentActivity");

  if (!container) {
    return;
  }


  const items = [];


  state.tasks.forEach(
    task => {

      items.push({

        time:
          getTime(
            task.completedAt ||
            task.assignedAt ||
            task.createdAt
          ),

        title:
          task.status ===
          "completed"
            ? `${task.title || "Task"} completed`
            : `${task.title || "Task"} assigned`,

        date:
          task.completedAt ||
          task.assignedAt ||
          task.createdAt

      });

    }
  );


  state.assignments.forEach(
    item => {

      items.push({

        time:
          getTime(
            item.submissionDate ||
            item.createdAt
          ),

        title:
          item.submitted
            ? `${item.title || "Assignment"} submitted`
            : `${item.title || "Assignment"} assigned`,

        date:
          item.submissionDate ||
          item.createdAt

      });

    }
  );


  state.tests.forEach(
    test => {

      items.push({

        time:
          getTime(
            test.testDate ||
            test.createdAt
          ),

        title:
          `${test.title || "Test"} recorded`,

        date:
          test.testDate ||
          test.createdAt

      });

    }
  );


  items.sort(
    (a, b) =>
      b.time - a.time
  );


  const recent =
    items.slice(0, 7);


  if (!recent.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        No recent activity.
      </div>
    `;

    return;

  }


  container.innerHTML =
    recent
      .map(
        item => `
          <div class="activity-item">

            <div class="activity-dot"></div>

            <div>

              <strong>
                ${esc(item.title)}
              </strong>

              <small>
                ${formatDateTime(
                  item.date
                )}
              </small>

            </div>

          </div>
        `
      )
      .join("");

}


/* =========================================================
   DASHBOARD PROGRESS
========================================================= */

function renderDashboardProgress() {

  const container =
    $("dashboardProgress");

  if (!container) {
    return;
  }


  if (
    !isStudent() &&
    !state.students.length
  ) {

    container.innerHTML = `
      <div class="empty-state">
        No students available.
      </div>
    `;

    return;

  }


  const students =
    isStudent()
      ? [
          {
            id:
              state.user.uid,

            name:
              state.profile?.name ||
              "Student"
          }
        ]
      : state.students;


  container.innerHTML =
    students
      .slice(0, 8)
      .map(
        student => {

          const tasks =
            state.tasks.filter(
              x =>
                x.studentId ===
                student.id
            );


          const completed =
            tasks.filter(
              x =>
                x.status ===
                "completed"
            ).length;


          const percent =
            tasks.length
              ? Math.round(
                  completed /
                  tasks.length *
                  100
                )
              : 0;


          return `
            <div class="progress-row">

              <div class="progress-label">

                <span>
                  ${esc(
                    student.name
                  )}
                </span>

                <strong>
                  ${percent}%
                </strong>

              </div>

              <div class="progress-track">

                <div
                  class="progress-fill"
                  style="width:${percent}%"
                ></div>

              </div>

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   STUDENTS
========================================================= */

function renderStudents() {

  const container =
    $("studentsList");

  if (!container) {
    return;
  }


  const search =
    clean(
      $("studentSearch")?.value
    ).toLowerCase();


  const students =
    state.students.filter(
      student => {

        const text = [

          student.name,

          student.email,

          student.className

        ]
          .join(" ")
          .toLowerCase();


        return text.includes(
          search
        );

      }
    );


  if (!students.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        No students found.
      </div>
    `;

    return;

  }


  container.innerHTML = `
    <table class="data-table">

      <thead>

        <tr>
          <th>Student</th>
          <th>Class</th>
          <th>Age</th>
          <th>Admin</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>

      </thead>

      <tbody>

        ${students
          .map(
            student => {

              const admin =
                state.admins.find(
                  x =>
                    x.id ===
                    student.adminId
                );


              const adminName =
                admin?.name ||
                (
                  student.adminId
                    ? "Assigned Admin"
                    : "Unassigned"
                );


              return `
                <tr>

                  <td>

                    <strong>
                      ${esc(
                        student.name
                      )}
                    </strong>

                    <br>

                    <small>
                      ${esc(
                        student.email
                      )}
                    </small>

                  </td>

                  <td>
                    ${esc(
                      student.className ||
                      "—"
                    )}
                  </td>

                  <td>
                    ${esc(
                      student.age ||
                      "—"
                    )}
                  </td>

                  <td>
                    ${esc(
                      isSuperAdmin()
                        ? adminName
                        : "You"
                    )}
                  </td>

                  <td>
                    ${statusBadge(
                      student.active === false
                        ? "inactive"
                        : "active"
                    )}
                  </td>

                  <td>

                    <button
                      class="danger-btn"
                      data-delete-student="${student.id}"
                    >
                      Delete
                    </button>

                  </td>

                </tr>
              `;

            }
          )
          .join("")}

      </tbody>

    </table>
  `;


  container
    .querySelectorAll(
      "[data-delete-student]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          deleteStudent(
            button.dataset
              .deleteStudent
          )
      );

    });

}


/* =========================================================
   STUDENT MODAL
========================================================= */

function openStudentModal() {

  const adminOptions =
    isSuperAdmin()
      ? `
        <label>
          Assign Admin

          <select id="studentAdminId">

            <option value="">
              No Admin
            </option>

            ${state.admins
              .map(
                admin => `
                  <option
                    value="${admin.id}"
                  >
                    ${esc(
                      admin.name
                    )}
                    —
                    ${esc(
                      admin.email
                    )}
                  </option>
                `
              )
              .join("")}

          </select>

        </label>
      `
      : "";


  openModal(

    "Add Student",

    `
      <form
        id="studentForm"
        class="modal-form"
      >

        <div class="form-row">

          <div class="form-group">

            <label>
              Student Name

              <input
                id="studentName"
                required
              >

            </label>

          </div>

          <div class="form-group">

            <label>
              Age

              <input
                id="studentAge"
                type="number"
                min="3"
                max="100"
              >

            </label>

          </div>

        </div>


        <div class="form-group">

          <label>
            Class

            <input
              id="studentClass"
              placeholder="e.g. Class 8"
            >

          </label>

        </div>


        <div class="form-group">

          <label>
            Email

            <input
              id="studentEmail"
              type="email"
              required
            >

          </label>

        </div>


        <div class="form-group">

          <label>
            Password

            <div class="password-wrap">

              <input
                id="studentPassword"
                type="password"
                minlength="6"
                required
              >

              <button
                type="button"
                class="password-eye"
                data-password-target="studentPassword"
              >
                👁️
              </button>

            </div>

          </label>

        </div>


        ${adminOptions}


        <div class="modal-actions">

          <button
            type="button"
            class="secondary-btn"
            data-close-modal
          >
            Cancel
          </button>

          <button
            type="submit"
            class="primary-btn"
          >
            Create Student
          </button>

        </div>

      </form>
    `
  );


  setupPasswordEyes();


  $("studentForm")
    ?.addEventListener(
      "submit",
      createStudent
    );

}


async function createStudent(event) {

  event.preventDefault();


  const button =
    event.submitter;


  const body = {

    name:
      clean(
        $("studentName")?.value
      ),

    email:
      clean(
        $("studentEmail")?.value
      ).toLowerCase(),

    password:
      $("studentPassword")?.value ||
      "",

    age:
      $("studentAge")?.value ||
      "",

    className:
      clean(
        $("studentClass")?.value
      ),

    adminId:
      $("studentAdminId")?.value ||
      ""

  };


  if (
    !body.name ||
    !body.email ||
    !body.password
  ) {

    showToast(
      "Please fill all required fields.",
      "error"
    );

    return;

  }


  if (
    body.password.length < 6
  ) {

    showToast(
      "Password must contain at least 6 characters.",
      "error"
    );

    return;

  }


  try {

    setBusy(
      button,
      true,
      "Creating..."
    );


    const token =
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
              `Bearer ${token}`

          },

          body:
            JSON.stringify(body)

        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.message ||
        "Unable to create student."
      );

    }


    closeModal();


    showToast(
      "Student account created successfully."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to create student.",
      "error"
    );


  } finally {

    setBusy(
      button,
      false
    );

  }

}


async function deleteStudent(
  studentId
) {

  const student =
    state.students.find(
      x =>
        x.id ===
        studentId
    );


  if (!student) {
    return;
  }


  if (
    !confirm(
      `Delete ${student.name}'s account?\n\nThis will also delete the student's tasks, assignments and tests.`
    )
  ) {

    return;

  }


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
              studentId
            })

        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.message ||
        "Unable to delete student."
      );

    }


    showToast(
      "Student and related records deleted."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to delete student.",
      "error"
    );

  }

}


/* =========================================================
   OWNER
========================================================= */

function getStudentOwnerAdminId(
  student
) {

  if (isAdmin()) {
    return state.user.uid;
  }

  return (
    student?.adminId ||
    state.user.uid
  );

}


/* =========================================================
   TASKS
========================================================= */

function renderTasks() {

  const container =
    $("tasksList");

  if (!container) {
    return;
  }


  if (!state.tasks.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        No tasks available.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.tasks
      .sort(
        (a, b) =>
          getTime(b.createdAt) -
          getTime(a.createdAt)
      )
      .map(
        task => {

          const student =
            state.students.find(
              x =>
                x.id ===
                task.studentId
            );


          return `
            <div class="card">

              <div class="card-top">

                <div>

                  <h3>
                    ${esc(
                      task.title
                    )}
                  </h3>

                  <p>
                    ${esc(
                      task.description ||
                      "No description."
                    )}
                  </p>

                </div>

                ${statusBadge(
                  task.status ||
                  "pending"
                )}

              </div>


              <div class="card-meta">

                <span class="badge">
                  Student:
                  ${esc(
                    student?.name ||
                    "Student"
                  )}
                </span>

              </div>


              ${
                isAdmin()
                  ? `
                    <div class="card-actions">

                      <button
                        class="danger-btn"
                        data-delete-task="${task.id}"
                      >
                        Delete
                      </button>

                    </div>
                  `
                  : ""
              }

            </div>
          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-delete-task]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteTask(
            button.dataset
              .deleteTask
          );

    });

}


function openTaskModal() {

  if (!isAdmin()) {

    showToast(
      "Only admins can create tasks.",
      "error"
    );

    return;

  }


  if (!state.students.length) {

    showToast(
      "Create a student first.",
      "error"
    );

    return;

  }


  openModal(

    "Create Task",

    `
      <form
        id="taskForm"
        class="modal-form"
      >

        <div class="form-group">

          <label>
            Student

            <select
              id="taskStudent"
              required
            >

              <option value="">
                Select student
              </option>

              ${state.students
                .map(
                  student => `
                    <option
                      value="${student.id}"
                    >
                      ${esc(
                        student.name
                      )}
                    </option>
                  `
                )
                .join("")}

            </select>

          </label>

        </div>


        <div class="form-group">

          <label>
            Task Title

            <input
              id="taskTitle"
              required
              placeholder="Task title"
            >

          </label>

        </div>


        <div class="form-group">

          <label>
            Description

            <textarea
              id="taskDescription"
              rows="4"
              placeholder="Task description"
            ></textarea>

          </label>

        </div>


        <div class="modal-actions">

          <button
            type="button"
            class="secondary-btn"
            data-close-modal
          >
            Cancel
          </button>

          <button
            type="submit"
            class="primary-btn"
          >
            Create Task
          </button>

        </div>

      </form>
    `
  );


  $("taskForm")
    ?.addEventListener(
      "submit",
      createTask
    );

}


async function createTask(event) {

  event.preventDefault();


  if (!isAdmin()) {

    showToast(
      "Only admins can create tasks.",
      "error"
    );

    return;

  }


  const button =
    event.submitter;


  const studentId =
    $("taskStudent")?.value;


  const student =
    state.students.find(
      x =>
        x.id ===
        studentId
    );


  if (!student) {

    showToast(
      "Please select a student.",
      "error"
    );

    return;

  }


  try {

    setBusy(
      button,
      true,
      "Creating..."
    );


    await addDoc(
      collection(
        db,
        "tasks"
      ),
      {

        title:
          clean(
            $("taskTitle")?.value
          ),

        description:
          clean(
            $("taskDescription")?.value
          ),

        studentId,

        adminId:
          state.user.uid,

        status:
          "pending",

        assignedAt:
          serverTimestamp(),

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),

        acceptedAt:
          null,

        completedAt:
          null,

        completionSeconds:
          null

      }
    );


    closeModal();


    showToast(
      "Task created successfully."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to create task.",
      "error"
    );


  } finally {

    setBusy(
      button,
      false
    );

  }

}


async function deleteTask(id) {

  if (!isAdmin()) {

    showToast(
      "Only admins can delete tasks.",
      "error"
    );

    return;

  }


  if (
    !confirm(
      "Delete this task?"
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(
        db,
        "tasks",
        id
      )
    );


    showToast(
      "Task deleted."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      "Unable to delete task.",
      "error"
    );

  }

}


/* =========================================================
   STUDENT TASKS
========================================================= */

function renderMyTasks() {

  const container =
    $("myTasksGrid");

  if (!container) {
    return;
  }


  if (!state.tasks.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        No tasks assigned to you.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.tasks
      .map(
        task => {

          const completed =
            task.status ===
            "completed";


          const accepted =
            task.status ===
            "accepted";


          let button = "";


          if (
            !completed &&
            !accepted
          ) {

            button = `
              <button
                class="primary-btn"
                data-accept-task="${task.id}"
              >
                Accept Task
              </button>
            `;

          } else if (accepted) {

            button = `
              <button
                class="success-btn"
                data-complete-task="${task.id}"
              >
                Complete Task
              </button>
            `;

          } else {

            button = `
              <span class="badge success">
                Completed
              </span>
            `;

          }


          return `
            <div
              class="task-card
                ${completed ? "completed" : ""}"
            >

              <div class="card-top">

                <div>

                  <h3>
                    ${esc(
                      task.title
                    )}
                  </h3>

                  <div class="task-description">
                    ${esc(
                      task.description ||
                      "No description."
                    )}
                  </div>

                </div>

                ${statusBadge(
                  task.status ||
                  "pending"
                )}

              </div>


              <div class="card-meta">

                <span class="badge">
                  Assigned
                  ${formatDate(
                    task.assignedAt
                  )}
                </span>

                ${
                  task.completionSeconds != null
                    ? `
                      <span class="badge">
                        Time:
                        ${formatSeconds(
                          task.completionSeconds
                        )}
                      </span>
                    `
                    : ""
                }

              </div>


              <div class="task-card-footer">
                ${button}
              </div>

            </div>
          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-accept-task]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          acceptTask(
            button.dataset
              .acceptTask
          );

    });


  container
    .querySelectorAll(
      "[data-complete-task]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          completeTask(
            button.dataset
              .completeTask
          );

    });

}


async function acceptTask(id) {

  if (!isStudent()) {
    return;
  }


  const task =
    state.tasks.find(
      x =>
        x.id === id
    );


  if (
    !task ||
    task.status ===
    "completed"
  ) {

    return;

  }


  try {

    await updateDoc(
      doc(
        db,
        "tasks",
        id
      ),
      {

        status:
          "accepted",

        acceptedAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      }
    );


    showToast(
      "Task accepted. Timer started."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      "Unable to accept task.",
      "error"
    );

  }

}


async function completeTask(id) {

  if (!isStudent()) {
    return;
  }


  const task =
    state.tasks.find(
      x =>
        x.id === id
    );


  if (
    !task ||
    task.status !==
    "accepted"
  ) {

    return;

  }


  const start =
    getTime(
      task.acceptedAt ||
      task.assignedAt
    );


  const seconds =
    start
      ? Math.max(
          0,
          Math.floor(
            (
              Date.now() -
              start
            ) / 1000
          )
        )
      : 0;


  try {

    await updateDoc(
      doc(
        db,
        "tasks",
        id
      ),
      {

        status:
          "completed",

        completedAt:
          serverTimestamp(),

        completionSeconds:
          seconds,

        updatedAt:
          serverTimestamp()

      }
    );


    showToast(
      "Task completed successfully."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      "Unable to complete task.",
      "error"
    );

  }

}


function formatSeconds(
  seconds
) {

  const value =
    Number(
      seconds || 0
    );


  const minutes =
    Math.floor(
      value / 60
    );


  const remaining =
    value % 60;


  if (minutes <= 0) {

    return `${remaining}s`;

  }


  return `${minutes}m ${remaining}s`;

}


/* =========================================================
   ASSIGNMENTS
========================================================= */

function renderAssignments() {

  const container =
    $("assignmentsList");

  if (!container) {
    return;
  }


  if (!state.assignments.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        No assignments available.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.assignments
      .map(
        item => {

          const student =
            state.students.find(
              x =>
                x.id ===
                item.studentId
            );


          return `
            <div class="card">

              <div class="card-top">

                <div>

                  <h3>
                    ${esc(
                      item.title
                    )}
                  </h3>

                  <p>
                    ${esc(
                      item.description ||
                      "No description."
                    )}
                  </p>

                </div>

                ${statusBadge(
                  item.submitted
                    ? "submitted"
                    : "pending"
                )}

              </div>


              <div class="card-meta">

                <span class="badge">
                  Student:
                  ${esc(
                    student?.name ||
                    "Student"
                  )}
                </span>

                <span class="badge">
                  Due:
                  ${formatDate(
                    item.deadline
                  )}
                </span>

              </div>


              ${
                isAdmin()
                  ? `
                    <div class="card-actions">

                      <button
                        class="danger-btn"
                        data-delete-assignment="${item.id}"
                      >
                        Delete
                      </button>

                    </div>
                  `
                  : ""
              }

            </div>
          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-delete-assignment]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteAssignment(
            button.dataset
              .deleteAssignment
          );

    });

}


function openAssignmentModal() {

  if (!isAdmin()) {

    showToast(
      "Only admins can create assignments.",
      "error"
    );

    return;

  }


  if (!state.students.length) {

    showToast(
      "Create a student first.",
      "error"
    );

    return;

  }


  openModal(

    "Create Assignment",

    `
      <form
        id="assignmentForm"
        class="modal-form"
      >

        <div class="form-group">

          <label>
            Student

            <select
              id="assignmentStudent"
              required
            >

              <option value="">
                Select student
              </option>

              ${state.students
                .map(
                  student => `
                    <option
                      value="${student.id}"
                    >
                      ${esc(
                        student.name
                      )}
                    </option>
                  `
                )
                .join("")}

            </select>

          </label>

        </div>


        <div class="form-group">

          <label>
            Assignment Title

            <input
              id="assignmentTitle"
              required
            >

          </label>

        </div>


        <div class="form-group">

          <label>
            Description

            <textarea
              id="assignmentDescription"
              rows="4"
            ></textarea>

          </label>

        </div>


        <div class="form-group">

          <label>
            Deadline

            <input
              id="assignmentDeadline"
              type="date"
              required
            >

          </label>

        </div>


        <div class="modal-actions">

          <button
            type="button"
            class="secondary-btn"
            data-close-modal
          >
            Cancel
          </button>

          <button
            type="submit"
            class="primary-btn"
          >
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


async function createAssignment(
  event
) {

  event.preventDefault();


  if (!isAdmin()) {

    showToast(
      "Only admins can create assignments.",
      "error"
    );

    return;

  }


  const button =
    event.submitter;


  const studentId =
    $("assignmentStudent")?.value;


  const student =
    state.students.find(
      x =>
        x.id ===
        studentId
    );


  const deadline =
    $("assignmentDeadline")?.value;


  if (!student) {

    showToast(
      "Select a student.",
      "error"
    );

    return;

  }


  if (!deadline) {

    showToast(
      "Select a deadline.",
      "error"
    );

    return;

  }


  try {

    setBusy(
      button,
      true,
      "Creating..."
    );


    await addDoc(
      collection(
        db,
        "assignments"
      ),
      {

        title:
          clean(
            $("assignmentTitle")?.value
          ),

        description:
          clean(
            $("assignmentDescription")?.value
          ),

        studentId,

        adminId:
          state.user.uid,

        deadline,

        submitted:
          false,

        submissionDate:
          null,

        submittedLate:
          false,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      }
    );


    closeModal();


    showToast(
      "Assignment created successfully."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to create assignment.",
      "error"
    );


  } finally {

    setBusy(
      button,
      false
    );

  }

}


async function deleteAssignment(
  id
) {

  if (!isAdmin()) {

    showToast(
      "Only admins can delete assignments.",
      "error"
    );

    return;

  }


  if (
    !confirm(
      "Delete this assignment?"
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(
        db,
        "assignments",
        id
      )
    );


    showToast(
      "Assignment deleted."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      "Unable to delete assignment.",
      "error"
    );

  }

}


/* =========================================================
   STUDENT ASSIGNMENTS
========================================================= */

function renderMyAssignments() {

  const container =
    $("myAssignmentsTable");

  if (!container) {
    return;
  }


  if (!state.assignments.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        No assignments assigned to you.
      </div>
    `;

    return;

  }


  container.innerHTML = `
    <table class="data-table">

      <thead>

        <tr>
          <th>Assignment</th>
          <th>Deadline</th>
          <th>Status</th>
          <th>Action</th>
        </tr>

      </thead>

      <tbody>

        ${state.assignments
          .map(
            item => {

              const deadline =
                new Date(
                  `${item.deadline}T23:59:59`
                );


              const late =
                !item.submitted &&
                Date.now() >
                  deadline.getTime();


              const status =
                item.submitted
                  ? (
                      item.submittedLate
                        ? "late"
                        : "submitted"
                    )
                  : (
                      late
                        ? "late"
                        : "pending"
                    );


              return `
                <tr>

                  <td>

                    <strong>
                      ${esc(
                        item.title
                      )}
                    </strong>

                    <br>

                    <small>
                      ${esc(
                        item.description ||
                        ""
                      )}
                    </small>

                  </td>

                  <td>
                    ${formatDate(
                      item.deadline
                    )}
                  </td>

                  <td>
                    ${statusBadge(
                      status
                    )}
                  </td>

                  <td>

                    ${
                      item.submitted
                        ? `
                          <span
                            class="badge success"
                          >
                            Submitted
                          </span>
                        `
                        : `
                          <button
                            class="primary-btn"
                            data-submit-assignment="${item.id}"
                          >
                            Submit
                          </button>
                        `
                    }

                  </td>

                </tr>
              `;

            }
          )
          .join("")}

      </tbody>

    </table>
  `;


  container
    .querySelectorAll(
      "[data-submit-assignment]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          submitAssignment(
            button.dataset
              .submitAssignment
          );

    });

}


async function submitAssignment(
  id
) {

  if (!isStudent()) {
    return;
  }


  const assignment =
    state.assignments.find(
      x =>
        x.id === id
    );


  if (
    !assignment ||
    assignment.submitted
  ) {

    return;

  }


  const deadline =
    new Date(
      `${assignment.deadline}T23:59:59`
    );


  const late =
    Date.now() >
    deadline.getTime();


  if (
    !confirm(
      late
        ? "This assignment is already late. Submit it now?"
        : "Submit this assignment?"
    )
  ) {

    return;

  }


  try {

    await updateDoc(
      doc(
        db,
        "assignments",
        id
      ),
      {

        submitted:
          true,

        submissionDate:
          serverTimestamp(),

        submittedLate:
          late

      }
    );


    showToast(
      late
        ? "Assignment submitted late."
        : "Assignment submitted successfully."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      "Unable to submit assignment.",
      "error"
    );

  }

}


/* =========================================================
   TESTS
========================================================= */

function renderTests() {

  const container =
    $("testsList");

  if (!container) {
    return;
  }


  if (!state.tests.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        No tests available.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.tests
      .map(
        test => {

          const student =
            state.students.find(
              x =>
                x.id ===
                test.studentId
            );


          const marks =
            Number(
              test.marks || 0
            );


          const total =
            Number(
              test.totalMarks || 0
            );


          const percent =
            total > 0
              ? Math.round(
                  marks /
                  total *
                  100
                )
              : 0;


          return `
            <div class="card">

              <div class="card-top">

                <div>

                  <h3>
                    ${esc(
                      test.title
                    )}
                  </h3>

                  <p>
                    Student:
                    ${esc(
                      student?.name ||
                      "Student"
                    )}
                  </p>

                </div>

                <span class="badge primary">
                  ${marks}/${total}
                </span>

              </div>


              <div class="card-meta">

                <span class="badge">
                  ${percent}%
                </span>

                <span class="badge">
                  Date:
                  ${formatDate(
                    test.testDate
                  )}
                </span>

              </div>


              ${
                isAdmin()
                  ? `
                    <div class="card-actions">

                      <button
                        class="danger-btn"
                        data-delete-test="${test.id}"
                      >
                        Delete
                      </button>

                    </div>
                  `
                  : ""
              }

            </div>
          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-delete-test]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteTest(
            button.dataset
              .deleteTest
          );

    });

}


function openTestModal() {

  if (!isAdmin()) {

    showToast(
      "Only admins can add test results.",
      "error"
    );

    return;

  }


  if (!state.students.length) {

    showToast(
      "Create a student first.",
      "error"
    );

    return;

  }


  openModal(

    "Add Test Result",

    `
      <form
        id="testForm"
        class="modal-form"
      >

        <div class="form-group">

          <label>
            Student

            <select
              id="testStudent"
              required
            >

              <option value="">
                Select student
              </option>

              ${state.students
                .map(
                  student => `
                    <option
                      value="${student.id}"
                    >
                      ${esc(
                        student.name
                      )}
                    </option>
                  `
                )
                .join("")}

            </select>

          </label>

        </div>


        <div class="form-group">

          <label>
            Test Title

            <input
              id="testTitle"
              required
            >

          </label>

        </div>


        <div class="form-row">

          <div class="form-group">

            <label>
              Obtained Marks

              <input
                id="testMarks"
                type="number"
                min="0"
                required
              >

            </label>

          </div>


          <div class="form-group">

            <label>
              Total Marks

              <input
                id="testTotalMarks"
                type="number"
                min="1"
                required
              >

            </label>

          </div>

        </div>


        <div class="form-group">

          <label>
            Test Date

            <input
              id="testDate"
              type="date"
              required
            >

          </label>

        </div>


        <div class="modal-actions">

          <button
            type="button"
            class="secondary-btn"
            data-close-modal
          >
            Cancel
          </button>

          <button
            type="submit"
            class="primary-btn"
          >
            Save Test
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


async function createTest(
  event
) {

  event.preventDefault();


  if (!isAdmin()) {

    showToast(
      "Only admins can add tests.",
      "error"
    );

    return;

  }


  const button =
    event.submitter;


  const studentId =
    $("testStudent")?.value;


  const student =
    state.students.find(
      x =>
        x.id ===
        studentId
    );


  const marks =
    Number(
      $("testMarks")?.value
    );


  const totalMarks =
    Number(
      $("testTotalMarks")?.value
    );


  if (!student) {

    showToast(
      "Select a student.",
      "error"
    );

    return;

  }


  if (
    !Number.isFinite(marks) ||
    !Number.isFinite(totalMarks) ||
    totalMarks <= 0 ||
    marks < 0 ||
    marks > totalMarks
  ) {

    showToast(
      "Enter valid marks.",
      "error"
    );

    return;

  }


  try {

    setBusy(
      button,
      true,
      "Saving..."
    );


    await addDoc(
      collection(
        db,
        "tests"
      ),
      {

        title:
          clean(
            $("testTitle")?.value
          ),

        studentId,

        adminId:
          state.user.uid,

        marks,

        totalMarks,

        testDate:
          $("testDate")?.value,

        createdAt:
          serverTimestamp()

      }
    );


    closeModal();


    showToast(
      "Test result saved successfully."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to save test.",
      "error"
    );


  } finally {

    setBusy(
      button,
      false
    );

  }

}


async function deleteTest(
  id
) {

  if (!isAdmin()) {

    showToast(
      "Only admins can delete tests.",
      "error"
    );

    return;

  }


  if (
    !confirm(
      "Delete this test result?"
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(
        db,
        "tests",
        id
      )
    );


    showToast(
      "Test deleted."
    );


    await loadAllData();

    renderCurrentPage();


  } catch (error) {

    console.error(error);

    showToast(
      "Unable to delete test.",
      "error"
    );

  }

}


/* =========================================================
   STUDENT TESTS
========================================================= */

function renderMyTests() {

  const container =
    $("myTestsTable");

  if (!container) {
    return;
  }


  if (!state.tests.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        No test results available.
      </div>
    `;

    return;

  }


  container.innerHTML = `
    <table class="data-table">

      <thead>

        <tr>
          <th>Test</th>
          <th>Date</th>
          <th>Marks</th>
          <th>Percentage</th>
        </tr>

      </thead>

      <tbody>

        ${state.tests
          .map(
            test => {

              const marks =
                Number(
                  test.marks || 0
                );


              const total =
                Number(
                  test.totalMarks || 0
                );


              const percent =
                total
                  ? Math.round(
                      marks /
                      total *
                      100
                    )
                  : 0;


              return `
                <tr>

                  <td>
                    <strong>
                      ${esc(
                        test.title
                      )}
                    </strong>
                  </td>

                  <td>
                    ${formatDate(
                      test.testDate
                    )}
                  </td>

                  <td>
                    ${marks}/${total}
                  </td>

                  <td>
                    ${percent}%
                  </td>

                </tr>
              `;

            }
          )
          .join("")}

      </tbody>

    </table>
  `;

}


/* =========================================================
   ADMINS
========================================================= */

function renderAdmins() {

  const container =
    $("adminsList");

  if (!container) {
    return;
  }


  if (!state.admins.length) {

    container.innerHTML = `
      <div class="empty-state">
        No admin accounts found.
      </div>
    `;

    return;

  }


  container.innerHTML = `
    <table class="data-table">

      <thead>

        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th>Created</th>
        </tr>

      </thead>

      <tbody>

        ${state.admins
          .map(
            admin => `
              <tr>

                <td>
                  <strong>
                    ${esc(
                      admin.name
                    )}
                  </strong>
                </td>

                <td>
                  ${esc(
                    admin.email
                  )}
                </td>

                <td>
                  ${statusBadge(
                    admin.active === false
                      ? "inactive"
                      : "active"
                  )}
                </td>

                <td>
                  ${formatDate(
                    admin.createdAt
                  )}
                </td>

              </tr>
            `
          )
          .join("")}

      </tbody>

    </table>
  `;

}


/* =========================================================
   PROGRESS
========================================================= */

function calculateStudentProgress(
  studentId
) {

  const tasks =
    state.tasks.filter(
      x =>
        x.studentId ===
        studentId
    );


  const completedTasks =
    tasks.filter(
      x =>
        x.status ===
        "completed"
    ).length;


  const taskPercent =
    tasks.length
      ? Math.round(
          completedTasks /
          tasks.length *
          100
        )
      : 0;


  const tests =
    state.tests.filter(
      x =>
        x.studentId ===
        studentId
    );


  const marks =
    tests.reduce(
      (sum, x) =>
        sum +
        Number(
          x.marks || 0
        ),
      0
    );


  const total =
    tests.reduce(
      (sum, x) =>
        sum +
        Number(
          x.totalMarks || 0
        ),
      0
    );


  const testPercent =
    total
      ? Math.round(
          marks /
          total *
          100
        )
      : 0;


  return {

    tasks:
      tasks.length,

    completedTasks,

    taskPercent,

    tests:
      tests.length,

    marks,

    total,

    testPercent

  };

}


function renderProgress() {

  const container =
    $("progressList");

  if (!container) {
    return;
  }


  if (!state.students.length) {

    container.innerHTML = `
      <div class="empty-state">
        No students available.
      </div>
    `;

    return;

  }


  container.innerHTML = `
    <table class="data-table">

      <thead>

        <tr>
          <th>Student</th>
          <th>Tasks</th>
          <th>Task Progress</th>
          <th>Tests</th>
          <th>Test Average</th>
        </tr>

      </thead>

      <tbody>

        ${state.students
          .map(
            student => {

              const progress =
                calculateStudentProgress(
                  student.id
                );


              return `
                <tr>

                  <td>

                    <strong>
                      ${esc(
                        student.name
                      )}
                    </strong>

                    <br>

                    <small>
                      ${esc(
                        student.email
                      )}
                    </small>

                  </td>

                  <td>
                    ${progress.completedTasks}
                    /
                    ${progress.tasks}
                  </td>

                  <td>

                    <div
                      class="progress-track"
                    >

                      <div
                        class="progress-fill"
                        style="width:${progress.taskPercent}%"
                      ></div>

                    </div>

                    <small>
                      ${progress.taskPercent}%
                    </small>

                  </td>

                  <td>
                    ${progress.tests}
                  </td>

                  <td>
                    ${progress.testPercent}%
                  </td>

                </tr>
              `;

            }
          )
          .join("")}

      </tbody>

    </table>
  `;

}


/* =========================================================
   MODAL
========================================================= */

function openModal(
  title,
  html
) {

  const modal =
    $("modal");

  if (!modal) {
    return;
  }


  if ($("modalTitle")) {

    $("modalTitle").textContent =
      title;

  }


  if ($("modalBody")) {

    $("modalBody").innerHTML =
      html;

  }


  modal.classList.remove(
    "hidden"
  );


  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  document
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button => {

      button.onclick =
        closeModal;

    });


  setupPasswordEyes();

}


function closeModal() {

  const modal =
    $("modal");

  if (!modal) {
    return;
  }


  modal.classList.add(
    "hidden"
  );


  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  if ($("modalBody")) {

    $("modalBody").innerHTML =
      "";

  }

}


/* =========================================================
   SIDEBAR
========================================================= */

function openSidebar() {

  $("sidebar")
    ?.classList.add(
      "open"
    );


  $("sidebarOverlay")
    ?.classList.add(
      "show"
    );

}


function closeSidebar() {

  $("sidebar")
    ?.classList.remove(
      "open"
    );


  $("sidebarOverlay")
    ?.classList.remove(
      "show"
    );

}


/* =========================================================
   CURRENT PAGE
========================================================= */

function renderCurrentPage() {

  switch (
    state.currentPage
  ) {

    case "dashboard":

      renderDashboard();

      break;


    case "students":

      renderStudents();

      break;


    case "tasks":

      renderTasks();

      break;


    case "assignments":

      renderAssignments();

      break;


    case "tests":

      renderTests();

      break;


    case "admins":

      renderAdmins();

      break;


    case "progress":

      renderProgress();

      break;


    case "myTasks":

      renderMyTasks();

      break;


    case "myAssignments":

      renderMyAssignments();

      break;


    case "myTests":

      renderMyTests();

      break;

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  $("loginTab")
    ?.addEventListener(
      "click",
      () =>
        switchAuthTab(
          "login"
        )
    );


  $("registerTab")
    ?.addEventListener(
      "click",
      () =>
        switchAuthTab(
          "register"
        )
    );


  $("loginForm")
    ?.addEventListener(
      "submit",
      loginUser
    );


  $("registerForm")
    ?.addEventListener(
      "submit",
      registerAdmin
    );


  $("resendOtpBtn")
    ?.addEventListener(
      "click",
      resendOTP
    );


  $("logoutBtn")
    ?.addEventListener(
      "click",
      logoutUser
    );


  $("menuBtn")
    ?.addEventListener(
      "click",
      openSidebar
    );


  $("sidebarOverlay")
    ?.addEventListener(
      "click",
      closeSidebar
    );


  $("closeModal")
    ?.addEventListener(
      "click",
      closeModal
    );


  $("modal")
    ?.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          $("modal")
        ) {

          closeModal();

        }

      }
    );


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          showPage(
            button.dataset.page
          )
      );

    });


  $("addStudentBtn")
    ?.addEventListener(
      "click",
      openStudentModal
    );


  $("addTaskBtn")
    ?.addEventListener(
      "click",
      openTaskModal
    );


  $("addAssignmentBtn")
    ?.addEventListener(
      "click",
      openAssignmentModal
    );


  $("addTestBtn")
    ?.addEventListener(
      "click",
      openTestModal
    );


  $("studentSearch")
    ?.addEventListener(
      "input",
      renderStudents
    );


  setupPasswordEyes();

}


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      state.user =
        null;

      state.profile =
        null;

      state.students =
        [];

      state.admins =
        [];

      state.tasks =
        [];

      state.assignments =
        [];

      state.tests =
        [];


      showAuth();

      return;

    }


    try {

      state.user =
        user;


      state.profile =
        await loadProfile(
          user.uid
        );


      updateUserUI();


      updateNavigationVisibility();


      showApp();


      await loadAllData();


      let firstPage =
        "dashboard";


      if (isStudent()) {

        firstPage =
          "myTasks";

      }


      await showPage(
        firstPage
      );


    } catch (error) {

      console.error(
        "AUTH STATE ERROR:",
        error
      );


      await signOut(
        auth
      );


      showAuth();


      showToast(
        error.message ||
        "Unable to load account.",
        "error"
      );

    }

  }
);


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupEvents();


    const version =
      document.querySelector(
        ".version-text"
      );


    if (version) {

      version.textContent =
        `Version ${VERSION}`;

    }

  }
);


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.openAddStudent =
  openStudentModal;

window.openAddTask =
  openTaskModal;

window.openAddAssignment =
  openAssignmentModal;

window.openAddTest =
  openTestModal;

window.closeAppModal =
  closeModal;
