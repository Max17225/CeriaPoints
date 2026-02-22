import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
// NEW: Added collection, query, orderBy, limit, getDocs for the leaderboard
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
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
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

let pointRates = { plastic: 100, cardboard: 50, aluminum: 200 };
let activeUserData = null;

// --- CUSTOM UI ALERT (TOAST) ---
window.showToast = function (message, type = "success") {
  const toast = document.getElementById("customToast");
  toast.innerText = message;
  toast.className = "toast show " + type;
  setTimeout(() => {
    toast.className = toast.className.replace("show", "");
  }, 3500); // Hides after 3.5 seconds
};

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
  let name = document.getElementById("regName").value.trim();
  let email = document.getElementById("regEmail").value.trim();
  let password = document.getElementById("regPassword").value;

  if (!name || !email || !password) {
    showToast("Please fill in all registration fields.", "error");
    return;
  }

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
    });

    showToast("Account created successfully! Please log in.", "success");
    toggleAuthView("login");
  } catch (error) {
    showToast(error.message.replace("Firebase: ", ""), "error");
  }
};

window.loginUser = async function () {
  let email = document.getElementById("loginEmail").value.trim();
  let password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    showToast("Please enter email and password.", "error");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
      const userData = userDoc.data();
      loadDashboard(userData);
      showToast(`Welcome back, ${userData.name}!`, "success");
    } else {
      showToast("Database profile missing.", "error");
    }
  } catch (error) {
    showToast("Invalid email or password.", "error");
  }
};

window.resetPassword = async function () {
  let email = document.getElementById("resetEmail").value.trim();

  if (!email) {
    showToast("Please enter your email address first.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Reset link sent! Please check your spam folder.", "success");
    toggleAuthView("login");
  } catch (error) {
    showToast(error.message.replace("Firebase: ", ""), "error");
  }
};

window.logoutUser = function () {
  signOut(auth).then(() => {
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("authContainer").style.display = "flex";
    document.getElementById("navUser").style.display = "none";
    document.getElementById("navWeigher").style.display = "none";
    document.getElementById("navAdmin").style.display = "none";
    showToast("Logged out successfully.", "success");
  });
};

// --- APP ROUTING & LEADERBOARD LOGIC ---

function loadDashboard(userData) {
  document.getElementById("authContainer").style.display = "none";
  document.getElementById("appContainer").style.display = "block";

  document.getElementById("userPage").style.display = "none";
  document.getElementById("weigherPage").style.display = "none";
  document.getElementById("adminPage").style.display = "none";

  if (userData.role === "user") {
    document.getElementById("navUser").style.display = "inline-block";
    document.getElementById("userPage").style.display = "block";
    document.getElementById("displayUserName").innerText = userData.name;
    document.getElementById("userPointsDisplay").innerText =
      userData.points || 0;

    calculateEnvironmentalImpact(userData);
    fetchLeaderboard(); // Load the top 5 recyclers
  } else if (userData.role === "weigher") {
    document.getElementById("navWeigher").style.display = "inline-block";
    document.getElementById("weigherPage").style.display = "block";
  } else if (userData.role === "admin") {
    document.getElementById("navUser").style.display = "inline-block";
    document.getElementById("navWeigher").style.display = "inline-block";
    document.getElementById("navAdmin").style.display = "inline-block";
    document.getElementById("adminPage").style.display = "block";
    fetchLeaderboard(); // Admins might want to see it too
  }
}

async function fetchLeaderboard() {
  const leaderboardList = document.getElementById("leaderboardList");
  leaderboardList.innerHTML =
    '<p style="text-align: center; color: var(--text-muted);">Fetching scores...</p>';

  try {
    // Query the 'users' collection, order by 'points' highest to lowest, limit to top 5
    const q = query(
      collection(db, "users"),
      orderBy("points", "desc"),
      limit(5),
    );
    const querySnapshot = await getDocs(q);

    let html = "";
    let rank = 1;

    querySnapshot.forEach((doc) => {
      let data = doc.data();
      // Don't show admins/weighers on the leaderboard, or users with 0 points
      if (data.role === "user" && data.points > 0) {
        html += `
                <div class="leaderboard-item">
                    <span class="rank">#${rank}</span>
                    <span class="name">${data.name}</span>
                    <span class="score">${data.points} pts</span>
                </div>`;
        rank++;
      }
    });

    if (html === "") {
      leaderboardList.innerHTML =
        '<p style="text-align: center; color: var(--text-muted);">No points awarded yet. Be the first!</p>';
    } else {
      leaderboardList.innerHTML = html;
    }
  } catch (error) {
    console.error("Leaderboard Error:", error);
    leaderboardList.innerHTML =
      '<p style="text-align: center; color: var(--error-color);">Failed to load leaderboard.</p>';
  }
}

