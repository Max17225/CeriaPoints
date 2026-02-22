import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCQOIWX9xisGhtxC14dTJWuss75B50rs-Y",
  authDomain: "ceriapoints.firebaseapp.com",
  projectId: "ceriapoints",
  storageBucket: "ceriapoints.firebasestorage.app",
  messagingSenderId: "585629666042",
  appId: "1:585629666042:web:93d8abaeeea976c7d81743",
  measurementId: "G-3DYD55NMP6",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// App State
const pointRates = { plastic: 100, cardboard: 50, aluminum: 200 };
let activeUserData = null;
let weigherTargetUser = null;
let cachedUsers = [];

// --- CUSTOM UI ALERT (TOAST) ---
window.showToast = function (message, type = "success") {
  const toast = document.getElementById("customToast");
  toast.innerText = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.className = toast.className.replace("show", "");
  }, 3500);
};

function getFriendlyErrorMessage(errorCode) {
  switch (errorCode) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again.";
    case "auth/email-already-in-use":
      return "This email is already registered. Try logging in instead.";
    case "auth/weak-password":
      return "Your password is too weak. Please use at least 6 characters.";
    case "auth/requires-recent-login":
      return "For security, please log out and log back in to change this.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

// --- AUTHENTICATION LOGIC ---
window.toggleAuthView = function (view) {
  document.getElementById("loginForm").style.display =
    view === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display =
    view === "register" ? "block" : "none";
  document.getElementById("forgotForm").style.display =
    view === "forgot" ? "block" : "none";
};

window.registerUser = async function () {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  if (!name || !email || !password)
    return showToast("Please fill in all registration fields.", "error");

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: email,
      role: "user",
      points: 0,
      totalPlastic: 0,
      totalCardboard: 0,
      totalAluminum: 0,
      profilePic: "",
    });

    showToast("Account created successfully! Please log in.", "success");
    toggleAuthView("login");
  } catch (error) {
    showToast(getFriendlyErrorMessage(error.code), "error");
  }
};

window.loginUser = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password)
    return showToast("Please enter email and password.", "error");

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
      activeUserData = userDoc.data();
      activeUserData.uid = user.uid;
      loadDashboard(activeUserData);
      showToast(`Welcome back, ${activeUserData.name}!`, "success");
    } else {
      showToast("Database profile missing.", "error");
    }
  } catch (error) {
    showToast(getFriendlyErrorMessage(error.code), "error");
  }
};

window.resetPassword = async function () {
  const email = document.getElementById("resetEmail").value.trim();
  if (!email)
    return showToast("Please enter your email address first.", "error");

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("If an account exists, a reset link has been sent.", "success");
    toggleAuthView("login");
  } catch (error) {
    showToast(getFriendlyErrorMessage(error.code), "error");
  }
};

window.logoutUser = function () {
  signOut(auth).then(() => {
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("authContainer").style.display = "flex";
    document.getElementById("navUser").style.display = "none";
    document.getElementById("navWeigher").style.display = "none";
    document.getElementById("navAdmin").style.display = "none";
    document.getElementById("navProfile").style.display = "none";
    activeUserData = null;
    showToast("Logged out successfully.", "success");
  });
};

// --- APP ROUTING & DASHBOARD ---
function loadDashboard(userData) {
  document.getElementById("authContainer").style.display = "none";
  document.getElementById("appContainer").style.display = "block";

  // Hide buttons initially
  document.getElementById("navProfile").style.display = "none";

  const defaultAvatar = `https://ui-avatars.com/api/?name=${userData.name}&background=fada67&color=3c78d8`;
  document.getElementById("currentAvatar").src =
    userData.profilePic || defaultAvatar;

  // NEW: Set the user's name in the profile section
  document.getElementById("profileName").innerText = userData.name;

  if (userData.role === "user") {
    document.getElementById("navUser").style.display = "inline-block";
    document.getElementById("navProfile").style.display = "inline-block";
    switchRole("userPage");
  } else if (userData.role === "weigher") {
    document.getElementById("navWeigher").style.display = "inline-block";
    switchRole("weigherPage");
  } else if (userData.role === "admin") {
    document.getElementById("navUser").style.display = "inline-block";
    document.getElementById("navWeigher").style.display = "inline-block";
    document.getElementById("navAdmin").style.display = "inline-block";
    switchRole("adminPage");
  }
}

