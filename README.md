# CeriaPoints 

CeriaPoints is a sustainable, community-focused web application designed specifically for Tadika Matahari Ceria in Pengkalan Hulu. The app supports the kindergarten’s monthly recycling initiatives, allowing parents and students to bring recyclable items to be weighed, earn points, and track their contributions to environmental sustainability.

**🌐 Live Web App Available on:** [(https://ceriapoints.tmceria.fun/)](https://ceriapoints.tmceria.fun/)

## Project Purpose

CeriaPoints was developed to actively support Tadika Matahari Ceria’s recycling program while also providing a hands-on opportunity to explore full-stack web development. The system transforms recycling into a fun, gamified experience, motivating students and parents to participate regularly and track their environmental impact.

Through this project, I implemented secure user authentication, a role-based system (Admin, Weigher, User), a NoSQL database, and a fully responsive UI, while ensuring the platform can scale as the kindergarten’s recycling program grows.

## Key Features

* **Gamified Dashboard:** Users can track their total points and view their lifetime environmental impact (e.g., Trees Saved, CO2 Prevented, Energy Saved) calculated dynamically based on their recycling history.
* **Live Leaderboard:** Real-time ranking encourages friendly competition. Top contributor of the month receives a mystery prize, while top 3 contributors of the year are recognized with special rewards.
* **Role-Based Access:** 
    * **Users:** View personal stats, edit profiles, and manage security settings.
    * **Weighers:** Access a dedicated terminal with a live-search feature to quickly find students, input material weights, and instantly award points.
    * **Admins:** Manage the entire system's economy by adding new recyclable materials, setting point rates, and defining environmental multipliers on the fly.
* **Dynamic Material Handling:** The system can seamlessly accommodate new recyclable materials without breaking existing calculations, ensuring long-term scalability.

## Built With (Tech Stack)

This project was built using a lightweight, vanilla tech stack to focus heavily on core programming fundamentals:

**Frontend:**
* **HTML5 & CSS3:** Custom, fully responsive "Glassmorphism" UI design built from scratch without CSS frameworks like Bootstrap or Tailwind.
* **Vanilla JavaScript (ES6+):** For DOM manipulation, live search filtering, and handling asynchronous API calls.

**Backend (Firebase as a Service):**
* **Firebase Authentication:** Secure user login, registration, and email/password management.
* **Cloud Firestore (NoSQL):** Real-time database to store user profiles, recycling history, and live admin configurations.
