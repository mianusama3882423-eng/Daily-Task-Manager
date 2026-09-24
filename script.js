// ============================================================
// DAILY TASK MANAGER
// Upgraded Firebase + Vercel Version
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
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIG
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
// GLOBAL STATE
// ============================================================

const state = {

  user: null,

  profile: null,

  students: [],

  admins: [],

  tasks: [],

  assignments: [],

  tests: [],

  currentPage: "dashboard",

  currentStudent: null

};


// ============================================================
// SHORTCUT
// ============================================================

function $(id) {
  return document.getElementById(id);
}


// ============================================================
// TOAST
// ============================================================

function toast(message, type = "success") {

  let box = $("toast");

  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    document.body.appendChild(box);
  }

  box.textContent = message;

  box.className = `toast ${type}`;

  box.style.display = "block";
  box.classList.add("show");

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {

    box.classList.remove("show");

    setTimeout(() => {
      box.style.display = "none";
    }, 300);

  }, 2500);
}

// ============================================================
// FIREBASE ERROR HANDLER
// ============================================================

function getFirebaseError(error) {

  if (!error) {
    return "Something went wrong.";
  }


  const code =
    error.code || "";


  const messages = {

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
      "You do not have permission for this action.",

    "unavailable":
      "Firebase is temporarily unavailable."

  };


  return (
    messages[code] ||
    error.message ||
    "Something went wrong."
  );
}


// ============================================================
// AUTH SCREENS
// ============================================================

function showAuth() {

  const authScreen = $("authScreen");
  const appScreen = $("appScreen");

  if (authScreen) {
    authScreen.classList.remove("hidden");
    authScreen.style.display = "";
  }

  if (appScreen) {
    appScreen.classList.add("hidden");
    appScreen.style.display = "none";
  }

}


function showApp() {

  const authScreen = $("authScreen");
  const appScreen = $("appScreen");

  if (authScreen) {
    authScreen.classList.add("hidden");
    authScreen.style.display = "none";
  }

  if (appScreen) {
    appScreen.classList.remove("hidden");
    appScreen.style.display = "";
  }

}

// ============================================================
// AUTH TABS
// ============================================================

function setupAuthTabs() {

  const loginTab =
    $("loginTab");

  const registerTab =
    $("registerTab");

  const loginPanel =
    $("loginPanel");

  const registerPanel =
    $("registerPanel");


  if (loginTab) {

    loginTab.addEventListener(
      "click",
      () => {

        loginTab.classList.add("active");

        registerTab?.classList.remove(
          "active"
        );


        if (loginPanel) {
          loginPanel.style.display =
            "block";
        }


        if (registerPanel) {
          registerPanel.style.display =
            "none";
        }

      }
    );
  }


  if (registerTab) {

    registerTab.addEventListener(
      "click",
      () => {

        registerTab.classList.add("active");

        loginTab?.classList.remove(
          "active"
        );


        if (registerPanel) {
          registerPanel.style.display =
            "block";
        }


        if (loginPanel) {
          loginPanel.style.display =
            "none";
        }

      }
    );
  }
}


// ============================================================
// ADMIN REGISTRATION
// ============================================================

function setupAdminRegistration() {

  const form =
    $("registerForm");


  if (!form) return;


  form.addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      const name =
        $("registerName")?.value.trim();

      const email =
        $("registerEmail")?.value.trim();

      const password =
        $("registerPassword")?.value;

      const confirm =
        $("registerConfirm")?.value;


      if (!name || !email || !password) {

        toast(
          "Please fill all required fields.",
          "error"
        );

        return;
      }


      if (password !== confirm) {

        toast(
          "Passwords do not match.",
          "error"
        );

        return;
      }


      if (password.length < 6) {

        toast(
          "Password must be at least 6 characters.",
          "error"
        );

        return;
      }


      try {

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

                name,

                email,

                password

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
            "Unable to create Admin account."
          );
        }


        toast(
          "Admin account created. You can now login."
        );


        $("loginTab")?.click();


        if ($("loginEmail")) {

          $("loginEmail").value =
            email;
        }


        if ($("loginPassword")) {

          $("loginPassword").value =
            "";
        }


        form.reset();


      } catch (error) {

        console.error(error);


        toast(
          error.message ||
          "Registration failed.",
          "error"
        );

      }

    }
  );
}


// ============================================================
// LOGIN
// ============================================================

function setupLogin() {

  const form =
    $("loginForm");


  if (!form) return;


  form.addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      const email =
        $("loginEmail")?.value.trim();

      const password =
        $("loginPassword")?.value;


      if (!email || !password) {

        toast(
          "Please enter email and password.",
          "error"
        );

        return;
      }


      try {

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );


        toast(
          "Login successful."
        );


      } catch (error) {

        console.error(error);


        toast(
          getFirebaseError(error),
          "error"
        );

      }

    }
  );
}


// ============================================================
// LOGOUT
// ============================================================

function setupLogout() {

  const buttons =
    document.querySelectorAll(
      "[data-action='logout'], #logoutBtn, #logoutButton"
    );


  buttons.forEach(button => {

    button.addEventListener(
      "click",
      async () => {

        try {

          await signOut(auth);

          state.user = null;

          state.profile = null;

          toast(
            "Logged out successfully."
          );

        } catch (error) {

          toast(
            getFirebaseError(error),
            "error"
          );

        }

      }
    );

  });
}


