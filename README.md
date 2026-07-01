# AmazeCC

<img src="public/icons/AmazeCC.png" width="300">

**Live site:** [https://amazecc.com](https://amazecc.com)

**Repository:** [https://github.com/AmazeContinuityProjects/AmazeCC](https://github.com/AmazeContinuityProjects/AmazeCC)
**API Docs:** [https://api.amazecc.com/docs](https://api.amazecc.com/docs)
**API Stats:** [https://api.amazecc.com/stats](https://api.amazecc.com/stats)

---

## Overview

AmazeCC is a web application designed specifically for students of **VIT University**.  
It provides a clean, minimalist interface to access campus-related information such as attendance, grades, schedules, hostel status, and file storage.

> Originally forked from [Arya4930/UniCC](https://github.com/Arya4930/UniCC)

> Captcha solver logic adapted from  
> [arshsaxena/ViBoot-Enhanced](https://github.com/arshsaxena/ViBoot-Enhanced/blob/main/js/captcha/captchaparser.js)



## Backend Usage (Important)

### 🔹 Recommended: Use the Hosted Backend (Preferred)

Hosting your own backend is **not recommended** unless you specifically need to, as it requires:
- A MongoDB database
- A Backblaze B2 bucket for file storage

The app uses the hosted backend API by default via the `NEXT_PUBLIC_API_URL` environment variable (default: `https://api.amazecc.com`).
You can override this by setting `NEXT_PUBLIC_API_URL` in your environment or modifying the fallback in `src/components/custom/Main.tsx`:
```ts
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";
```
---
## Optional: Hosting Your Own Backend
If you choose to host your own backend, create a .env file with the following variables:
```
MONGODB_URI=

B2_ENDPOINT=
B2_BUCKET_NAME=
B2_ACCESS_KEY_ID=
B2_SECRET_ACCESS_KEY=
B2_REGION=

ADMINS=
ID_SALT=

SMTP_PASS=
SMTP_USER=
SMTP_HOST=
```
### Starting the backend
```bash
npm run api-build
npm run api-start
```
> Note: MongoDB and Backblaze B2 must be configured correctly for the backend to function.
---
## API Endpoints
Each endpoint performs the function implied by its name.
The backend exposes the following endpoints:

```ts
app.use("/api/status", statusRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/login", loginRoutes);

app.use("/api/hostel", hostelRoutes);        // Hostel / mess status
app.use("/api/grades", gradesRoutes);        // Overall grades + CGPA
app.use("/api/schedule", scheduleRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/all-grades", allGradesRoutes); // Semester-wise grades

app.use("/api/files/upload/:userID", UploadFile);
app.use("/api/files/fetch/:userID", fetchFiles);
app.use("/api/files/delete/:userID/:fileID", deleteFile);
app.use("/api/files/download/:userID/:fileID", downloadFile);
```
---

## Getting Started ( Frontend )

To run AmazeCC locally:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/AmazeContinuityProjects/AmazeCC.git
   cd AmazeCC
   ```
2. **Install dependencies:**

   ```bash
   npm install
   ```
3. **Start the development server:**

   ```bash
   npm run dev
   ```

## Contributing

Interested in contributing? Feel free to fork the repo and submit pull requests. Issues and feedback are welcome!

Please make sure to read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

This project is licensed under the [MIT License](LICENSE).

## Contributors

[![AmazeContinuityProjects](https://img.shields.io/badge/AmazeContinuityProjects-000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/AmazeContinuityProjects)
[![SugeethJSA](https://img.shields.io/badge/SugeethJSA-000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/SugeethJSA)
[![dhivyanj](https://img.shields.io/badge/dhivyanj-000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/dhivyanj)
[![anasa](https://img.shields.io/badge/anasa-000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/anasa)