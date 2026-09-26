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

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";


/* =========================================================
   CONFIG
========================================================= */

const VERSION = "v2.2.0";

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

const storage = getStorage(app);


/* =========================================================
   CONSTANTS
========================================================= */

const MB = 1024 * 1024;

const DEFAULT_STORAGE_MB = 500;

const STORAGE_WARNING = 80;

const STORAGE_DANGER = 90;


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

  files: [],

  storageUsage: {
    usedBytes: 0,
    allocatedBytes: DEFAULT_STORAGE_MB * MB
  },

  currentPage: "dashboard",

  unsubscribe: null
};


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

const esc = value => {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

};

function clean(value) {
  return String(value ?? "").trim();
}

function initials(name) {

  const parts =
    clean(name)
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase();
}

function formatDate(value) {

  if (!value) return "—";

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

  if (!value) return "—";

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

  if (!value) return 0;

  const date =
    value?.toDate
      ? value.toDate()
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? 0
    : date.getTime();
}

function formatBytes(bytes) {

  const value = Number(bytes || 0);

  if (value <= 0) return "0 B";

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB"
  ];

  const index =
    Math.floor(
      Math.log(value) /
      Math.log(1024)
    );

  return (
    (value /
      Math.pow(1024, index))
      .toFixed(index === 0 ? 0 : 2)
      .replace(/\.00$/, "")
    + " "
    + units[index]
  );
}

function storageAllocationBytes(profile) {

  const mb =
    Number(
      profile?.storageAllocationMB ||
      DEFAULT_STORAGE_MB
    );

  return mb * MB;
}

function storagePercent(used, allocated) {

  if (!allocated) return 0;

  return Math.min(
    100,
    Math.round(
      (used / allocated) * 100
    )
  );
}

function storageStatus(percent) {

  if (percent >= 100) {
    return {
      label: "Storage Full",
      cls: "danger"
    };
  }

  if (percent >= STORAGE_DANGER) {
    return {
      label: "Almost Full",
      cls: "danger"
    };
  }

  if (percent >= STORAGE_WARNING) {
    return {
      label: "Storage Warning",
      cls: "warning"
    };
  }

  return {
    label: "Normal",
    cls: "success"
  };
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
    s === "warning" ||
    s === "almost full" ||
    s === "storage full"
  ) {
    cls = "danger";
  }

  return `
    <span class="badge ${cls}">
      ${esc(status || "Unknown")}
    </span>
  `;
}

function showToast(message, type = "success") {

  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;

  toast.className =
    `toast show ${type}`;

  clearTimeout(showToast.timer);

  showToast.timer =
    setTimeout(() => {
      toast.className = "toast";
    }, 3500);
}

function setFormMessage(
  id,
  message,
  error = false
) {

  const el = $(id);

  if (!el) return;

  el.textContent = message;

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

  if (!button) return;

  if (busy) {

    if (!button.dataset.originalText) {
      button.dataset.originalText =
        button.textContent;
    }

    button.disabled = true;

    button.textContent =
      busyText;

  } else {

    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent =
        button.dataset.originalText;
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

      button.addEventListener(
        "click",
        () => {

          const target =
            $(button.dataset.passwordTarget);

          if (!target) return;

          if (target.type === "password") {

            target.type = "text";

            button.textContent = "🙈";

          } else {

            target.type = "password";

            button.textContent = "👁️";
          }

        }
      );

    });
}


/* =========================================================
   OTP REGISTRATION
========================================================= */

let otpSent = false;

async function registerAdmin(event) {

  event.preventDefault();

  const name =
    clean($("registerName")?.value);

  const email =
    clean($("registerEmail")?.value)
      .toLowerCase();

  const password =
    $("registerPassword")?.value || "";

  const confirm =
    $("registerConfirm")?.value || "";

  const code =
    clean($("registerOTP")?.value);

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
            action: "verify-code",
            email,
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

    showToast(
      "Admin account created successfully."
    );

    otpSent = false;

    $("emailVerificationBox")
      ?.classList.add("hidden");

    $("registerForm")
      ?.reset();

    setFormMessage(
      "registerMessage",
      "Email verified. Your account has been created."
    );

    setTimeout(() => {

      switchAuthTab("login");

      if ($("loginEmail")) {
        $("loginEmail").value =
          email;
      }

    }, 1000);

  } catch (error) {

    console.error(error);

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
            action: "send-code",
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

    otpSent = true;

    $("emailVerificationBox")
      ?.classList.remove("hidden");

    if ($("sendOTPBtn")) {
      $("sendOTPBtn").textContent =
        "Verify & Create Account";
    }

    setFormMessage(
      "registerMessage",
      "Verification code sent to your email."
    );

  } catch (error) {

    console.error(error);

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
  }
}