// ============================================================
// LOAD ALL DATA
// ============================================================

async function loadAllData() {

  if (!state.user ||
      !state.profile) {

    return;
  }


  try {

    if (
      state.profile.role ===
      "superadmin"
    ) {

      await loadSuperData();

    }

    else if (
      state.profile.role ===
      "admin"
    ) {

      await loadAdminData();

    }

    else if (
      state.profile.role ===
      "student"
    ) {

      await loadStudentData();

    }


    renderEverything();


  } catch (error) {

    console.error(
      "Data loading error:",
      error
    );


    toast(
      "Unable to load account data.",
      "error"
    );

  }
}


// ============================================================
// LOAD ADMIN DATA
// ============================================================

async function loadAdminData() {

  const studentsQuery =
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
    );


  const studentsSnap =
    await getDocs(
      studentsQuery
    );


  state.students =
    studentsSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


  const tasksQuery =
    query(
      collection(db, "tasks"),
      where(
        "adminId",
        "==",
        state.user.uid
      )
    );


  const tasksSnap =
    await getDocs(
      tasksQuery
    );


  state.tasks =
    tasksSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


  const assignmentsQuery =
    query(
      collection(db, "assignments"),
      where(
        "adminId",
        "==",
        state.user.uid
      )
    );


  const assignmentsSnap =
    await getDocs(
      assignmentsQuery
    );


  state.assignments =
    assignmentsSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


  const testsQuery =
    query(
      collection(db, "tests"),
      where(
        "adminId",
        "==",
        state.user.uid
      )
    );


  const testsSnap =
    await getDocs(
      testsQuery
    );


  state.tests =
    testsSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );
}


// ============================================================
// LOAD SUPER ADMIN DATA
// ============================================================

async function loadSuperData() {

  const usersSnap =
    await getDocs(
      collection(
        db,
        "users"
      )
    );


  const allUsers =
    usersSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


  state.students =
    allUsers.filter(
      u =>
        u.role ===
        "student"
    );


  state.admins =
    allUsers.filter(
      u =>
        u.role ===
        "admin"
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
}


// ============================================================
// LOAD STUDENT DATA
// ============================================================

async function loadStudentData() {

  const uid =
    state.user.uid;


  const tasksQuery =
    query(
      collection(db, "tasks"),
      where(
        "studentId",
        "==",
        uid
      )
    );


  const tasksSnap =
    await getDocs(
      tasksQuery
    );


  state.tasks =
    tasksSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


  const assignmentsQuery =
    query(
      collection(db, "assignments"),
      where(
        "studentId",
        "==",
        uid
      )
    );


  const assignmentsSnap =
    await getDocs(
      assignmentsQuery
    );


  state.assignments =
    assignmentsSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


  const testsQuery =
    query(
      collection(db, "tests"),
      where(
        "studentId",
        "==",
        uid
      )
    );


  const testsSnap =
    await getDocs(
      testsQuery
    );


  state.tests =
    testsSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


  state.students = [];

  state.admins = [];
}


// ============================================================
// RENDER EVERYTHING
// ============================================================

function renderEverything() {

  renderUserInfo();

  renderDashboard();

  renderStudents();

  renderTasks();

  renderAssignments();

  renderTests();

  renderProgress();

  renderAdmins();

  updateRoleVisibility();
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
    .querySelectorAll(
      "[data-user-name], #userName, #profileName"
    )
    .forEach(el => {

      el.textContent = name;

    });


  document
    .querySelectorAll(
      "[data-user-email], #userEmail, #profileEmail"
    )
    .forEach(el => {

      el.textContent =
        state.profile?.email ||
        state.user?.email ||
        "";

    });


  document
    .querySelectorAll(
      "[data-user-role], #userRole, #profileRole"
    )
    .forEach(el => {

      el.textContent =
        state.profile?.role ||
        "";

    });
}


// ============================================================
// ROLE VISIBILITY
// ============================================================

function updateRoleVisibility() {

  const role =
    state.profile?.role;


  document
    .querySelectorAll(
      "[data-role]"
    )
    .forEach(el => {

      const allowed =
        el.dataset.role
          ?.split(",")
          .map(x => x.trim());


      if (
        !allowed ||
        allowed.includes(role)
      ) {

        el.style.display = "";

      } else {

        el.style.display =
          "none";

      }

    });
}


// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {

  const totalTasks =
    state.tasks.length;


  const completedTasks =
    state.tasks.filter(
      task =>
        task.status ===
        "completed"
    ).length;


  const pendingTasks =
    totalTasks -
    completedTasks;


  const totalAssignments =
    state.assignments.length;


  const submittedAssignments =
    state.assignments.filter(
      a =>
        a.submitted === true
    ).length;


  const totalTests =
    state.tests.length;


  setText(
    [
      "totalTasks",
      "dashboardTotalTasks"
    ],
    totalTasks
  );


  setText(
    [
      "completedTasks",
      "dashboardCompletedTasks"
    ],
    completedTasks
  );


  setText(
    [
      "pendingTasks",
      "dashboardPendingTasks"
    ],
    pendingTasks
  );


  setText(
    [
      "totalAssignments",
      "dashboardTotalAssignments"
    ],
    totalAssignments
  );


  setText(
    [
      "submittedAssignments",
      "dashboardSubmittedAssignments"
    ],
    submittedAssignments
  );


  setText(
    [
      "totalTests",
      "dashboardTotalTests"
    ],
    totalTests
  );


  const progress =
    totalTasks === 0
      ? 0
      : Math.round(
          (
            completedTasks /
            totalTasks
          ) * 100
        );


  setText(
    [
      "overallProgress",
      "dashboardProgress"
    ],
    `${progress}%`
  );
}


