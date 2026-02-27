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
  getDocs,
  addDoc,
  deleteDoc,
  limit,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// Highly Scalable Object Structure for Rates & Math
let pointRates = {
  plastic: { rate: 100, impactType: "co2", multiplier: 1.5 },
  cardboard: { rate: 50, impactType: "trees", multiplier: 0.017 },
  aluminum: { rate: 200, impactType: "energy", multiplier: 14.0 },
};

let activeUserData = null;
let weigherTargetUser = null;
let cachedUsers = [];
let isRegistering = false;
let pendingUndoData = null; // Stores data for the custom modal

// --- TOAST & ERRORS ---
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
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

// --- AUTHENTICATION ---
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

  isRegistering = true;

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

    await signOut(auth);
    isRegistering = false;

    document.getElementById("regName").value = "";
    document.getElementById("regEmail").value = "";
    document.getElementById("regPassword").value = "";

    showToast("Account created successfully! Please log in.", "success");
    toggleAuthView("login");
  } catch (error) {
    isRegistering = false;
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
      await fetchAdminRates();
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
  document.getElementById("logoutModal").style.display = "flex";
};

window.closeLogoutModal = function () {
  document.getElementById("logoutModal").style.display = "none";
};

window.confirmLogout = function () {
  document.getElementById("logoutModal").style.display = "none";
  signOut(auth).then(() => {
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("authContainer").style.display = "flex";
    document.getElementById("navUser").style.display = "none";
    document.getElementById("navWeigher").style.display = "none";
    document.getElementById("navAdmin").style.display = "none";
    document.getElementById("navProfile").style.display = "none";
    document.getElementById("navHistory").style.display = "none";

    const exportBtn = document.getElementById("exportLeaderboardBtn");
    if (exportBtn) exportBtn.style.display = "none";

    activeUserData = null;
    showToast("Logged out successfully.", "success");
  });
};

// AUTO-LOGIN PERSISTENCE
onAuthStateChanged(auth, async (user) => {
  if (isRegistering) return;

  if (user) {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        activeUserData = userDoc.data();
        activeUserData.uid = user.uid;
        await fetchAdminRates();
        loadDashboard(activeUserData);

        document.getElementById("initialLoader").style.display = "none";
      }
    } catch (error) {
      console.error("Error fetching user session:", error);
      document.getElementById("initialLoader").style.display = "none";
      document.getElementById("authContainer").style.display = "flex";
    }
  } else {
    document.getElementById("initialLoader").style.display = "none";
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("authContainer").style.display = "flex";
  }
});

// --- REVEAL PASSWORD LOGIC ---
window.togglePassword = function (inputId, btnElement) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btnElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
  } else {
    input.type = "password";
    btnElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  }
};

// --- APP ROUTING & DASHBOARD ---
function loadDashboard(userData) {
  document.getElementById("authContainer").style.display = "none";
  document.getElementById("appContainer").style.display = "block";
  document.getElementById("navProfile").style.display = "none";

  const defaultAvatar = `https://ui-avatars.com/api/?name=${userData.name}&background=fada67&color=3c78d8`;
  document.getElementById("currentAvatar").src =
    userData.profilePic || defaultAvatar;
  document.getElementById("profileName").innerText = userData.name;

  document.getElementById("currentEmailDisplay").value = userData.email;

  if (userData.role === "user") {
    document.getElementById("navUser").style.display = "inline-block";
    document.getElementById("navProfile").style.display = "inline-block";
    switchRole("userPage");
  } else if (userData.role === "weigher") {
    document.getElementById("navUser").style.display = "inline-block";
    document.getElementById("navUser").innerText = "Leaderboard";
    document.getElementById("navWeigher").style.display = "inline-block";
    document.getElementById("navHistory").style.display = "inline-block";
    if (document.getElementById("exportLeaderboardBtn"))
      document.getElementById("exportLeaderboardBtn").style.display =
        "inline-flex";
    switchRole("weigherPage");
  } else if (userData.role === "admin") {
    document.getElementById("navUser").style.display = "inline-block";
    document.getElementById("navUser").innerText = "Leaderboard";
    document.getElementById("navWeigher").style.display = "inline-block";
    document.getElementById("navHistory").style.display = "inline-block"; // ALLOWS ADMIN TO SEE HISTORY
    document.getElementById("navAdmin").style.display = "inline-block";
    if (document.getElementById("exportLeaderboardBtn"))
      document.getElementById("exportLeaderboardBtn").style.display =
        "inline-flex";
    switchRole("adminPage");
  }
}

