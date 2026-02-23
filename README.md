# CeriaPoints ☀️♻️

CeriaPoints is a sustainable, community-focused web application designed specifically for the Tadika Matahari Ceria kindergarten. This project aims to encourage students and parents to recycle by turning waste management into a fun, gamified experience.

**🌐 Live Web App Available on:** [https://ceriapoints.vercel.app/](https://ceriapoints.vercel.app/)

## 🚀 Project Motivation

I built CeriaPoints as a **personal self-study project** to dive into full-stack web development. My goal was to move beyond static web pages and learn how to build a dynamic, data-driven application from scratch. 

Through this project, I learned how to manage user authentication, design and query a NoSQL database, implement role-based access control (Admin, Weigher, User), and build a fully responsive UI without relying on heavy frontend frameworks.

## ✨ Key Features

* **Gamified Dashboard:** Users can track their total points and view their lifetime environmental impact (e.g., Trees Saved, CO2 Prevented, Energy Saved) calculated dynamically based on their recycling history.
* **Live Leaderboard:** A real-time ranking system to foster friendly competition among students.
* **Role-Based Access:** * **Users:** View personal stats, edit profiles, and manage security settings.
    * **Weighers:** Access a dedicated terminal with a live-search feature to quickly find students, input material weights, and instantly award points.
    * **Admins:** Manage the entire system's economy by adding new recyclable materials, setting point rates, and defining environmental multipliers on the fly.
* **Highly Scalable Math:** The system uses dynamic object structures to seamlessly handle new materials added by admins without breaking the environmental impact calculations for legacy users.

## 🛠️ Built With (Tech Stack)

This project was built using a lightweight, vanilla tech stack to focus heavily on core programming fundamentals:

**Frontend:**
* **HTML5 & CSS3:** Custom, fully responsive "Glassmorphism" UI design built from scratch without CSS frameworks like Bootstrap or Tailwind.
* **Vanilla JavaScript (ES6+):** For DOM manipulation, live search filtering, and handling asynchronous API calls.

**Backend (Firebase as a Service):**
* **Firebase Authentication:** Secure user login, registration, and email/password management.
* **Cloud Firestore (NoSQL):** Real-time database to store user profiles, recycling history, and live admin configurations.