async function resendOTP() {

  const name =
    clean($("registerName")?.value);

  const email =
    clean($("registerEmail")?.value)
      .toLowerCase();

  const password =
    $("registerPassword")?.value || "";

  if (!name || !email || !password) {

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
    $("resendOTPBtn")
  );
}


/* =========================================================
   LOGIN
========================================================= */

async function loginUser(event) {

  event.preventDefault();

  const email =
    clean($("loginEmail")?.value)
      .toLowerCase();

  const password =
    $("loginPassword")?.value || "";

  if (!email || !password) {

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

    await signOut(auth);

  } catch (error) {

    console.error(error);
  }
}


/* =========================================================
   PROFILE
========================================================= */

async function loadProfile(uid) {

  const snap =
    await getDoc(
      doc(db, "users", uid)
    );

  if (!snap.exists()) {
    throw new Error(
      "Your user profile was not found."
    );
  }

  const data =
    snap.data();

  if (data.active === false) {
    throw new Error(
      "Your account is inactive."
    );
  }

  return data;
}


/* =========================================================
   STORAGE
========================================================= */

async function loadStorageData() {

  state.files = [];

  if (!isAdmin()) {

    if (isSuperAdmin()) {
      await loadAdminStorageData();
    }

    return;
  }

  const filesSnap =
    await getDocs(
      query(
        collection(db, "files"),
        where(
          "adminId",
          "==",
          state.user.uid
        )
      )
    );

  state.files =
    filesSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  const usedBytes =
    state.files.reduce(
      (sum, file) =>
        sum + Number(file.size || 0),
      0
    );

  state.storageUsage = {

    usedBytes,

    allocatedBytes:
      storageAllocationBytes(
        state.profile
      )

  };
}

async function loadAdminStorageData() {

  for (
    const admin of state.admins
  ) {

    const filesSnap =
      await getDocs(
        query(
          collection(db, "files"),
          where(
            "adminId",
            "==",
            admin.id
          )
        )
      );

    const files =
      filesSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );

    admin._storageUsedBytes =
      files.reduce(
        (sum, file) =>
          sum + Number(file.size || 0),
        0
      );

    admin._storageAllocatedBytes =
      storageAllocationBytes(
        admin
      );
  }
}

function renderStorageCard() {

  if (!isAdmin()) {
    return "";
  }

  const used =
    state.storageUsage.usedBytes;

  const allocated =
    state.storageUsage.allocatedBytes;

  const remaining =
    Math.max(
      0,
      allocated - used
    );

  const percent =
    storagePercent(
      used,
      allocated
    );

  const status =
    storageStatus(percent);

  let warning = "";

  if (percent >= 100) {

    warning = `
      <div class="storage-warning danger">
        Storage is full. New file uploads are blocked.
        Delete old files to free space.
      </div>
    `;

  } else if (percent >= 90) {

    warning = `
      <div class="storage-warning danger">
        Your storage is almost full.
        Only ${formatBytes(remaining)} remains.
      </div>
    `;

  } else if (percent >= 80) {

    warning = `
      <div class="storage-warning warning">
        Storage usage is above 80%.
        ${formatBytes(remaining)} remains.
      </div>
    `;
  }

  return `
    <div class="storage-card">

      <div class="storage-header">

        <div>
          <h3>My Storage</h3>
          <p>File storage usage</p>
        </div>

        ${statusBadge(status.label)}

      </div>

      <div class="storage-numbers">

        <div>
          <strong>${formatBytes(allocated)}</strong>
          <small>Allocated</small>
        </div>

        <div>
          <strong>${formatBytes(used)}</strong>
          <small>Used</small>
        </div>

        <div>
          <strong>${formatBytes(remaining)}</strong>
          <small>Remaining</small>
        </div>

        <div>
          <strong>${percent}%</strong>
          <small>Used</small>
        </div>

      </div>

      <div class="progress-track storage-track">

        <div
          class="progress-fill"
          style="width:${percent}%"
        ></div>

      </div>

      ${warning}

    </div>
  `;
}