window.switchRole = function (roleId) {
  document.getElementById("userPage").style.display = "none";
  document.getElementById("weigherPage").style.display = "none";
  document.getElementById("adminPage").style.display = "none";
  document.getElementById("profilePage").style.display = "none";
  document.getElementById("historyPage").style.display = "none";

  document.getElementById(roleId).style.display = "block";

  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const navId =
    "nav" +
    roleId.replace("Page", "").charAt(0).toUpperCase() +
    roleId.replace("Page", "").slice(1);
  if (document.getElementById(navId))
    document.getElementById(navId).classList.add("active");

  if (roleId === "userPage") {
    document.getElementById("displayUserName").innerText = activeUserData.name;
    document.getElementById("userPointsDisplay").innerText =
      activeUserData.points || 0;
    calculateEnvironmentalImpact(activeUserData);
    fetchLeaderboard();

    // HIDE PERSONAL SECTIONS FOR WEIGHER & ADMIN
    const personalCard = document.getElementById("personalPointsCard");
    const personalTitle = document.getElementById("personalImpactTitle");
    const personalGrid = document.getElementById("personalImpactGrid");

    if (activeUserData.role === "weigher" || activeUserData.role === "admin") {
      if (personalCard) personalCard.style.display = "none";
      if (personalTitle) personalTitle.style.display = "none";
      if (personalGrid) personalGrid.style.display = "none";
    } else {
      if (personalCard) personalCard.style.display = "";
      if (personalTitle) personalTitle.style.display = "";
      if (personalGrid) personalGrid.style.display = "";
    }
  }

  if (roleId === "weigherPage") fetchUsersForSearch();
  if (roleId === "adminPage") renderAdminRates();
  if (roleId === "historyPage") fetchTransactionHistory();
};

// --- SCALABLE ADMIN PANEL ---
async function fetchAdminRates() {
  try {
    const docRef = doc(db, "settings", "rates");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (typeof data.plastic === "number") {
        await setDoc(docRef, pointRates);
      } else {
        pointRates = data;
      }
    } else {
      await setDoc(docRef, pointRates);
    }
    updateMaterialDropdowns();
  } catch (error) {
    console.error("Could not fetch custom rates", error);
  }
}

function updateMaterialDropdowns() {
  const select = document.getElementById("materialSelect");
  if (select) {
    select.innerHTML = "";

    select.innerHTML =
      '<option value="" disabled selected>Select Material...</option>';

    for (const [material, data] of Object.entries(pointRates)) {
      const opt = document.createElement("option");
      opt.value = material;
      opt.innerText = `${material.charAt(0).toUpperCase() + material.slice(1)} (${data.rate} pts/kg)`;
      select.appendChild(opt);
    }
  }
}