// ============================================================
// STUDENTS
// ============================================================

function renderStudents() {

  const containers =
    document.querySelectorAll(
      "#studentsList, #studentList, [data-students-list]"
    );


  containers.forEach(container => {

    if (
      state.students.length === 0
    ) {

      container.innerHTML =
        `<div class="empty-state">
          No students found.
        </div>`;

      return;
    }


    container.innerHTML =
      state.students.map(
        student => {

          const studentTasks =
            state.tasks.filter(
              task =>
                task.studentId ===
                student.id
            );


          const completed =
            studentTasks.filter(
              task =>
                task.status ===
                "completed"
            ).length;


          const percentage =
            studentTasks.length
              ? Math.round(
                  completed /
                  studentTasks.length *
                  100
                )
              : 0;


          return `
            <div class="student-card">

              <div class="student-info">

                <h3>
                  ${escapeHtml(
                    student.name ||
                    "Unnamed Student"
                  )}
                </h3>

                <p>
                  ${escapeHtml(
                    student.email ||
                    ""
                  )}
                </p>

                ${
                  student.age
                    ? `<p>Age: ${student.age}</p>`
                    : ""
                }

                ${
                  student.className
                    ? `<p>Class: ${escapeHtml(
                        student.className
                      )}</p>`
                    : ""
                }

              </div>


              <div class="student-progress">

                <strong>
                  ${percentage}%
                </strong>

                <div class="progress-bar">

                  <span
                    style="
                      width:${percentage}%;
                    "
                  ></span>

                </div>

              </div>


              <div class="student-actions">

                <button
                  type="button"
                  onclick="window.viewStudent('${student.id}')"
                >
                  View
                </button>

                <button
                  type="button"
                  class="danger"
                  onclick="window.deleteStudent('${student.id}')"
                >
                  Delete
                </button>

              </div>

            </div>
          `;

        }
      ).join("");

  });
}


// ============================================================
// VIEW STUDENT
// ============================================================

window.viewStudent =
  function(studentId) {

    const student =
      state.students.find(
        s =>
          s.id ===
          studentId
      );


    if (!student) return;


    state.currentStudent =
      student;


    const studentTasks =
      state.tasks.filter(
        t =>
          t.studentId ===
          studentId
      );


    const completed =
      studentTasks.filter(
        t =>
          t.status ===
          "completed"
      ).length;


    const percentage =
      studentTasks.length
        ? Math.round(
            completed /
            studentTasks.length *
            100
          )
        : 0;


    showModal(
      "Student Progress",
      `
        <div class="student-detail">

          <h2>
            ${escapeHtml(
              student.name
            )}
          </h2>

          <p>
            Email:
            ${escapeHtml(
              student.email || ""
            )}
          </p>

          ${
            student.age
              ? `<p>Age: ${student.age}</p>`
              : ""
          }

          ${
            student.className
              ? `<p>Class:
                ${escapeHtml(
                  student.className
                )}
              </p>`
              : ""
          }

          <hr>

          <h3>
            Task Progress
          </h3>

          <div class="progress-bar">

            <span
              style="
                width:${percentage}%;
              "
            ></span>

          </div>

          <p>
            ${completed}
            /
            ${studentTasks.length}
            completed
            (${percentage}%)
          </p>

        </div>
      `
    );
  };


// ============================================================
// DELETE STUDENT
// ============================================================

window.deleteStudent =
  async function(studentId) {

    if (
      state.profile?.role !==
      "superadmin"
    ) {

      toast(
        "Only Super Admin can delete student accounts.",
        "error"
      );

      return;
    }


    const student =
      state.students.find(
        s =>
          s.id ===
          studentId
      );


    if (!student) return;


    const confirmed =
      confirm(
        `Delete ${student.name || "this student"}?`
      );


    if (!confirmed) return;


    try {

      await deleteDoc(
        doc(
          db,
          "users",
          studentId
        )
      );


      await loadAllData();


      toast(
        "Student profile deleted."
      );


    } catch (error) {

      console.error(error);


      toast(
        getFirebaseError(error),
        "error"
      );

    }
  };


// ============================================================
// ADD STUDENT
// ============================================================

window.openAddStudent =
  function() {

    showModal(
      "Create Student",
      `
        <form id="studentForm">

          <div class="form-grid">

            <div>
              <label>
                Student Name
              </label>

              <input
                id="studentName"
                required
                placeholder="Student name"
              >
            </div>


            <div>
              <label>
                Email
              </label>

              <input
                id="studentEmail"
                type="email"
                required
                placeholder="student@email.com"
              >
            </div>


            <div>
              <label>
                Password
              </label>

              <input
                id="studentPassword"
                type="password"
                minlength="6"
                required
                placeholder="Minimum 6 characters"
              >
            </div>


            <div>
              <label>
                Age
              </label>

              <input
                id="studentAge"
                type="number"
                min="1"
                max="100"
                placeholder="Student age"
              >
            </div>


            <div>
              <label>
                Class / Group
              </label>

              <input
                id="studentClass"
                placeholder="Example: CIT 1st Year"
              >
            </div>

          </div>


          <div class="modal-actions">

            <button
              type="submit"
            >
              Create Student
            </button>

            <button
              type="button"
              class="secondary"
              onclick="window.closeModal()"
            >
              Cancel
            </button>

          </div>

        </form>
      `
    );


    $("studentForm").onsubmit =
      createStudent;
  };