window.switchRole = function (roleId) {
  // Hide all pages
  document.getElementById("userPage").style.display = "none";
  document.getElementById("weigherPage").style.display = "none";
  document.getElementById("adminPage").style.display = "none";
  document.getElementById("profilePage").style.display = "none";

  // Show target page
  document.getElementById(roleId).style.display = "block";

  // Navigation Highlight Logic (Turns active button yellow)
  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const navId =
    "nav" +
    roleId.replace("Page", "").charAt(0).toUpperCase() +
    roleId.replace("Page", "").slice(1);
  if (document.getElementById(navId)) {
    document.getElementById(navId).classList.add("active");
  }

  // Page-specific logic
  if (roleId === "userPage") {
    document.getElementById("displayUserName").innerText = activeUserData.name;
    document.getElementById("userPointsDisplay").innerText =
      activeUserData.points || 0;
    calculateEnvironmentalImpact(activeUserData);
    fetchLeaderboard();
  }

  if (roleId === "weigherPage") {
    fetchUsersForSearch();
  }
};

// --- PROFILE SETTINGS ---
window.uploadProfilePicture = function () {
  const fileInput = document.getElementById("avatarUpload");
  const file = fileInput.files[0];

  if (!file) return showToast("Please select an image file first.", "error");

  const reader = new FileReader();
  reader.onloadend = async function () {
    const base64String = reader.result;
    try {
      await updateDoc(doc(db, "users", activeUserData.uid), {
        profilePic: base64String,
      });
      document.getElementById("currentAvatar").src = base64String;
      activeUserData.profilePic = base64String;
      showToast("Profile picture updated successfully!", "success");
      fileInput.value = "";
    } catch (error) {
      console.error(error);
      showToast("Error saving picture to database.", "error");
    }
  };
  reader.readAsDataURL(file);
};

window.updateUserEmail = async function () {
  const newEmail = document.getElementById("updateEmail").value.trim();
  if (!newEmail) return showToast("Enter a valid email.", "error");

  try {
    await updateEmail(auth.currentUser, newEmail);
    await updateDoc(doc(db, "users", activeUserData.uid), { email: newEmail });
    showToast("Email updated successfully!", "success");
    document.getElementById("updateEmail").value = "";
  } catch (error) {
    showToast(getFriendlyErrorMessage(error.code), "error");
  }
};

window.updateUserPassword = async function () {
  const newPassword = document.getElementById("updatePassword").value;
  if (!newPassword || newPassword.length < 6)
    return showToast("Password must be at least 6 characters.", "error");

  try {
    await updatePassword(auth.currentUser, newPassword);
    showToast("Password updated successfully!", "success");
    document.getElementById("updatePassword").value = "";
  } catch (error) {
    showToast(getFriendlyErrorMessage(error.code), "error");
  }
};

// --- LEADERBOARD LOGIC ---
async function fetchLeaderboard() {
  const leaderboardList = document.getElementById("leaderboardList");
  leaderboardList.innerHTML =
    '<p style="text-align: center; color: var(--text-muted);">Fetching scores...</p>';

  try {
    const q = query(
      collection(db, "users"),
      orderBy("points", "desc"),
      limit(5),
    );
    const querySnapshot = await getDocs(q);

    let html = "";
    let rank = 1;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.role === "user" && data.points > 0) {
        const avatarSrc =
          data.profilePic ||
          `https://ui-avatars.com/api/?name=${data.name}&background=e2e8f0&color=64748b`;

        html += `
          <div class="leaderboard-item">
            <span class="rank">#${rank}</span>
            <img src="${avatarSrc}" class="leaderboard-avatar" alt="${data.name}">
            <span class="name">${data.name}</span>
            <span class="score">${data.points} pts</span>
          </div>`;
        rank++;
      }
    });

    leaderboardList.innerHTML =
      html === ""
        ? '<p style="text-align: center; color: var(--text-muted);">No points awarded yet. Be the first!</p>'
        : html;
  } catch (error) {
    console.error("Leaderboard Error:", error);
    leaderboardList.innerHTML =
      '<p style="text-align: center; color: var(--error-color);">Failed to load leaderboard.</p>';
  }
}