window.renderAdminRates = function () {
  const container = document.getElementById("adminRatesList");
  container.innerHTML = "";
  for (const [material, data] of Object.entries(pointRates)) {
    const row = document.createElement("div");
    row.className = "admin-rate-row";

    row.innerHTML = `
      <input type="text" value="${material.charAt(0).toUpperCase() + material.slice(1)}" disabled style="min-width: 80px;">
      <div class="rate-inputs" style="flex-wrap: wrap;">
        <span style="font-size:0.85em; color:var(--text-muted);">Rate:</span>
        <input type="number" id="rate_${material}" value="${data.rate}" min="1" style="width: 70px;">
        <span style="font-size:0.85em; color:var(--text-muted); margin-left:5px;">Mult:</span>
        <input type="number" id="mult_${material}" value="${data.multiplier}" step="0.001" min="0" style="width: 75px;">
        <select id="impact_${material}" style="width: auto; padding: 8px; border: 1px solid var(--border-color); border-radius: 8px;">
            <option value="trees" ${data.impactType === "trees" ? "selected" : ""}>Trees</option>
            <option value="co2" ${data.impactType === "co2" ? "selected" : ""}>CO2</option>
            <option value="energy" ${data.impactType === "energy" ? "selected" : ""}>Energy</option>
        </select>
      </div>
      <button class="outline-btn small-btn" style="margin: 0;" onclick="updateExistingRate('${material}')">Save</button>
    `;
    container.appendChild(row);
  }
};

window.updateExistingRate = async function (material) {
  const newRate = parseInt(document.getElementById(`rate_${material}`).value);
  const newMult = parseFloat(document.getElementById(`mult_${material}`).value);
  const newImpact = document.getElementById(`impact_${material}`).value;

  if (isNaN(newRate) || newRate <= 0)
    return showToast("Rate must be at least 1.", "error");
  if (isNaN(newMult) || newMult < 0)
    return showToast("Multiplier cannot be negative.", "error");

  pointRates[material].rate = newRate;
  pointRates[material].multiplier = newMult;
  pointRates[material].impactType = newImpact;

  try {
    await setDoc(doc(db, "settings", "rates"), pointRates);
    showToast(`${material} updated successfully!`, "success");
    updateMaterialDropdowns();
  } catch (e) {
    showToast("Failed to save to database.", "error");
  }
};

window.addNewMaterial = async function () {
  const name = document
    .getElementById("newMaterialName")
    .value.trim()
    .toLowerCase();
  const rate = parseInt(document.getElementById("newMaterialRate").value);
  const impact = document.getElementById("newMaterialImpact").value;
  const mult = parseFloat(
    document.getElementById("newMaterialMultiplier").value,
  );

  if (!name) return showToast("Please enter a material name.", "error");
  if (isNaN(rate) || rate <= 0)
    return showToast("Points must be at least 1.", "error");
  if (!impact) return showToast("Please select an impact category.", "error");
  if (isNaN(mult) || mult < 0)
    return showToast("Multiplier must be a valid number.", "error");

  pointRates[name] = { rate: rate, impactType: impact, multiplier: mult };
  try {
    await setDoc(doc(db, "settings", "rates"), pointRates);
    showToast(`${name} added successfully!`, "success");
    document.getElementById("newMaterialName").value = "";
    document.getElementById("newMaterialRate").value = "";
    document.getElementById("newMaterialImpact").value = "";
    document.getElementById("newMaterialMultiplier").value = "";
    renderAdminRates();
    updateMaterialDropdowns();
  } catch (e) {
    showToast("Failed to save material.", "error");
  }
};

