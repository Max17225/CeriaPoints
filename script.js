import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// Added sendPasswordResetEmail to the imports
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Your EXACT Firebase Configuration
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

// --- APP STATE VARIABLES ---
let pointRates = { plastic: 100, cardboard: 50, aluminum: 200 };
let activeUserData = null;

// --- AUTHENTICATION LOGIC ---

window.toggleAuthView = function (view) {
  document.getElementById("loginForm").style.display =
    view === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display =
    view === "register" ? "block" : "none";
  document.getElementById("loginError").innerText = "";
  document.getElementById("regError").innerText = "";
};

window.registerUser = async function () {
  let name = document.getElementById("regName").value.trim();
  let email = document.getElementById("regEmail").value.trim();
  let password = document.getElementById("regPassword").value;
  let errorMsg = document.getElementById("regError");

  if (!name || !email || !password) {
    errorMsg.innerText = "Please fill in all fields.";
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

    alert("Account created successfully! Please log in.");
    toggleAuthView("login");
  } catch (error) {
    errorMsg.innerText = error.message.replace("Firebase: ", "");
  }
};

window.loginUser = async function () {
  let email = document.getElementById("loginEmail").value.trim();
  let password = document.getElementById("loginPassword").value;
  let errorMsg = document.getElementById("loginError");

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
    } else {
      errorMsg.innerText = "Database profile missing.";
    }
  } catch (error) {
    errorMsg.innerText = "Invalid email or password.";
  }
};

window.resetPassword = async function () {
  let email = document.getElementById("loginEmail").value.trim();
  let errorMsg = document.getElementById("loginError");

  if (!email) {
    errorMsg.innerText =
      "Please enter your email above, then click 'Forgot Password?'.";
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent! Please check your inbox.");
    errorMsg.innerText = "";
  } catch (error) {
    errorMsg.innerText = error.message.replace("Firebase: ", "");
  }
};

window.logoutUser = function () {
  signOut(auth).then(() => {
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("authContainer").style.display = "flex"; // Changed to flex for new layout
    document.getElementById("navUser").style.display = "none";
    document.getElementById("navWeigher").style.display = "none";
    document.getElementById("navAdmin").style.display = "none";
  });
};

// --- APP ROUTING & LOGIC ---

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
  } else if (userData.role === "weigher") {
    document.getElementById("navWeigher").style.display = "inline-block";
    document.getElementById("weigherPage").style.display = "block";
  } else if (userData.role === "admin") {
    document.getElementById("navUser").style.display = "inline-block";
    document.getElementById("navWeigher").style.display = "inline-block";
    document.getElementById("navAdmin").style.display = "inline-block";
    document.getElementById("adminPage").style.display = "block";
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
    alert("Please enter a User ID!");
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
      document.getElementById("weigherMessage").innerText = "";
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
    alert("Please enter a valid weight!");
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

    document.getElementById("weigherMessage").innerText =
      `Success! Added ${pointsEarned} pts. User now has ${newTotalPoints} total points.`;

    document.getElementById("weightInput").value = "";
    document.getElementById("weighingForm").style.display = "none";
    document.getElementById("searchResult").innerText =
      "Ready for next weigh-in.";
    document.getElementById("usernameSearch").value = "";
  } catch (error) {
    console.error("Error updating database: ", error);
    alert("There was an error saving the data. Please try again.");
  }
};

window.switchRole = function (roleId) {
  document.getElementById("userPage").style.display = "none";
  document.getElementById("weigherPage").style.display = "none";
  document.getElementById("adminPage").style.display = "none";
  document.getElementById(roleId).style.display = "block";
};