function calculateEnvironmentalImpact(userData) {
  const card = userData.totalCardboard || 0;
  const plas = userData.totalPlastic || 0;
  const alum = userData.totalAluminum || 0;

  document.getElementById("treesSaved").innerText = (card * 0.017).toFixed(1);
  document.getElementById("co2Saved").innerText = (plas * 1.5).toFixed(1);
  document.getElementById("energySaved").innerText = (alum * 14.0).toFixed(1);
}

// --- WEIGHER TERMINAL (LIVE SEARCH LOGIC) ---
async function fetchUsersForSearch() {
  try {
    const q = query(collection(db, "users"));
    const snap = await getDocs(q);
    cachedUsers = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.role === "user") {
        cachedUsers.push({
          uid: doc.id,
          name: data.name,
          points: data.points || 0,
        });
      }
    });
  } catch (e) {
    console.error("Could not fetch users for search.", e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("liveSearchInput");
  const dropdown = document.getElementById("searchResultsDropdown");

  if (searchInput && dropdown) {
    searchInput.addEventListener("input", function (e) {
      const val = e.target.value.toLowerCase();
      dropdown.innerHTML = "";

      if (!val) {
        dropdown.style.display = "none";
        return;
      }

      const matches = cachedUsers.filter((user) =>
        user.name.toLowerCase().includes(val),
      );

      if (matches.length > 0) {
        dropdown.style.display = "block";
        matches.forEach((match) => {
          const div = document.createElement("div");
          div.className = "dropdown-item";
          div.innerText = `${match.name} (ID: ${match.uid.substring(0, 5)}...)`;
          div.onclick = function () {
            selectUserForWeighIn(match);
            dropdown.style.display = "none";
            searchInput.value = match.name;
          };
          dropdown.appendChild(div);
        });
      } else {
        dropdown.style.display = "none";
      }
    });

    document.addEventListener("click", function (e) {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = "none";
      }
    });
  }
});

function selectUserForWeighIn(userMatch) {
  weigherTargetUser = userMatch;
  const resultText = document.getElementById("searchResult");
  const weighForm = document.getElementById("weighingForm");

  resultText.innerText = `Selected: ${userMatch.name} (Current Points: ${userMatch.points})`;
  resultText.style.color = "var(--success-color)";
  weighForm.style.display = "block";
}

window.processWeighIn = async function () {
  const material = document.getElementById("materialSelect").value;
  const weight = parseFloat(document.getElementById("weightInput").value);

  if (!weigherTargetUser)
    return showToast("Please select a user first.", "error");
  if (isNaN(weight) || weight <= 0)
    return showToast("Please enter a valid weight!", "error");

  const pointsEarned = weight * pointRates[material];

  try {
    const userRef = doc(db, "users", weigherTargetUser.uid);
    const freshUserDoc = await getDoc(userRef);
    const freshData = freshUserDoc.data();

    const newTotalPoints = (freshData.points || 0) + pointsEarned;

    let dbField = "";
    if (material === "cardboard") dbField = "totalCardboard";
    else if (material === "plastic") dbField = "totalPlastic";
    else if (material === "aluminum") dbField = "totalAluminum";

    const newMaterialWeight = (freshData[dbField] || 0) + weight;

    await updateDoc(userRef, {
      points: newTotalPoints,
      [dbField]: newMaterialWeight,
    });

    showToast(
      `Success! Awarded ${pointsEarned} pts to ${weigherTargetUser.name}.`,
      "success",
    );

    document.getElementById("weightInput").value = "";
    document.getElementById("weighingForm").style.display = "none";
    document.getElementById("searchResult").innerText =
      "Ready for next weigh-in.";
    document.getElementById("liveSearchInput").value = "";
    weigherTargetUser = null;

    fetchUsersForSearch();
  } catch (error) {
    console.error("Error updating database: ", error);
    showToast("Error saving data. Please try again.", "error");
  }
};