// --- PROFILE SETTINGS ---
window.uploadProfilePicture = function () {
  const fileInput = document.getElementById("avatarUpload");
  const file = fileInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please select a valid image file.", "error");
    fileInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();

    img.onerror = function () {
      showToast("Could not read this specific photo format.", "error");
      fileInput.value = "";
    };

    img.onload = async function () {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 300;
      const MAX_HEIGHT = 300;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

      try {
        await updateDoc(doc(db, "users", activeUserData.uid), {
          profilePic: compressedBase64,
        });
        document.getElementById("currentAvatar").src = compressedBase64;
        activeUserData.profilePic = compressedBase64;
        showToast("Profile picture updated successfully!", "success");
        fileInput.value = "";
      } catch (error) {
        showToast("DB ERROR: " + error.message, "error");
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

window.updateUserEmail = async function () {
  const currentPassword = document.getElementById("emailCurrentPassword").value;
  const newEmail = document.getElementById("newEmailInput").value.trim();

  if (!currentPassword)
    return showToast("Please enter your current password.", "error");
  if (!newEmail) return showToast("Enter a valid email.", "error");

  try {
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword,
    );
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updateEmail(auth.currentUser, newEmail);
    await updateDoc(doc(db, "users", activeUserData.uid), { email: newEmail });

    showToast("Email updated successfully!", "success");
    document.getElementById("emailCurrentPassword").value = "";
    document.getElementById("newEmailInput").value = "";
    document.getElementById("currentEmailDisplay").value = newEmail;
    activeUserData.email = newEmail;
  } catch (error) {
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password"
    )
      showToast("Your current password is incorrect.", "error");
    else if (error.code === "auth/email-already-in-use")
      showToast("This email is already registered to someone else.", "error");
    else showToast(getFriendlyErrorMessage(error.code), "error");
  }
};

window.updateUserPassword = async function () {
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPasswordInput").value;

  if (!currentPassword)
    return showToast("Please enter your current password.", "error");
  if (!newPassword || newPassword.length < 6)
    return showToast("New password must be at least 6 characters.", "error");

  try {
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword,
    );
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);

    showToast("Password updated successfully!", "success");
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPasswordInput").value = "";
  } catch (error) {
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password"
    )
      showToast("Your current password is incorrect.", "error");
    else showToast(getFriendlyErrorMessage(error.code), "error");
  }
};

// --- LEADERBOARD & IMPACT MATH ---
window.fetchLeaderboard = async function () {
  const leaderboardList = document.getElementById("leaderboardList");
  const filterDropdown = document.getElementById("leaderboardFilter");
  const filterMode = filterDropdown ? filterDropdown.value : "monthly";

  leaderboardList.innerHTML =
    '<p style="text-align: center; color: var(--text-muted);">Fetching scores...</p>';

  const date = new Date();
  const currentMonthStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

  try {
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);

    let usersArray = [];
    let globalTrees = 0;
    let globalCO2 = 0;
    let globalEnergy = 0;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.role === "user") {
        let monthlyPts =
          data.lastMonthUpdated === currentMonthStr
            ? data.currentMonthPoints || 0
            : 0;
        let yearlyPts = data.points || 0;
        let displayScore = filterMode === "monthly" ? monthlyPts : yearlyPts;

        usersArray.push({
          name: data.name,
          profilePic: data.profilePic,
          score: displayScore,
        });

        for (const [material, config] of Object.entries(pointRates)) {
          const safeMaterial = material.replace(/[^a-zA-Z0-9]/g, "");
          const dbField =
            "total" +
            safeMaterial.charAt(0).toUpperCase() +
            safeMaterial.slice(1);
          const userWeight = data[dbField] || 0;

          if (config.impactType === "trees")
            globalTrees += userWeight * config.multiplier;
          if (config.impactType === "co2")
            globalCO2 += userWeight * config.multiplier;
          if (config.impactType === "energy")
            globalEnergy += userWeight * config.multiplier;
        }
      }
    });

    const gTreesEl = document.getElementById("globalTreesSaved");
    const gCo2El = document.getElementById("globalCo2Saved");
    const gEnergyEl = document.getElementById("globalEnergySaved");
    if (gTreesEl) gTreesEl.innerText = globalTrees.toFixed(1);
    if (gCo2El) gCo2El.innerText = globalCO2.toFixed(1);
    if (gEnergyEl) gEnergyEl.innerText = globalEnergy.toFixed(1);

    usersArray.sort((a, b) => b.score - a.score);

    let html = "";
    let rank = 1;

    for (let i = 0; i < usersArray.length; i++) {
      const user = usersArray[i];

      if (user.score <= 0) continue;

      const avatarSrc =
        user.profilePic ||
        `https://ui-avatars.com/api/?name=${user.name}&background=e2e8f0&color=64748b`;
      html += `<div class="leaderboard-item">
                  <span class="rank">#${rank}</span>
                  <img src="${avatarSrc}" class="leaderboard-avatar" alt="${user.name}">
                  <span class="name">${user.name}</span>
                  <span class="score">${user.score} pts</span>
                </div>`;
      rank++;
    }

    if (html === "") {
      html = `<p style="text-align: center; color: var(--text-muted); margin-top: 15px;">No points recorded for this period yet.</p>`;
    }

    leaderboardList.innerHTML = html;
  } catch (error) {
    console.error(error);
    leaderboardList.innerHTML =
      '<p style="text-align: center; color: var(--error-color);">Failed to load leaderboard.</p>';
  }
};