function renderFilesPage() {

  if (!isAdmin()) return;

  const container =
    $("filesList");

  if (!container) return;

  if (!state.files.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        No files uploaded yet.
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="file-grid">

      ${state.files
        .sort(
          (a,b) =>
            getTime(b.createdAt) -
            getTime(a.createdAt)
        )
        .map(file => {

          return `
            <div class="file-card">

              <div class="file-icon">
                📄
              </div>

              <div class="file-info">

                <strong>
                  ${esc(file.name)}
                </strong>

                <small>
                  ${formatBytes(file.size)}
                </small>

                <small>
                  ${formatDateTime(file.createdAt)}
                </small>

              </div>

              <div class="file-actions">

                ${
                  file.url
                    ? `
                      <a
                        href="${esc(file.url)}"
                        target="_blank"
                        rel="noopener"
                        class="secondary-btn"
                      >
                        Open
                      </a>
                    `
                    : ""
                }

                <button
                  class="danger-btn"
                  data-delete-file="${file.id}"
                >
                  Delete
                </button>

              </div>

            </div>
          `;

        }).join("")}

    </div>
  `;

  container
    .querySelectorAll(
      "[data-delete-file]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteStorageFile(
            button.dataset.deleteFile
          );

    });
}

async function uploadStorageFile() {

  const input =
    $("storageFileInput");

  const button =
    $("uploadFileBtn");

  const file =
    input?.files?.[0];

  if (!file) {

    showToast(
      "Please select a file.",
      "error"
    );

    return;
  }

  await loadStorageData();

  const used =
    state.storageUsage.usedBytes;

  const allocated =
    state.storageUsage.allocatedBytes;

  if (
    used >= allocated
  ) {

    showToast(
      "Storage is full. Delete old files first.",
      "error"
    );

    return;
  }

  if (
    used + file.size >
    allocated
  ) {

    showToast(
      `Not enough storage. Remaining: ${formatBytes(
        allocated - used
      )}`,
      "error"
    );

    return;
  }

  try {

    setBusy(
      button,
      true,
      "Uploading..."
    );

    const safeName =
      file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

    const uniqueName =
      `${Date.now()}_${safeName}`;

    const path =
      `adminFiles/${state.user.uid}/${uniqueName}`;

    const storageRef =
      ref(storage, path);

    await uploadBytes(
      storageRef,
      file
    );

    const url =
      await getDownloadURL(
        storageRef
      );

    await addDoc(
      collection(db, "files"),
      {
        adminId:
          state.user.uid,

        name:
          file.name,

        size:
          file.size,

        type:
          file.type || "application/octet-stream",

        path,

        url,

        createdAt:
          serverTimestamp()
      }
    );

    input.value = "";

    showToast(
      "File uploaded successfully."
    );

    await loadStorageData();

    renderDashboard();

    renderFilesPage();

  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to upload file.",
      "error"
    );

  } finally {

    setBusy(
      button,
      false
    );
  }
}

async function deleteStorageFile(fileId) {

  const file =
    state.files.find(
      x => x.id === fileId
    );

  if (!file) return;

  if (
    !confirm(
      `Delete "${file.name}"?`
    )
  ) {
    return;
  }

  try {

    if (file.path) {

      try {

        await deleteObject(
          ref(
            storage,
            file.path
          )
        );

      } catch (storageError) {

        console.warn(
          "Storage delete warning:",
          storageError
        );
      }
    }

    await deleteDoc(
      doc(
        db,
        "files",
        fileId
      )
    );

    showToast(
      "File deleted. Storage space freed."
    );

    await loadStorageData();

    renderDashboard();

    renderFilesPage();

  } catch (error) {

    console.error(error);

    showToast(
      "Unable to delete file.",
      "error"
    );
  }
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
  state.files = [];

  if (isAdmin()) {

    const studentsSnap =
      await getDocs(
        query(
          collection(db, "users"),
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
          collection(db, "tasks"),
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
          collection(db, "assignments"),
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
          collection(db, "tests"),
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

    await loadStorageData();

    return;
  }


  if (isSuperAdmin()) {

    const usersSnap =
      await getDocs(
        collection(db, "users")
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
        u => u.role === "student"
      );

    state.admins =
      users.filter(
        u => u.role === "admin"
      );

    const tasksSnap =
      await getDocs(
        collection(db, "tasks")
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
        collection(db, "assignments")
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
        collection(db, "tests")
      );

    state.tests =
      testsSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );

    await loadAdminStorageData();

    return;
  }


  if (isStudent()) {

    const tasksSnap =
      await getDocs(
        query(
          collection(db, "tasks"),
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
          collection(db, "assignments"),
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
          collection(db, "tests"),
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
      el.textContent = name;
    });

  document
    .querySelectorAll(
      "[data-user-role]"
    )
    .forEach(el => {
      el.textContent = role;
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
    ["Dashboard", "Overview"],

  students:
    ["Students", "Manage student accounts"],

  tasks:
    ["Tasks", "Manage daily tasks"],

  assignments:
    ["Assignments", "Manage assignments"],

  tests:
    ["Tests", "Manage tests"],

  admins:
    ["Admins", "Administrator accounts"],

  progress:
    ["Progress", "Student performance"],

  files:
    ["My Storage", "Manage your uploaded files"],

  myTasks:
    ["My Tasks", "Your assigned tasks"],

  myAssignments:
    ["My Assignments", "Your assignments"],

  myTests:
    ["My Tests", "Your test results"]
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
    "files",
    "myTasks",
    "myAssignments",
    "myTests"
  ];

  if (
    !allowedPages.includes(page)
  ) {
    page = "dashboard";
  }

  const role =
    currentRole();

  const button =
    [...document.querySelectorAll(".nav-item")]
      .find(
        x => x.dataset.page === page
      );

  if (
    button &&
    button.dataset.role &&
    !button.dataset.role
      .split(",")
      .includes(role)
  ) {
    page = "dashboard";
  }

  state.currentPage = page;

  document
    .querySelectorAll(
      "[data-page-section]"
    )
    .forEach(section => {

      section.classList.toggle(
        "hidden",
        section.dataset.pageSection !== page
      );

    });

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === page
      );

    });

  const title =
    pageNames[page] ||
    ["Dashboard", "Overview"];

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
        task.status === "completed"
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
        Number(test.marks || 0),
      0
    );

  const totalPossible =
    state.tests.reduce(
      (sum, test) =>
        sum +
        Number(test.totalMarks || 0),
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

  $("statsGrid").innerHTML =
    cards.map(
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
    ).join("");

  const storage =
    renderStorageCard();

  if (storage) {

    const existing =
      $("dashboardStorage");

    if (existing) {
      existing.innerHTML =
        storage;
    }
  }

  renderRecentActivity();

  renderDashboardProgress();
}


/* =========================================================
   RECENT ACTIVITY
========================================================= */

function renderRecentActivity() {

  const items = [];

  state.tasks.forEach(task => {

    items.push({
      time:
        getTime(
          task.completedAt ||
          task.assignedAt
        ),

      title:
        task.status === "completed"
          ? `${task.title || "Task"} completed`
          : `${task.title || "Task"} assigned`,

      date:
        task.completedAt ||
        task.assignedAt
    });

  });

  state.assignments.forEach(item => {

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

  });

  state.tests.forEach(test => {

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

  });

  items.sort(
    (a,b) =>
      b.time - a.time
  );

  const recent =
    items.slice(0, 7);

  if (!recent.length) {

    $("recentActivity").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        No recent activity.
      </div>
    `;

    return;
  }

  $("recentActivity").innerHTML =
    recent.map(
      item => `
        <div class="activity-item">

          <div class="activity-dot"></div>

          <div>
            <strong>
              ${esc(item.title)}
            </strong>

            <small>
              ${formatDateTime(item.date)}
            </small>
          </div>

        </div>
      `
    ).join("");
}