// ============================================================
// CREATE STUDENT THROUGH VERCEL API
// ============================================================

async function createStudent(e) {

  e.preventDefault();


  const name =
    $("studentName")
      ?.value.trim();

  const email =
    $("studentEmail")
      ?.value.trim();

  const password =
    $("studentPassword")
      ?.value;

  const studentClass =
    $("studentClass")
      ?.value.trim();

  const age =
    $("studentAge")?.value
      ? Number(
          $("studentAge").value
        )
      : null;


  if (
    !name ||
    !email ||
    !password
  ) {

    toast(
      "Please fill all required fields.",
      "error"
    );

    return;
  }


  if (
    password.length < 6
  ) {

    toast(
      "Password must be at least 6 characters.",
      "error"
    );

    return;
  }


  try {

    const currentUser =
      auth.currentUser;


    if (!currentUser) {

      toast(
        "Please login again.",
        "error"
      );

      return;
    }


    const idToken =
      await currentUser
        .getIdToken(true);


    const response =
      await fetch(
        "/api/create-user",
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${idToken}`

          },

          body:
            JSON.stringify({

              name,

              email,

              password,

              age,

              className:
                studentClass

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
        "Unable to create student."
      );
    }


    closeModal();


    await loadAllData();


    renderStudents();


    toast(
      "Student account created successfully."
    );


  } catch (error) {

    console.error(error);


    toast(
      error.message ||
      "Unable to create student.",
      "error"
    );

  }
}


// ============================================================
// TASKS
// ============================================================

function renderTasks() {

  const containers =
    document.querySelectorAll(
      "#tasksList, #taskList, [data-tasks-list]"
    );


  containers.forEach(container => {

    if (!state.tasks.length) {

      container.innerHTML =
        `<div class="empty-state">
          No tasks found.
        </div>`;

      return;
    }


    container.innerHTML =
      state.tasks.map(
        task => {

          const status =
            task.status ||
            "pending";


          return `
            <div class="task-card">

              <div>

                <h3>
                  ${escapeHtml(
                    task.title ||
                    task.name ||
                    "Task"
                  )}
                </h3>

                ${
                  task.description
                    ? `<p>
                        ${escapeHtml(
                          task.description
                        )}
                      </p>`
                    : ""
                }

                <span class="status">
                  ${escapeHtml(
                    status
                  )}
                </span>

              </div>


              <div class="task-actions">

                ${
                  state.profile?.role ===
                  "student" &&
                  status !==
                  "completed"
                    ? `
                      <button
                        onclick="window.acceptTask('${task.id}')"
                      >
                        ${
                          task.acceptedAt
                            ? "Complete"
                            : "Accept"
                        }
                      </button>
                    `
                    : ""
                }


                ${
                  state.profile?.role ===
                    "admin" ||
                  state.profile?.role ===
                    "superadmin"
                    ? `
                      <button
                        class="danger"
                        onclick="window.deleteTask('${task.id}')"
                      >
                        Delete
                      </button>
                    `
                    : ""
                }

              </div>

            </div>
          `;

        }
      ).join("");

  });
}


// ============================================================
// ADD TASK
// ============================================================

window.openAddTask =
  function() {

    if (
      state.profile?.role !==
        "admin" &&
      state.profile?.role !==
        "superadmin"
    ) {

      toast(
        "Only Admin can create tasks.",
        "error"
      );

      return;
    }


    const studentOptions =
      state.students.map(
        student =>
          `
          <option
            value="${student.id}"
          >
            ${escapeHtml(
              student.name
            )}
          </option>
          `
      ).join("");


    showModal(
      "Create Task",
      `
        <form id="taskForm">

          <div class="form-grid">

            <div>
              <label>
                Task Title
              </label>

              <input
                id="taskTitle"
                required
                placeholder="Task title"
              >
            </div>


            <div>
              <label>
                Student
              </label>

              <select
                id="taskStudent"
                required
              >
                <option value="">
                  Select Student
                </option>

                ${studentOptions}
              </select>
            </div>


            <div class="full">

              <label>
                Description
              </label>

              <textarea
                id="taskDescription"
                placeholder="Task description"
              ></textarea>

            </div>

          </div>


          <div class="modal-actions">

            <button type="submit">
              Create Task
            </button>

            <button
              type="button"
              class="secondary"
              onclick="window.closeModal()"
            >
              Cancel
            </button>

          </div>

        </form>
      `
    );


    $("taskForm").onsubmit =
      createTask;
  };


// ============================================================
// CREATE TASK
// ============================================================

async function createTask(e) {

  e.preventDefault();


  const title =
    $("taskTitle")
      ?.value.trim();

  const description =
    $("taskDescription")
      ?.value.trim();

  const studentId =
    $("taskStudent")
      ?.value;


  if (!title || !studentId) {

    toast(
      "Please fill all required fields.",
      "error"
    );

    return;
  }


  try {

    await addDoc(
      collection(
        db,
        "tasks"
      ),
      {

        title,

        description,

        studentId,

        adminId:
          state.user.uid,

        status:
          "pending",

        assignedAt:
          new Date().toISOString(),

        acceptedAt:
          null,

        completedAt:
          null,

        completionSeconds:
          null,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      }
    );


    closeModal();


    await loadAllData();


    toast(
      "Task created successfully."
    );


  } catch (error) {

    console.error(error);


    toast(
      getFirebaseError(error),
      "error"
    );

  }
}


// ============================================================
// ACCEPT / COMPLETE TASK
// ============================================================

window.acceptTask =
  async function(taskId) {

    const task =
      state.tasks.find(
        t =>
          t.id ===
          taskId
      );


    if (!task) return;


    try {

      const now =
        new Date();


      if (!task.acceptedAt) {

        await updateDoc(
          doc(
            db,
            "tasks",
            taskId
          ),
          {

            status:
              "accepted",

            acceptedAt:
              now.toISOString(),

            updatedAt:
              serverTimestamp()

          }
        );


        toast(
          "Task accepted."
        );


      } else {

        const acceptedTime =
          new Date(
            task.acceptedAt
          );


        const completionSeconds =
          Math.max(
            0,
            Math.floor(
              (
                now -
                acceptedTime
              ) / 1000
            )
          );


        await updateDoc(
          doc(
            db,
            "tasks",
            taskId
          ),
          {

            status:
              "completed",

            completedAt:
              now.toISOString(),

            completionSeconds,

            updatedAt:
              serverTimestamp()

          }
        );


        toast(
          "Task completed."
        );
      }


      await loadAllData();


    } catch (error) {

      console.error(error);


      toast(
        getFirebaseError(error),
        "error"
      );

    }
  };


// ============================================================
// DELETE TASK
// ============================================================

window.deleteTask =
  async function(taskId) {

    if (
      state.profile?.role !==
        "admin" &&
      state.profile?.role !==
        "superadmin"
    ) {

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
          taskId
        )
      );


      await loadAllData();


      toast(
        "Task deleted."
      );


    } catch (error) {

      console.error(error);


      toast(
        getFirebaseError(error),
        "error"
      );

    }
  };


// ============================================================
// ASSIGNMENTS
// ============================================================

function renderAssignments() {

  const containers =
    document.querySelectorAll(
      "#assignmentsList, #assignmentList, [data-assignments-list]"
    );


  containers.forEach(container => {

    if (
      !state.assignments.length
    ) {

      container.innerHTML =
        `<div class="empty-state">
          No assignments found.
        </div>`;

      return;
    }


    container.innerHTML =
      state.assignments.map(
        assignment => {

          return `
            <div class="assignment-card">

              <h3>
                ${escapeHtml(
                  assignment.title ||
                  "Assignment"
                )}
              </h3>

              ${
                assignment.description
                  ? `<p>
                      ${escapeHtml(
                        assignment.description
                      )}
                    </p>`
                  : ""
              }

              <p>
                Given:
                ${escapeHtml(
                  assignment.givenDate ||
                  "-"
                )}
              </p>

              ${
                assignment.deadline
                  ? `<p>
                      Deadline:
                      ${escapeHtml(
                        assignment.deadline
                      )}
                    </p>`
                  : ""
              }

              ${
                state.profile?.role ===
                "student"
                  ? `
                    <p>
                      Status:
                      ${
                        assignment.submitted
                          ? (
                              assignment.submittedLate
                                ? "Submitted Late"
                                : "Submitted"
                            )
                          : "Not Submitted"
                      }
                    </p>

                    ${
                      !assignment.submitted
                        ? `
                          <button
                            onclick="window.submitAssignment('${assignment.id}')"
                          >
                            Submit
                          </button>
                        `
                        : ""
                    }
                  `
                  : `
                    <p>
                      Marks:
                      ${
                        assignment.obtainedMarks ??
                        "-"
                      }
                      /
                      ${
                        assignment.totalMarks ??
                        "-"
                      }
                    </p>

                    <button
                      class="danger"
                      onclick="window.deleteAssignment('${assignment.id}')"
                    >
                      Delete
                    </button>
                  `
              }

            </div>
          `;

        }
      ).join("");

  });
}


// ============================================================
// ADD ASSIGNMENT
// ============================================================

window.openAddAssignment =
  function() {

    const studentOptions =
      state.students.map(
        student =>
          `
          <option
            value="${student.id}"
          >
            ${escapeHtml(
              student.name
            )}
          </option>
          `
      ).join("");


    showModal(
      "Create Assignment",
      `
        <form id="assignmentForm">

          <div class="form-grid">

            <div>
              <label>
                Assignment Title
              </label>

              <input
                id="assignmentTitle"
                required
                placeholder="Assignment title"
              >
            </div>


            <div>
              <label>
                Student
              </label>

              <select
                id="assignmentStudent"
                required
              >
                <option value="">
                  Select Student
                </option>

                ${studentOptions}
              </select>
            </div>


            <div>
              <label>
                Given Date
              </label>

              <input
                id="assignmentGivenDate"
                type="date"
                required
              >
            </div>


            <div>
              <label>
                Submission Deadline
              </label>

              <input
                id="assignmentDeadline"
                type="date"
              >
            </div>


            <div>
              <label>
                Total Marks
              </label>

              <input
                id="assignmentTotalMarks"
                type="number"
                min="0"
                placeholder="100"
              >
            </div>

          </div>


          <div class="modal-actions">

            <button type="submit">
              Create Assignment
            </button>

            <button
              type="button"
              class="secondary"
              onclick="window.closeModal()"
            >
              Cancel
            </button>

          </div>

        </form>
      `
    );


    $("assignmentForm").onsubmit =
      createAssignment;
  };


// ============================================================
// CREATE ASSIGNMENT
// ============================================================

async function createAssignment(e) {

  e.preventDefault();


  const title =
    $("assignmentTitle")
      ?.value.trim();

  const studentId =
    $("assignmentStudent")
      ?.value;

  const givenDate =
    $("assignmentGivenDate")
      ?.value;

  const deadline =
    $("assignmentDeadline")
      ?.value;

  const totalMarks =
    $("assignmentTotalMarks")
      ?.value;


  if (
    !title ||
    !studentId ||
    !givenDate
  ) {

    toast(
      "Please fill all required fields.",
      "error"
    );

    return;
  }


  try {

    await addDoc(
      collection(
        db,
        "assignments"
      ),
      {

        title,

        studentId,

        adminId:
          state.user.uid,

        givenDate,

        deadline:
          deadline || null,

        totalMarks:
          totalMarks
            ? Number(totalMarks)
            : null,

        obtainedMarks:
          null,

        submitted:
          false,

        submissionDate:
          null,

        submittedLate:
          false,

        createdAt:
          serverTimestamp()

      }
    );


    closeModal();


    await loadAllData();


    toast(
      "Assignment created successfully."
    );


  } catch (error) {

    console.error(error);


    toast(
      getFirebaseError(error),
      "error"
    );

  }
}


// ============================================================
// SUBMIT ASSIGNMENT
// ============================================================

window.submitAssignment =
  async function(assignmentId) {

    const assignment =
      state.assignments.find(
        a =>
          a.id ===
          assignmentId
      );


    if (!assignment) return;


    if (assignment.submitted) {

      toast(
        "Assignment already submitted.",
        "error"
      );

      return;
    }


    try {

      const now =
        new Date();


      const today =
        formatDateLocal(
          now
        );


      let late =
        false;


      if (
        assignment.deadline
      ) {

        late =
          today >
          assignment.deadline;

      }


      await updateDoc(
        doc(
          db,
          "assignments",
          assignmentId
        ),
        {

          submitted:
            true,

          submissionDate:
            today,

          submittedLate:
            late

        }
      );


      await loadAllData();


      toast(
        late
          ? "Assignment submitted late."
          : "Assignment submitted successfully."
      );


    } catch (error) {

      console.error(error);


      toast(
        getFirebaseError(error),
        "error"
      );

    }
  };


// ============================================================
// DELETE ASSIGNMENT
// ============================================================

window.deleteAssignment =
  async function(assignmentId) {

    if (
      state.profile?.role !==
        "admin" &&
      state.profile?.role !==
        "superadmin"
    ) {

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
          assignmentId
        )
      );


      await loadAllData();


      toast(
        "Assignment deleted."
      );


    } catch (error) {

      console.error(error);


      toast(
        getFirebaseError(error),
        "error"
      );

    }
  };


// ============================================================
// TESTS
// ============================================================

function renderTests() {

  const containers =
    document.querySelectorAll(
      "#testsList, #testList, [data-tests-list]"
    );


  containers.forEach(container => {

    if (!state.tests.length) {

      container.innerHTML =
        `<div class="empty-state">
          No tests found.
        </div>`;

      return;
    }


    container.innerHTML =
      state.tests.map(
        test => {

          const percentage =
            test.percentage ??
            (
              test.totalMarks &&
              test.obtainedMarks !== null
                ? Math.round(
                    (
                      test.obtainedMarks /
                      test.totalMarks
                    ) * 100
                  )
                : null
            );


          return `
            <div class="test-card">

              <h3>
                ${escapeHtml(
                  test.title ||
                  "Test"
                )}
              </h3>

              <p>
                Date:
                ${escapeHtml(
                  test.date ||
                  "-"
                )}
              </p>

              <p>
                Marks:
                ${
                  test.obtainedMarks ??
                  "-"
                }
                /
                ${
                  test.totalMarks ??
                  "-"
                }
              </p>

              ${
                percentage !== null
                  ? `<p>
                      Percentage:
                      ${percentage}%
                    </p>`
                  : ""
              }


              ${
                state.profile?.role !==
                "student"
                  ? `
                    <button
                      class="danger"
                      onclick="window.deleteTest('${test.id}')"
                    >
                      Delete
                    </button>
                  `
                  : ""
              }

            </div>
          `;

        }
      ).join("");

  });
}


// ============================================================
// ADD TEST
// ============================================================

window.openAddTest =
  function() {

    const studentOptions =
      state.students.map(
        student =>
          `
          <option
            value="${student.id}"
          >
            ${escapeHtml(
              student.name
            )}
          </option>
          `
      ).join("");


    showModal(
      "Create Test Result",
      `
        <form id="testForm">

          <div class="form-grid">

            <div>
              <label>
                Test Title
              </label>

              <input
                id="testTitle"
                required
                placeholder="Test name"
              >
            </div>


            <div>
              <label>
                Student
              </label>

              <select
                id="testStudent"
                required
              >
                <option value="">
                  Select Student
                </option>

                ${studentOptions}
              </select>
            </div>


            <div>
              <label>
                Test Date
              </label>

              <input
                id="testDate"
                type="date"
                required
              >
            </div>


            <div>
              <label>
                Total Marks
              </label>

              <input
                id="testTotalMarks"
                type="number"
                min="0"
                required
              >
            </div>


            <div>
              <label>
                Obtained Marks
              </label>

              <input
                id="testObtainedMarks"
                type="number"
                min="0"
                required
              >
            </div>

          </div>


          <div class="modal-actions">

            <button type="submit">
              Save Test
            </button>

            <button
              type="button"
              class="secondary"
              onclick="window.closeModal()"
            >
              Cancel
            </button>

          </div>

        </form>
      `
    );


    $("testForm").onsubmit =
      createTest;
  };


// ============================================================
// CREATE TEST
// ============================================================

async function createTest(e) {

  e.preventDefault();


  const title =
    $("testTitle")
      ?.value.trim();

  const studentId =
    $("testStudent")
      ?.value;

  const date =
    $("testDate")
      ?.value;

  const totalMarks =
    Number(
      $("testTotalMarks")
        ?.value
    );

  const obtainedMarks =
    Number(
      $("testObtainedMarks")
        ?.value
    );


  if (
    !title ||
    !studentId ||
    !date ||
    !Number.isFinite(totalMarks) ||
    !Number.isFinite(obtainedMarks)
  ) {

    toast(
      "Please fill all required fields.",
      "error"
    );

    return;
  }


  if (
    obtainedMarks >
    totalMarks
  ) {

    toast(
      "Obtained marks cannot exceed total marks.",
      "error"
    );

    return;
  }


  const percentage =
    totalMarks > 0
      ? Math.round(
          (
            obtainedMarks /
            totalMarks
          ) * 100
        )
      : 0;


  try {

    await addDoc(
      collection(
        db,
        "tests"
      ),
      {

        title,

        studentId,

        adminId:
          state.user.uid,

        date,

        totalMarks,

        obtainedMarks,

        percentage,

        createdAt:
          serverTimestamp()

      }
    );


    closeModal();


    await loadAllData();


    toast(
      "Test result saved successfully."
    );


  } catch (error) {

    console.error(error);


    toast(
      getFirebaseError(error),
      "error"
    );

  }
}


// ============================================================
// DELETE TEST
// ============================================================

window.deleteTest =
  async function(testId) {

    if (
      state.profile?.role !==
        "admin" &&
      state.profile?.role !==
        "superadmin"
    ) {

      return;
    }


    if (
      !confirm(
        "Delete this test?"
      )
    ) {

      return;
    }


    try {

      await deleteDoc(
        doc(
          db,
          "tests",
          testId
        )
      );


      await loadAllData();


      toast(
        "Test deleted."
      );


    } catch (error) {

      console.error(error);


      toast(
        getFirebaseError(error),
        "error"
      );

    }
  };


// ============================================================
// PROGRESS
// ============================================================

function renderProgress() {

  const containers =
    document.querySelectorAll(
      "#progressList, #studentProgressList, [data-progress-list]"
    );


  containers.forEach(container => {

    if (
      state.profile?.role ===
      "student"
    ) {

      container.innerHTML = "";

      return;
    }


    if (
      state.students.length ===
      0
    ) {

      container.innerHTML =
        `<div class="empty-state">
          No student progress available.
        </div>`;

      return;
    }


    container.innerHTML =
      state.students.map(
        student => {

          const tasks =
            state.tasks.filter(
              task =>
                task.studentId ===
                student.id
            );


          const assignments =
            state.assignments.filter(
              assignment =>
                assignment.studentId ===
                student.id
            );


          const tests =
            state.tests.filter(
              test =>
                test.studentId ===
                student.id
            );


          const completedTasks =
            tasks.filter(
              task =>
                task.status ===
                "completed"
            ).length;


          const submittedAssignments =
            assignments.filter(
              assignment =>
                assignment.submitted
            ).length;


          const taskProgress =
            tasks.length
              ? completedTasks /
                tasks.length
              : 0;


          const assignmentProgress =
            assignments.length
              ? submittedAssignments /
                assignments.length
              : 0;


          const overall =
            Math.round(
              (
                taskProgress +
                assignmentProgress
              ) /
              2 *
              100
            );


          return `
            <div class="progress-card">

              <h3>
                ${escapeHtml(
                  student.name ||
                  "Student"
                )}
              </h3>

              <div class="progress-bar">

                <span
                  style="
                    width:${overall}%;
                  "
                ></span>

              </div>

              <p>
                Overall Progress:
                <strong>
                  ${overall}%
                </strong>
              </p>

              <p>
                Tasks:
                ${completedTasks}
                /
                ${tasks.length}
              </p>

              <p>
                Assignments:
                ${submittedAssignments}
                /
                ${assignments.length}
              </p>

              <p>
                Tests:
                ${tests.length}
              </p>

            </div>
          `;

        }
      ).join("");

  });
}


// ============================================================
// SUPER ADMIN
// ============================================================

function renderAdmins() {

  const containers =
    document.querySelectorAll(
      "#adminsList, #adminList, [data-admins-list]"
    );


  containers.forEach(container => {

    if (
      state.profile?.role !==
      "superadmin"
    ) {

      container.innerHTML = "";

      return;
    }


    if (!state.admins.length) {

      container.innerHTML =
        `<div class="empty-state">
          No Admins found.
        </div>`;

      return;
    }


    container.innerHTML =
      state.admins.map(
        admin => {

          const students =
            state.students.filter(
              student =>
                student.adminId ===
                admin.id
            );


          const adminTasks =
            state.tasks.filter(
              task =>
                task.adminId ===
                admin.id
            );


          const completed =
            adminTasks.filter(
              task =>
                task.status ===
                "completed"
            ).length;


          const progress =
            adminTasks.length
              ? Math.round(
                  completed /
                  adminTasks.length *
                  100
                )
              : 0;


          return `
            <div class="admin-card">

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

              <p>
                Students:
                ${students.length}
              </p>

              <p>
                Task Progress:
                ${progress}%
              </p>

              <div class="progress-bar">

                <span
                  style="
                    width:${progress}%;
                  "
                ></span>

              </div>

            </div>
          `;

        }
      ).join("");

  });
}


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;


          showPage(page);


          document
            .querySelectorAll(
              "[data-page]"
            )
            .forEach(
              item =>
                item.classList.remove(
                  "active"
                )
            );


          button.classList.add(
            "active"
          );

        }
      );

    });
}

// ============================================================
// SIDEBAR MENU
// ============================================================

function setupMenu() {

  const menuBtn =
    $("menuBtn");

  const sidebar =
    $("sidebar");


  if (!menuBtn || !sidebar) {
    console.error(
      "Menu button or sidebar not found."
    );
    return;
  }


  // Open / Close menu

  menuBtn.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      sidebar.classList.toggle(
        "open"
      );

    }
  );


  // Menu ke bahar click karne par close

  document.addEventListener(
    "click",
    event => {

      if (
        !sidebar.classList.contains(
          "open"
        )
      ) {
        return;
      }


      if (
        !sidebar.contains(
          event.target
        ) &&
        event.target !== menuBtn
      ) {

        sidebar.classList.remove(
          "open"
        );

      }

    }
  );


  // Kisi menu item par click ke baad
  // mobile par sidebar close

  sidebar
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(item => {

      item.addEventListener(
        "click",
        () => {

          sidebar.classList.remove(
            "open"
          );

        }
      );

    });

}
function showPage(page) {

  state.currentPage = page;

  document
    .querySelectorAll("[data-page-section], .page")
    .forEach(section => {

      const sectionPage =
        section.dataset.pageSection ||
        section.id.replace("page-", "");

      if (sectionPage === page) {

        section.classList.remove("hidden");
        section.style.display = "";

      } else {

        section.classList.add("hidden");
        section.style.display = "none";

      }

    });

  document
    .querySelectorAll("[data-page]")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === page
      );

    });

}

// ============================================================
// MODAL
// ============================================================

function showModal(
  title,
  content
) {

  let modal =
    $("appModal");


  if (!modal) {

    modal =
      document.createElement(
        "div"
      );

    modal.id =
      "appModal";

    modal.className =
      "modal";

    document.body.appendChild(
      modal
    );
  }


  modal.innerHTML = `
    <div class="modal-overlay">

      <div class="modal-box">

        <div class="modal-header">

          <h2>
            ${escapeHtml(title)}
          </h2>

          <button
            type="button"
            class="modal-close"
            id="modalCloseBtn"
          >
            ×
          </button>

        </div>

        <div class="modal-body">

          ${content}

        </div>

      </div>

    </div>
  `;


  modal.style.display =
    "flex";


  $("modalCloseBtn")
    ?.addEventListener(
      "click",
      closeModal
    );


  modal
    .querySelector(
      ".modal-overlay"
    )
    ?.addEventListener(
      "click",
      e => {

        if (
          e.target.classList.contains(
            "modal-overlay"
          )
        ) {

          closeModal();

        }

      }
    );
}


function closeModal() {

  const modal =
    $("appModal");


  if (modal) {

    modal.style.display =
      "none";

  }
}


window.closeModal =
  closeModal;


// ============================================================
// HELPER FUNCTIONS
// ============================================================

function setText(
  ids,
  value
) {

  ids.forEach(id => {

    const element =
      $(id);


    if (element) {

      element.textContent =
        value;

    }

  });
}


function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function formatDateLocal(
  date
) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      state.user =
        null;

      state.profile =
        null;

      showAuth();

      return;
    }


    try {

      const profileRef =
        doc(
          db,
          "users",
          user.uid
        );


      const profileSnap =
        await getDoc(
          profileRef
        );


      if (
        !profileSnap.exists()
      ) {

        await signOut(auth);


        toast(
          "Your account profile is missing.",
          "error"
        );


        return;
      }


      state.user =
        user;


      state.profile = {

        id:
          profileSnap.id,

        ...profileSnap.data()

      };


      if (
        state.profile.active ===
        false
      ) {

        await signOut(auth);


        toast(
          "Your account has been disabled.",
          "error"
        );


        return;
      }


      showApp();


      await loadAllData();


      showPage(
        state.profile.role ===
          "student"
          ? "dashboard"
          : "dashboard"
      );


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
// GLOBAL INITIALIZATION
// ============================================================
document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupAuthTabs();

    setupLogin();

    setupAdminRegistration();

    setupLogout();

    setupNavigation();

    setupMenu();

  }
);