window.exportLeaderboardCSV = async function () {
  const filterDropdown = document.getElementById("leaderboardFilter");
  const filterMode = filterDropdown ? filterDropdown.value : "monthly";

  showToast("Preparing export...", "info");

  const d = new Date();
  const currentMonthStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;

  const dateString = `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getFullYear()}`;

  try {
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);

    let exportData = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.role === "user") {
        let monthlyPts =
          data.lastMonthUpdated === currentMonthStr
            ? data.currentMonthPoints || 0
            : 0;
        let yearlyPts = data.points || 0;
        let displayScore = filterMode === "monthly" ? monthlyPts : yearlyPts;

        if (displayScore > 0) {
          exportData.push({
            name: data.name,
            score: displayScore,
          });
        }
      }
    });

    exportData.sort((a, b) => b.score - a.score);

    let periodLabel =
      filterMode === "monthly"
        ? "This Month's Total Points"
        : "This Year's Total Points";
    let csvContent = `Report Generated On:,${dateString}\n\nRank,Student Name,${periodLabel}\n`;

    let rank = 1;
    exportData.forEach((user) => {
      csvContent += `${rank},"${user.name}",${user.score}\n`;
      rank++;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `CeriaPoints_${filterMode}_Leaderboard_${dateString}.csv`,
    );
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Download started!", "success");
  } catch (error) {
    console.error("Export Error: ", error);
    showToast("Failed to generate export file.", "error");
  }
};

function calculateEnvironmentalImpact(userData) {
  let totalTrees = 0;
  let totalCO2 = 0;
  let totalEnergy = 0;

  for (const [material, config] of Object.entries(pointRates)) {
    const safeMaterial = material.replace(/[^a-zA-Z0-9]/g, "");
    const dbField =
      "total" + safeMaterial.charAt(0).toUpperCase() + safeMaterial.slice(1);

    const userWeight = userData[dbField] || 0;

    if (config.impactType === "trees")
      totalTrees += userWeight * config.multiplier;
    if (config.impactType === "co2") totalCO2 += userWeight * config.multiplier;
    if (config.impactType === "energy")
      totalEnergy += userWeight * config.multiplier;
  }

  document.getElementById("treesSaved").innerText = totalTrees.toFixed(1);
  document.getElementById("co2Saved").innerText = totalCO2.toFixed(1);
  document.getElementById("energySaved").innerText = totalEnergy.toFixed(1);
}

// --- WEIGHER TERMINAL ---
async function fetchUsersForSearch() {
  try {
    const q = query(collection(db, "users"));
    const snap = await getDocs(q);
    cachedUsers = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.role === "user")
        cachedUsers.push({
          uid: doc.id,
          name: data.name,
          points: data.points || 0,
        });
    });
  } catch (e) {
    console.error("Could not fetch users.", e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("liveSearchInput");
  const dropdown = document.getElementById("searchResultsDropdown");
  const weightInput = document.getElementById("weightInput");

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
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target))
        dropdown.style.display = "none";
    });
  }

  if (weightInput) {
    weightInput.addEventListener("blur", function (e) {
      let safeVal = this.value.replace(",", ".");
      if (safeVal && !isNaN(safeVal)) {
        this.value = parseFloat(safeVal).toFixed(3);
      }
    });
  }
});

window.clearWeigherSelection = function () {
  weigherTargetUser = null;
  document.getElementById("searchResult").innerHTML = "";
  document.getElementById("liveSearchInput").value = "";
  document.getElementById("weightInput").value = "";
  document.getElementById("weighingForm").style.display = "none";
};

