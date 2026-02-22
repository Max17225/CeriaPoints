// 1. Correct Web Browser Imports for Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. Your EXACT Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQOIWX9xisGhtxC14dTJWuss75B50rs-Y",
  authDomain: "ceriapoints.firebaseapp.com",
  projectId: "ceriapoints",
  storageBucket: "ceriapoints.firebasestorage.app",
  messagingSenderId: "585629666042",
  appId: "1:585629666042:web:93d8abaeeea976c7d81743",
  measurementId: "G-3DYD55NMP6",
};

// 3. Initialize Firebase, Analytics, AND the Database (Firestore)
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app); // We were missing this line!

// --- APP LOGIC ---
let pointRates = { plastic: 100, cardboard: 50, aluminum: 200 };
let activeUserId = "";
let activeUserPoints = 0;

// Make functions available to the HTML buttons using 'window'
window.searchUser = async function () {
  let username = document.getElementById("usernameSearch").value.trim();
  let resultText = document.getElementById("searchResult");
  let weighForm = document.getElementById("weighingForm");

  if (!username) {
    alert("Please enter a username!");
    return;
  }

  resultText.innerText = "Searching database...";
  resultText.style.color = "black";

  try {
    // Ask Firebase for the user document
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      let userData = userSnap.data();
      activeUserId = username;
      activeUserPoints = userData.points || 0;

      resultText.innerText = `✅ Found: ${userData.name} (Current Points: ${activeUserPoints})`;
      resultText.style.color = "#27ae60";
      weighForm.style.display = "block";
      document.getElementById("weigherMessage").innerText = ""; // Clear old messages
    } else {
      resultText.innerText =
        "❌ User not found in database. Please check spelling.";
      resultText.style.color = "red";
      weighForm.style.display = "none";
    }
  } catch (error) {
    console.error("Error searching user: ", error);
    resultText.innerText = "⚠️ Error connecting to database.";
    resultText.style.color = "red";
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
  let newTotalPoints = activeUserPoints + pointsEarned;

  try {
    // Update the database in Firebase!
    const userRef = doc(db, "users", activeUserId);
    await updateDoc(userRef, {
      points: newTotalPoints,
    });

    // Update the screen
    document.getElementById("weigherMessage").innerText =
      `🎉 Success! Sent ${pointsEarned} points to Firebase. New Total: ${newTotalPoints}`;
    activeUserPoints = newTotalPoints; // update our local tracking

    // Reset form inputs
    document.getElementById("weightInput").value = "";
    document.getElementById("weighingForm").style.display = "none";
    document.getElementById("searchResult").innerText =
      "Ready for next weigh-in.";
    document.getElementById("usernameSearch").value = "";
  } catch (error) {
    console.error("Error updating points: ", error);
    alert("There was an error saving the points. Please try again.");
  }
};

window.switchRole = function (roleId) {
  document.getElementById("userPage").style.display = "none";
  document.getElementById("weigherPage").style.display = "none";
  document.getElementById("adminPage").style.display = "none";

  document.getElementById(roleId).style.display = "block";
};