/* =========================================================
   DASHBOARD PROGRESS
========================================================= */

function renderDashboardProgress() {

  if (
    !isStudent() &&
    !state.students.length
  ) {

    $("dashboardProgress").innerHTML = `
      <div class="empty-state">
        No students available.
      </div>
    `;

    return;
  }

  const students =
    isStudent()
      ? [{
          id: state.user.uid,
          name:
            state.profile?.name ||
            "Student"
        }]
      : state.students;

  $("dashboardProgress").innerHTML =
    students
      .slice(0, 8)
      .map(student => {

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
                ${esc(student.name)}
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

      }).join("");
}


/* =========================================================
   STUDENTS
========================================================= */

function renderStudents() {

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

        return text.includes(search);
      }
    );

  if (!students.length) {

    $("studentsList").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        No students found.
      </div>
    `;

    return;
  }

  $("studentsList").innerHTML = `
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

        ${students.map(
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
                    ${esc(student.name)}
                  </strong>

                  <br>

                  <small>
                    ${esc(student.email)}
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
        ).join("")}

      </tbody>

    </table>
  `;

  document
    .querySelectorAll(
      "[data-delete-student]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          deleteStudent(
            button.dataset.deleteStudent
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

            ${state.admins.map(
              admin => `
                <option value="${admin.id}">
                  ${esc(admin.name)}
                  —
                  ${esc(admin.email)}
                </option>
              `
            ).join("")}

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
      x => x.id === studentId
    );

  if (!student) return;

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

  if (!state.tasks.length) {

    $("tasksList").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        No tasks available.
      </div>
    `;

    return;
  }

  $("tasksList").innerHTML =
    state.tasks
      .sort(
        (a,b) =>
          getTime(b.createdAt) -
          getTime(a.createdAt)
      )
      .map(task => {

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
                  ${esc(task.title)}
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

            <div class="card-actions">

              <button
                class="danger-btn"
                data-delete-task="${task.id}"
              >
                Delete
              </button>

            </div>

          </div>
        `;

      }).join("");

  document
    .querySelectorAll(
      "[data-delete-task]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteTask(
            button.dataset.deleteTask
          );

    });
}

function openTaskModal() {

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

              ${state.students.map(
                student => `
                  <option
                    value="${student.id}"
                  >
                    ${esc(student.name)}
                  </option>
                `
              ).join("")}

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
      collection(db, "tasks"),
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
          getStudentOwnerAdminId(
            student
          ),

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

  if (
    !confirm(
      "Delete this task?"
    )
  ) {
    return;
  }

  try {

    await deleteDoc(
      doc(db, "tasks", id)
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

  if (!state.tasks.length) {

    $("myTasksGrid").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        No tasks assigned to you.
      </div>
    `;

    return;
  }

  $("myTasksGrid").innerHTML =
    state.tasks
      .map(task => {

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
                  ${esc(task.title)}
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

      }).join("");

  document
    .querySelectorAll(
      "[data-accept-task]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          acceptTask(
            button.dataset.acceptTask
          );

    });

  document
    .querySelectorAll(
      "[data-complete-task]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          completeTask(
            button.dataset.completeTask
          );

    });
}