function selectUserForWeighIn(userMatch) {
  weigherTargetUser = userMatch;
  document.getElementById("searchResult").innerHTML = `
    <div style="background: #f0f5ff; padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin-top: 15px;">
      <span style="color: var(--text-muted); font-size: 0.9em;">Selected User:</span><br>
      <strong style="color: var(--primary-color); font-size: 1.2em;">${userMatch.name}</strong> <br> 
      <span style="font-size: 0.9em; color: var(--text-muted); display: block; margin-top: 5px;">
        Total Points: <strong id="liveUserPoints" style="color: var(--accent-hover); font-size: 1.3em;">${userMatch.points}</strong>
      </span>
    </div>`;
  document.getElementById("weighingForm").style.display = "block";
}

window.processWeighIn = async function () {
  const material = document.getElementById("materialSelect").value;
  let weight = parseFloat(document.getElementById("weightInput").value);

  if (!material || material === "") {
    return showToast("Please select a material first.", "error");
  }

  if (!weigherTargetUser)
    return showToast("Please search and select a user first.", "error");
  if (isNaN(weight) || weight <= 0)
    return showToast("Error: Weight must be a positive number.", "error");

  const submitBtn = document.querySelector(
    "#weighingForm button[type='submit']",
  );
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Saving...";
  }

  try {
    weight = parseFloat(weight.toFixed(3));
    const rateConfig = pointRates[material] || { rate: 0 };
    const pointsEarned = Math.floor(weight * rateConfig.rate);

    const date = new Date();
    const currentMonthStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

    const userRef = doc(db, "users", weigherTargetUser.uid);
    const freshUserDoc = await getDoc(userRef);
    const freshData = freshUserDoc.data();

    const newTotalPoints = (freshData.points || 0) + pointsEarned;

    let newMonthlyPoints = pointsEarned;
    if (freshData.lastMonthUpdated === currentMonthStr) {
      newMonthlyPoints += freshData.currentMonthPoints || 0;
    }

    const safeMaterial = material.replace(/[^a-zA-Z0-9]/g, "");
    const dbField =
      "total" + safeMaterial.charAt(0).toUpperCase() + safeMaterial.slice(1);

    const newMaterialWeight = parseFloat(
      ((freshData[dbField] || 0) + weight).toFixed(3),
    );

    await updateDoc(userRef, {
      points: newTotalPoints,
      currentMonthPoints: newMonthlyPoints,
      lastMonthUpdated: currentMonthStr,
      [dbField]: newMaterialWeight,
    });

    await addDoc(collection(db, "transactions"), {
      studentId: weigherTargetUser.uid,
      studentName: weigherTargetUser.name,
      weigherName: activeUserData.name,
      material: material,
      weightKg: weight,
      pointsAwarded: pointsEarned,
      timestamp: new Date().toLocaleString(),
    });

    showToast(`Success! Awarded ${pointsEarned} pts.`, "success");

    document.getElementById("weightInput").value = "";
    weigherTargetUser.points = newTotalPoints;
    document.getElementById("liveUserPoints").innerText = newTotalPoints;

    fetchUsersForSearch();
  } catch (error) {
    showToast("Error saving data. Please try again.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Award Points Now";
    }
  }
};

