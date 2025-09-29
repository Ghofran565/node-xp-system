# Node.js XP-based Tasks System

This repository hosts a **real-time XP-based tasks API** built with Node.js, designed to manage player tasks, XP, tournaments, and leaderboards. It features robust security, real-time updates via Socket.io, Redis caching, and a comprehensive DevOps pipeline for scalable deployment.

# Postman's Workspace Link
- The public Postman workspace is currently in preparation as the project is in the **testing** phase.
- The link will be shared here once available, even if the workspace is not fully complete.

## Project Structure

- **Controllers/**: Business logic for all features.
  - `authController.js`: Handles registration, email verification, login, and password reset.
  - `taskController.js`: Manages task assignment, completion, and admin operations.
  - `tournamentController.js`: Supports tournament registration, task handling, and admin tasks.
  - `playerController.js`: Tracks player progress and rank updates.
  - `leaderboardController.js`: Manages XP and tournament leaderboard rankings.
- **Middlewares/**: Authentication, validation, and access control.
  - `auth.js`: Verifies JWT, attaches `playerId`, `role`, `rank`, `groups`, and `verified` status.
  - `role.js`: Restricts endpoints by role (`user`, `admin`, `moderator`).
  - `validation.js`: Sanitizes inputs (`taskId`, `groups`, `tournamentGroups`).
  - `verified.js`: Blocks actions for unverified users (`verified=false`).
- **Models/**: MongoDB schemas with indexes for performance.
  - `Task.js`: Tasks with time restrictions and tournament links.
  - `Player.js`: Player data including verification status and XP.
  - `PlayerTaskProgress.js`: Tracks task completions.
  - `Rank.js`: Defines ranks with XP boosters.
  - `Group.js`: Defines groups with XP boosters.
  - `Tournament.js`: Manages tournament details and restricted access.
  - `PasswordResetToken.js`: Stores password reset tokens.
  - `VerificationToken.js`: Stores email verification tokens.
  - `AuditLog.js`: Logs actions for auditing.
- **Routes/**: RESTful API endpoints.
  - `auth.js`: Authentication and verification routes.
  - `tasks.js`: Task management and completion endpoints.
  - `tournaments.js`: Tournament registration and operations.
  - `players.js`: Player progress and rank endpoints.
  - `leaderboards.js`: Leaderboard rankings for XP and tournaments.
  - `health.js`: System health check endpoint.
- **Utilities/**: Helper functions for system operations.
  - `errorHandler.js`: Centralized error handling.
  - `logger.js`: Winston logging to file and MongoDB.
  - `seed.js`: Seeds database with sample data (tasks, ranks, groups, tournaments).
  - `notifier.js`: Sends email notifications for verification, rank-ups, and tournaments.
  - `cache.js`: Manages Redis caching for tasks and leaderboards.
- **Tests/**: Jest-based unit and integration tests.
  - `auth.test.js`, `task.test.js`, `tournament.test.js`, `player.test.js`, `leaderboard.test.js`.

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Ghofran565/Real-time-Leaderboard-backend.git
   cd Real-time-Leaderboard-backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the root directory and configure the following:
   ```env
   JWT_SECRET=your_jwt_secret
   EMAIL_CREDS=your_smtp_credentials
   MONGO_URI=your_mongodb_uri
   REDIS_URL=your_redis_uri
   PORT=3000
   ```

4. **Seed the Database**:
   ```bash
   node Utilities/seed.js
   ```
   This populates the database with sample tasks (global, tournament, time-bound), ranks, groups, and tournaments.

5. **Run the Server**:
   ```bash
   npm run server
   ```

6. **Docker Deployment**:
   Use the provided `Dockerfile` for containerized deployment:
   ```bash
   docker build -t xp-tasks-api .
   docker run -p 3000:3000 --env-file .env xp-tasks-api
   ```

For detailed setup instructions, refer to [README_full.md](README_full.md) or consult the team for cloud deployment configurations (MongoDB Atlas, Redis, Nginx).

## Project Highlights

- **Docker-Ready**: Fully containerized with Docker for consistent development, testing, and production environments.
- **Redis Caching**: High-performance caching for task lists and leaderboards with LRU eviction and TTLs.
- **Comprehensive Testing**: Jest-based unit tests for schemas and algorithms, integration tests for full flows (register → verify → join tournament → complete task), and security tests for unauthorized access and rate limits.
- **GitHub CI/CD**: Automated pipeline with GitHub Actions for linting (ESLint, Prettier), testing (Jest), security scanning (`npm audit`, `snyk`), building, and deploying to staging/production.
- **Swagger Documentation**: Planned integration for interactive API documentation.
- **Real-time Updates**: Socket.io for real-time leaderboard updates (`leaderboardUpdate`) and player progress (`playerUpdate`).
- **Security Features**:
  - JWT authentication with refresh token rotation (stored in Redis).
  - Rate limiting (50 requests/hour per IP/player on critical endpoints).
  - Input validation using `express-validator`.
  - Anti-cheat mechanisms (XP/hour anomaly detection, logged in `AuditLogs`).
  - HTTP security headers via `helmet` (`Content-Security-Policy`, `Strict-Transport-Security`).
- **Monitoring & Logging**:
  - Winston logging to file and MongoDB (`AuditLogs`) for actions (e.g., task completion, admin operations).
  - Prometheus + Grafana for performance metrics and real-time monitoring.
  - PM2 for process management and uptime.
  - Slack/Discord alerts for errors, downtime, or suspicious activity.

## API Endpoints Examples

| Method | Endpoint                          | Description                                      |
|--------|-----------------------------------|--------------------------------------------------|
| POST   | `/api/auth/register`              | Register a new user and send verification email  |
| POST   | `/api/auth/verify-email`          | Verify email with token, set `verified=true`     |
| POST   | `/api/auth/login`                 | Log in and return JWT with player details        |
| POST   | `/api/tasks/:taskId/complete`     | Complete a task, apply base/boosted XP           |
| GET    | `/api/tasks/assigned`             | List tasks based on groups, bypass, and time     |
| POST   | `/api/tournaments/:tournamentId/join` | Join a tournament if rank/group eligible      |
| GET    | `/api/leaderboards`               | Fetch XP or tournament rankings (?type=xp or ?tournamentId=xyz) |
| GET    | `/api/players/:playerId/progress` | View player progress, XP, rank, and groups       |
| GET    | `/api/health`                     | Check system status (tasks, tournaments, DB)     |

**Example Requests**:

**Register User**  
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "player1",
  "email": "player1@example.com",
  "password": "StrongPass123!"
}
```

**Response**  
```json
{
  "message": "Verification email sent to player1@example.com",
  "verified": false
}
```

**Complete Task**  
```http
POST /api/tasks/64fc9d3/complete
Authorization: Bearer <JWT_TOKEN>
```

**Response**  
```json
{
  "taskId": "64fc9d3",
  "xpAwarded": 50,
  "newTotalXp": 200,
  "rank": "bronze"
}
```

For full endpoint details, refer to the respective route files in the `Routes` directory or the upcoming Swagger documentation.

## Development Phase

**Phase**: **Development & Testing**

**Current Focus**:
- **Unit and Manual Testing**: Finalizing Jest unit tests for schemas, algorithms (task eligibility, XP calculation, rank updates), and integration tests for end-to-end flows.
- **DevOps Deployment**: Setting up CI/CD with GitHub Actions for automated linting, testing, security scanning, and deployment to staging/production.
- **Security Enhancements**: Implementing rate limiting (50 requests/hour on `/api/auth/*`, `/api/tasks/:taskId/complete`, `/api/tournaments/*`), JWT refresh tokens, and anti-cheat anomaly detection (XP/hour > 5× top 10% average).
- **Monitoring Setup**: Configuring Prometheus + Grafana dashboards and Slack/Discord alerts for errors and downtime.

**Timeline**:
- **Week 1**: Completed setup, authentication (register, verify, login, reset), and schema definitions.
- **Week 2**: Implemented task/tournament endpoints, time validation, and boosters.
- **Week 3**: Developed player progress, ranks, leaderboards, security features, and notifications.
- **Week 4**: Finalizing testing (unit, integration, security, load), deployment (Docker, MongoDB Atlas, Redis, Nginx), and monitoring.

## Common Issues

- **Missing Environment Variables**: Ensure `.env` includes `JWT_SECRET`, `EMAIL_CREDS`, `MONGO_URI`, `REDIS_URL`, and `PORT` to avoid runtime errors.
- **Database Connection Failures**: Verify MongoDB Atlas and Redis credentials; check network policies for cloud deployments.
- **Rate Limit Exceeded**: Critical endpoints are limited to 50 requests/hour per IP/player; use admin tools to reset limits if needed.
- **Unverified Users**: Actions are blocked for unverified users (`verified=false`); ensure email verification is completed.
- **Cache Invalidation**: Task or leaderboard updates may require manual cache clearing in Redis during development.

## Contributing

Contributions are welcome! Follow these steps to contribute:
1. Fork the repository.
2. Create a feature or bug-fix branch (`git checkout -b feature/your-feature`).
3. Commit changes with clear messages (`git commit -m "Add feature X"`).
4. Push to your fork (`git push origin feature/your-feature`).
5. Submit a pull request with a detailed description of changes and reference any related issues.

Please adhere to the code style (ESLint, Prettier) and include tests for new features. For major changes, open an issue first to discuss with the team.

## License

This project is licensed under the [MIT License](LICENSE).