async function acceptTask(id) {

  try {

    await updateDoc(
      doc(db, "tasks", id),
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

  const task =
    state.tasks.find(
      x => x.id === id
    );

  if (!task) return;

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
            (Date.now() - start) /
            1000
          )
        )
      : 0;

  try {

    await updateDoc(
      doc(db, "tasks", id),
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

function formatSeconds(seconds) {

  const value =
    Number(seconds || 0);

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

  if (!state.assignments.length) {

    $("assignmentsList").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        No assignments available.
      </div>
    `;

    return;
  }

  $("assignmentsList").innerHTML =
    state.assignments
      .map(item => {

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
                  ${esc(item.title)}
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

            <div class="card-actions">

              <button
                class="danger-btn"
                data-delete-assignment="${item.id}"
              >
                Delete
              </button>

            </div>

          </div>
        `;

      }).join("");

  document
    .querySelectorAll(
      "[data-delete-assignment]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteAssignment(
            button.dataset.deleteAssignment
          );

    });
}

function openAssignmentModal() {

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

              ${state.students.map(
                student => `
                  <option
                    value="${student.id}"
                  >
                    ${esc(student.name)}
                  </option>
                `
              ).join("")}

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

async function createAssignment(event) {

  event.preventDefault();

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
          getStudentOwnerAdminId(
            student
          ),

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

async function deleteAssignment(id) {

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

  if (!state.assignments.length) {

    $("myAssignmentsTable").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        No assignments assigned to you.
      </div>
    `;

    return;
  }

  $("myAssignmentsTable").innerHTML = `
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
          .map(item => {

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
                    ${esc(item.title)}
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
                  ${statusBadge(status)}
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

          }).join("")}

      </tbody>

    </table>
  `;

  document
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

async function submitAssignment(id) {

  const assignment =
    state.assignments.find(
      x =>
        x.id === id
    );

  if (!assignment) return;

  if (assignment.submitted) {
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

  if (!state.tests.length) {

    $("testsList").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        No tests available.
      </div>
    `;

    return;
  }

  $("testsList").innerHTML =
    state.tests
      .map(test => {

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
                  ${esc(test.title)}
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

            <div class="card-actions">

              <button
                class="danger-btn"
                data-delete-test="${test.id}"
              >
                Delete
              </button>

            </div>

          </div>
        `;

      }).join("");

  document
    .querySelectorAll(
      "[data-delete-test]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteTest(
            button.dataset.deleteTest
          );

    });
}

function openTestModal() {

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

              ${state.students.map(
                student => `
                  <option
                    value="${student.id}"
                  >
                    ${esc(student.name)}
                  </option>
                `
              ).join("")}

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

async function createTest(event) {

  event.preventDefault();

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
      collection(db, "tests"),
      {

        title:
          clean(
            $("testTitle")?.value
          ),

        studentId,

        adminId:
          getStudentOwnerAdminId(
            student
          ),

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

async function deleteTest(id) {

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

  if (!state.tests.length) {

    $("myTestsTable").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        No test results available.
      </div>
    `;

    return;
  }

  $("myTestsTable").innerHTML = `
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

        ${state.tests.map(
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
                    ${esc(test.title)}
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
        ).join("")}

      </tbody>

    </table>
  `;
}


/* =========================================================
   ADMINS
========================================================= */

function renderAdmins() {

  if (!state.admins.length) {

    $("adminsList").innerHTML = `
      <div class="empty-state">
        No admin accounts found.
      </div>
    `;

    return;
  }

  $("adminsList").innerHTML = `
    <table class="data-table">

      <thead>

        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th>Storage</th>
          <th>Created</th>
        </tr>

      </thead>

      <tbody>

        ${state.admins.map(
          admin => {

            const allocated =
              admin._storageAllocatedBytes ||
              storageAllocationBytes(
                admin
              );

            const used =
              admin._storageUsedBytes ||
              0;

            const percent =
              storagePercent(
                used,
                allocated
              );

            const status =
              storageStatus(
                percent
              );

            return `
              <tr>

                <td>
                  <strong>
                    ${esc(admin.name)}
                  </strong>
                </td>

                <td>
                  ${esc(admin.email)}
                </td>

                <td>
                  ${statusBadge(
                    admin.active === false
                      ? "inactive"
                      : "active"
                  )}
                </td>

                <td>

                  <strong>
                    ${formatBytes(used)}
                    /
                    ${formatBytes(allocated)}
                  </strong>

                  <div
                    class="progress-track"
                    style="margin-top:7px"
                  >

                    <div
                      class="progress-fill"
                      style="width:${percent}%"
                    ></div>

                  </div>

                  <small>
                    ${percent}% —
                    ${esc(status.label)}
                  </small>

                </td>

                <td>
                  ${formatDate(
                    admin.createdAt
                  )}
                </td>

              </tr>
            `;

          }
        ).join("")}

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
        Number(x.marks || 0),
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
    tasks: tasks.length,
    completedTasks,
    taskPercent,
    tests: tests.length,
    marks,
    total,
    testPercent
  };
}

function renderProgress() {

  if (!state.students.length) {

    $("progressList").innerHTML = `
      <div class="empty-state">
        No students available.
      </div>
    `;

    return;
  }

  $("progressList").innerHTML = `
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

        ${state.students.map(
          student => {

            const progress =
              calculateStudentProgress(
                student.id
              );

            return `
              <tr>

                <td>

                  <strong>
                    ${esc(student.name)}
                  </strong>

                  <br>

                  <small>
                    ${esc(student.email)}
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
        ).join("")}

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

  if (!modal) return;

  $("modalTitle").textContent =
    title;

  $("modalBody").innerHTML =
    html;

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

  if (!modal) return;

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
    ?.classList.add("open");

  $("sidebarOverlay")
    ?.classList.add("show");
}

function closeSidebar() {

  $("sidebar")
    ?.classList.remove("open");

  $("sidebarOverlay")
    ?.classList.remove("show");
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

    case "files":
      renderFilesPage();
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

  $("resendOTPBtn")
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

  $("uploadFileBtn")
    ?.addEventListener(
      "click",
      uploadStorageFile
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

      state.user = null;

      state.profile = null;

      state.students = [];

      state.admins = [];

      state.tasks = [];

      state.assignments = [];

      state.tests = [];

      state.files = [];

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

      console.error(error);

      await signOut(auth);

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