// --- HISTORY & UNDO SYSTEM ---
window.fetchTransactionHistory = async function () {
  const list = document.getElementById("transactionList");
  list.innerHTML = '<p style="color: var(--text-muted)">Loading...</p>';

  try {
    const q = query(
      collection(db, "transactions"),
      orderBy("timestamp", "desc"),
      limit(50),
    );
    const snap = await getDocs(q);

    let html = "";
    snap.forEach((doc) => {
      const data = doc.data();
      html += `
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: var(--primary-color)">${data.studentName}</strong>
            <div style="font-size: 0.85em; color: var(--text-muted); margin-top: 4px;">
              ${data.weightKg}kg ${data.material} • <strong style="color: var(--accent-hover); font-size: 1.1em;">+${data.pointsAwarded} pts</strong> <br>
              <small>By ${data.weigherName} on ${data.timestamp}</small>
            </div>
          </div>
          <button class="action-btn small-btn" style="background-color: var(--error-color); color: white; width: auto; margin: 0; padding: 6px 16px; box-shadow: 0 2px 4px rgba(231,76,60,0.3);"
            onclick="promptUndoTransaction('${doc.id}', '${data.studentId}', '${data.material}', ${data.weightKg}, ${data.pointsAwarded})">
            Undo
          </button>
        </div>
      `;
    });

    list.innerHTML = html || "<p>No recent point transactions found.</p>";
  } catch (error) {
    console.error(error);
    list.innerHTML =
      '<p style="color: red">Failed to load history. Ensure Firebase indexes are built if needed.</p>';
  }
};

window.promptUndoTransaction = function (
  docId,
  studentId,
  material,
  weight,
  pointsToSubtract,
) {
  pendingUndoData = { docId, studentId, material, weight, pointsToSubtract };
  document.getElementById("undoModal").style.display = "flex";
};

window.closeUndoModal = function () {
  pendingUndoData = null;
  document.getElementById("undoModal").style.display = "none";
};

window.confirmUndoTransaction = async function () {
  if (!pendingUndoData) return;
  const { docId, studentId, material, weight, pointsToSubtract } =
    pendingUndoData;

  document.getElementById("undoModal").style.display = "none";
  showToast("Reversing transaction...", "info");

  try {
    const userRef = doc(db, "users", studentId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const freshData = userDoc.data();

      const safeMaterial = material.replace(/[^a-zA-Z0-9]/g, "");
      const dbField =
        "total" + safeMaterial.charAt(0).toUpperCase() + safeMaterial.slice(1);

      const newTotalPoints = Math.max(
        0,
        (freshData.points || 0) - pointsToSubtract,
      );
      const newMonthlyPoints = Math.max(
        0,
        (freshData.currentMonthPoints || 0) - pointsToSubtract,
      );
      const newWeight = Math.max(0, (freshData[dbField] || 0) - weight);

      await updateDoc(userRef, {
        points: newTotalPoints,
        currentMonthPoints: newMonthlyPoints,
        [dbField]: newWeight,
      });
    }

    await deleteDoc(doc(db, "transactions", docId));

    showToast("Transaction undone successfully.", "success");
    fetchTransactionHistory();
  } catch (error) {
    console.error(error);
    showToast("Error undoing transaction.", "error");
  } finally {
    pendingUndoData = null; // Clear the pending data safely
  }
};

// --- ANNUAL SEASON RESET ---
window.triggerAnnualReset = async function () {
  if (
    !confirm(
      "⚠️ WARNING: This will permanently archive all current user points and reset everyone's balance and material weights to 0. Are you absolutely sure?",
    )
  ) {
    return;
  }

  showToast("Starting annual reset... Please wait.", "info");

  try {
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);
    const currentYear = new Date().getFullYear();

    for (const userDoc of querySnapshot.docs) {
      const data = userDoc.data();

      if (data.role === "user") {
        const userRef = doc(db, "users", userDoc.id);

        let updates = {
          points: 0,
          currentMonthPoints: 0,
          [`archive_${currentYear}`]: data.points || 0,
        };

        for (const material of Object.keys(pointRates)) {
          const safeMaterial = material.replace(/[^a-zA-Z0-9]/g, "");
          const dbField =
            "total" +
            safeMaterial.charAt(0).toUpperCase() +
            safeMaterial.slice(1);
          updates[dbField] = 0;
        }

        await updateDoc(userRef, updates);
      }
    }

    showToast(
      `Success! The ${currentYear} season has been completely reset.`,
      "success",
    );
    fetchLeaderboard();
  } catch (error) {
    console.error(error);
    showToast("Error during reset. Check console.", "error");
  }
};