function calculateEnvironmentalImpact(userData) {
  let card = userData.totalCardboard || 0;
  let plas = userData.totalPlastic || 0;
  let alum = userData.totalAluminum || 0;

  let trees = card * 0.017;
  let co2 = plas * 1.5;
  let energy = alum * 14.0;

  document.getElementById("treesSaved").innerText = trees.toFixed(1);
  document.getElementById("co2Saved").innerText = co2.toFixed(1);
  document.getElementById("energySaved").innerText = energy.toFixed(1);
}

// --- WEIGHER LOGIC ---

window.searchUser = async function () {
  let username = document.getElementById("usernameSearch").value.trim();
  let resultText = document.getElementById("searchResult");
  let weighForm = document.getElementById("weighingForm");

  if (!username) {
    showToast("Please enter a User ID to search!", "error");
    return;
  }

  resultText.innerText = "Searching database...";
  resultText.style.color = "var(--text-main)";

  try {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      activeUserData = userSnap.data();
      activeUserData.uid = username;

      let currentPoints = activeUserData.points || 0;
      resultText.innerText = `Found: ${activeUserData.name} (Current Points: ${currentPoints})`;
      resultText.style.color = "var(--success-color)";
      weighForm.style.display = "block";
    } else {
      resultText.innerText =
        "User not found in database. Please check the UID.";
      resultText.style.color = "var(--error-color)";
      weighForm.style.display = "none";
    }
  } catch (error) {
    console.error("Error searching user: ", error);
    resultText.innerText = "Error connecting to database.";
    resultText.style.color = "var(--error-color)";
  }
};

window.processWeighIn = async function () {
  let material = document.getElementById("materialSelect").value;
  let weight = parseFloat(document.getElementById("weightInput").value);

  if (isNaN(weight) || weight <= 0) {
    showToast("Please enter a valid weight!", "error");
    return;
  }

  let pointsEarned = weight * pointRates[material];
  let newTotalPoints = (activeUserData.points || 0) + pointsEarned;

  let databaseFieldToUpdate = "";
  if (material === "cardboard") databaseFieldToUpdate = "totalCardboard";
  else if (material === "plastic") databaseFieldToUpdate = "totalPlastic";
  else if (material === "aluminum") databaseFieldToUpdate = "totalAluminum";

  let currentMaterialWeight = activeUserData[databaseFieldToUpdate] || 0;
  let newMaterialWeight = currentMaterialWeight + weight;

  try {
    const userRef = doc(db, "users", activeUserData.uid);
    await updateDoc(userRef, {
      points: newTotalPoints,
      [databaseFieldToUpdate]: newMaterialWeight,
    });

    activeUserData.points = newTotalPoints;
    activeUserData[databaseFieldToUpdate] = newMaterialWeight;

    showToast(`Success! Added ${pointsEarned} pts.`, "success");

    document.getElementById("weightInput").value = "";
    document.getElementById("weighingForm").style.display = "none";
    document.getElementById("searchResult").innerText =
      "Ready for next weigh-in.";
    document.getElementById("usernameSearch").value = "";
  } catch (error) {
    console.error("Error updating database: ", error);
    showToast("Error saving data. Please try again.", "error");
  }
};

window.switchRole = function (roleId) {
  document.getElementById("userPage").style.display = "none";
  document.getElementById("weigherPage").style.display = "none";
  document.getElementById("adminPage").style.display = "none";
  document.getElementById(roleId).style.display = "block";
};
