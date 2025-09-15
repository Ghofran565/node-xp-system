# Task, XP, and Leaderboard System Roadmap for Real-time Leaderboard Backend

## Directories
- **Controllers/**: Business logic for all features.
  - `authController.js`: Registration, email verification, login, password reset.
  - `taskController.js`: Task assignment, completion, admin management.
  - `tournamentController.js`: Tournament registration, task handling, admin operations.
  - `playerController.js`: Player progress, rank updates.
  - `leaderboardController.js`: XP and tournament rankings.
- **Middlewares/**: Authentication, validation, restrictions.
  - `auth.js`: Verify JWT, attach playerId, role, rank, groups, verified.
  - `role.js`: Restrict endpoints by role (user, admin, moderator).
  - `validation.js`: Sanitize inputs (taskId, groups, tournamentGroups).
  - `verified.js`: Block actions for unverified users (verified=false).
- **Models/**: MongoDB schemas.
  - `Task.js`: Tasks with time restrictions, tournament links.
  - `Player.js`: Player data with verification status.
  - `PlayerTaskProgress.js`: Task completion tracking.
  - `Rank.js`: Rank definitions with boosters.
  - `Group.js`: Group definitions with boosters.
  - `Tournament.js`: Tournament details with restricted access.
  - `PasswordResetToken.js`: Password reset tokens.
  - `VerificationToken.js`: Email verification tokens.
  - `AuditLog.js`: Action logging.
- **Routes/**: RESTful API endpoints.
  - `auth.js`: Authentication and verification routes.
  - `tasks.js`: Task management and completion.
  - `tournaments.js`: Tournament operations.
  - `players.js`: Player progress and rank.
  - `leaderboards.js`: Leaderboard rankings.
  - `health.js`: System status check.
- **Utilities/**: Helper functions.
  - `errorHandler.js`: Global error handling.
  - `logger.js`: Winston logging to file/Mongo.
  - `seed.js`: Seed database with sample data.
  - `notifier.js`: Email notifications (verification, rank-ups, tournaments).
  - `cache.js`: Redis caching for tasks, leaderboards.
- **Tests/**: Jest unit and integration tests.
  - `auth.test.js`, `task.test.js`, `tournament.test.js`, `player.test.js`, `leaderboard.test.js`.

## Schemas (Models Dir)
- **Tasks** (`Task.js`):
  - Fields: `taskId` (ObjectId, unique), `title` (string), `xpReward` (number >0), `maxCompletions` (number, 0=unlimited), `groups` (array of strings, e.g., ["global", "bronze", "dedicated"]), `playersBypass` (array of ObjectIds), `category` (string, e.g., "daily", "tournament"), `tournamentId` (ObjectId, optional), `startTime` (Date, optional), `endTime` (Date, optional).
  - Indexes: `taskId`, `groups`, `playersBypass`, `tournamentId`, `category`, `startTime`, `endTime`.
- **Players** (`Player.js`):
  - Fields: `playerId` (ObjectId, unique), `username` (string, unique), `email` (string, unique), `password` (hashed), `verified` (boolean, default false), `role` (enum: "user", "admin", "moderator"), `rank` (string, e.g., "bronze"), `totalXp` (number), `groups` (array, e.g., ["dedicated", "tournament_123"]), `lastUpdated` (Date).
  - Indexes: `playerId`, `username`, `email`, `totalXp`, `groups`.
- **PlayerTaskProgress** (`PlayerTaskProgress.js`):
  - Fields: `playerId` (ObjectId), `taskId` (ObjectId), `completions` (number), `lastCompleted` (Date).
  - Index: Composite `playerId`+`taskId`.
- **Ranks** (`Rank.js`):
  - Fields: `rankId` (ObjectId, unique), `rankName` (string, e.g., "diamond"), `minXp` (number), `xpBooster` (number, e.g., 3 for Diamond).
  - Index: `rankName`.
- **Groups** (`Group.js`):
  - Fields: `groupId` (ObjectId, unique), `groupName` (string, e.g., "special"), `xpBooster` (number, e.g., 2).
  - Index: `groupName`.
- **Tournaments** (`Tournament.js`):
  - Fields: `tournamentId` (ObjectId, unique), `name` (string), `startTime` (Date), `endTime` (Date), `participants` (array of ObjectIds), `tournamentGroups` (array of strings, e.g., ["diamond", "emerald"] or ["dedicated"]).
  - Indexes: `tournamentId`, `startTime`, `endTime`, `tournamentGroups`.
- **PasswordResetTokens** (`PasswordResetToken.js`):
  - Fields: `playerId` (ObjectId), `token` (string, unique), `expiresAt` (Date).
  - Index: `token`.
- **VerificationTokens** (`VerificationToken.js`):
  - Fields: `playerId` (ObjectId), `token` (string, unique), `expiresAt` (Date).
  - Index: `token`.
- **AuditLogs** (`AuditLog.js`):
  - Fields: `action` (string, e.g., "task_completed"), `playerId` (ObjectId), `details` (object, e.g., {xpAwarded, multiplier}), `timestamp` (Date).
  - Index: `timestamp`.

## APIs (Routes Dir)
- **Auth (Routes/auth.js)**:
  - `POST /api/auth/register`: Create user, send verification email, set verified=false.
  - `POST /api/auth/verify-email`: Verify email with token, set verified=true.
  - `POST /api/auth/login`: Return JWT (playerId, role, rank, groups, verified).
  - `POST /api/auth/forgot-password`: Send reset link.
  - `POST /api/auth/reset-password`: Update password with token.
- **Tasks (Routes/tasks.js)**:
  - `GET /api/tasks/assigned`: Filter by groups, playersBypass, tournament participation, time restrictions.
  - `GET /api/tasks/:taskId`: Details if eligible.
  - `POST /api/tasks/:taskId/complete`: Complete task, apply base/boosted XP.
  - Admin/Mod: `GET /api/tasks/all`, `POST /api/tasks` (create with tournamentId, time), `PUT /api/tasks/:taskId`, `DELETE /api/tasks/:taskId`.
- **Tournaments (Routes/tournaments.js)**:
  - `GET /api/tournament`: List active tournaments with dedicated tasks.
  - `POST /api/tournaments/:tournamentId/join`: Register if rank/group eligible.
  - `POST /api/tournaments/:tournamentId/tasks/complete`: Complete tournament task (base XP).
  - Admin: `POST /api/tournaments` (create with tournamentGroups), `PUT /api/tournaments/:tournamentId`, `DELETE /api/tournaments/:tournamentId`.
- **Players (Routes/players.js)**:
  - `GET /api/players/:playerId/progress`: Completions, totalXp, rank, groups (self/admin).
  - `GET /api/players/:playerId/rank`: Rank, XP to next rank.
  - Admin/Mod: `GET /api/players/all`, `PUT /api/players/:playerId` (update role, groups, rank).
- **Leaderboards (Routes/leaderboards.js)**:
  - `GET /api/leaderboards`: XP or tournament rankings (?type=xp, ?tournamentId=xyz).
- **Health (Routes/health.js)**:
  - `GET /api/health`: System status (tasks, tournaments).

## Phases
- **Phase 1: Setup & Authentication (Week 1)**:
  - Setup project: Clone repo, install dependencies, update `.env`.
  - Extend auth: Registration with email verification, login, forgot password.
  - Define schemas: Tasks (with time restrictions), Players (with verified), Ranks, Groups, Tournaments, Tokens, AuditLogs.
  - Seed DB: Sample tasks (global, tournament, time-bound), ranks, groups, tournaments.
- **Phase 2: Task & Tournament Management (Week 2)**:
  - Implement task endpoints: Assigned tasks, completion (base/boosted XP), admin management.
  - Extend tournament endpoints: Join (rank/group check), task completion, admin creation.
  - Add time validation for tasks (startTime, endTime).
  - Integrate boosters for regular tasks during tournaments.
  - Setup Redis caching for task lists.
- **Phase 3: Progress, Ranks, Leaderboards, Security (Week 3)**:
  - Implement player progress/rank endpoints.
  - Extend leaderboards for XP/tournament rankings with Socket.io.
  - Add security: Validation, rate limiting, verified user checks, anti-cheat.
  - Implement notifications: Email for verification, rank-ups, tournaments.
- **Phase 4: Testing & Deployment (Week 4)**:
  - Unit tests: Schemas, algorithms.
  - Integration tests: Full flows (register, verify, join, complete).
  - Security tests: Unauthorized access, rate limits, tokens.
  - Deploy: Docker, MongoDB Atlas, Redis, Nginx.
  - Monitor: PM2, Prometheus, logs.

## Algorithms
- **Task Eligibility**:
  - Input: playerId, player.rank, player.groups, player.verified.
  - Check: verified=true.
  - Query Tasks where:
    - `groups` includes "global", player.rank, or any player.groups.
    - `playersBypass` includes playerId.
    - If `category="tournament"`, playerId in Tournaments.participants and startTime ≤ now ≤ endTime.
    - If `startTime`/`endTime` defined, startTime ≤ now ≤ endTime.
  - Return: Tasks with PlayerTaskProgress.completions.
- **XP Calculation**:
  - Input: task, player, tournament status.
  - Check: verified=true.
  - If `category="tournament"`: Return base xpReward.
  - If regular task and player in active tournament (participant, startTime ≤ now ≤ endTime):
    - Fetch rank.xpBooster (Ranks), sum group.xpBooster (Groups for player.groups).
    - Total XP = xpReward × (rank.xpBooster + sum(group.xpBooster)).
  - Else: Return base xpReward.
- **Rank Update**:
  - Input: player.totalXp.
  - Query Ranks for highest rankName where totalXp ≥ minXp.
  - Update Players.rank if changed; notify via email.
- **Tournament Registration**:
  - Input: playerId, player.rank, player.groups, tournamentId, player.verified.
  - Check: verified=true.
  - Check: player.rank in tournament.tournamentGroups or player.groups includes tournament.tournamentGroups.
  - Add playerId to participants, "tournament_123" to player.groups.
- **Email Verification**:
  - Register: Generate token, save to VerificationTokens (expires 1hr), send email link.
  - Verify: Check token, set Players.verified=true, delete token.
- **Real-Time Updates**:
  - Task completion: Emit XP/rank update (Socket.io, event: "playerUpdate").
  - Tournament task/score: Emit leaderboard update (event: "leaderboardUpdate").

## Additional Components
- **Security**:
  - Validation: express-validator for taskId, groups, tournamentGroups, emails.
  - Rate Limiting: express-rate-limit on `/api/auth/*`, `/api/tasks/:taskId/complete`, `/api/tournaments/*` (50/hr per IP/player).
  - Anti-Cheat: Validate eligibility, boosters, tournament status, time restrictions, verified status.
  - Middleware: `verified.js` blocks unverified users.
- **Notifications** (Utilities/notifier.js):
  - Email: Verification, password resets, rank-ups, tournament starts/joins.
- **Caching** (Utilities/cache.js):
  - Redis: Cache task lists (key: playerId), leaderboards (key: tournamentId or "global").
- **Logging** (Utilities/logger.js):
  - Winston: Log auth, tasks, tournaments, admin actions to file/Mongo (AuditLogs).
- **Testing** (Tests dir):
  - Unit: Schemas, algorithms (eligibility, XP, registration, verification).
  - Integration: Register → verify → join tournament → complete task → leaderboard.
  - Security: Unauthorized access, rate limits, invalid tokens, unverified users.
- **Deployment**:
  - Docker: Containerize, expose PORT.
  - Cloud: MongoDB Atlas, Redis, Nginx (HTTPS).
  - Monitoring: PM2, Prometheus, Winston logs.

## Text-Only Roadmap
### Objective
Extend the Real-time Leaderboard backend to implement a task/XP system with a tournament mechanism. Players complete regular or tournament-specific tasks to earn XP, with boosters (rank + group) for regular tasks during tournaments. Tournaments have dedicated tasks (no boosters), restricted registration (ranks/groups), and time limits. Tasks may have start/end times. Email verification is required for all actions. Support roles (user, admin, moderator), real-time leaderboards, and security.

### 1. Project Planning and Integration Prep
#### 1.1 Define Requirements
- Tasks: Personalized view (`GET /api/tasks/assigned`), completion (`POST /api/tasks/:taskId/complete`), access via `groups` (e.g., ["global", "bronze", "dedicated"]), `playersBypass`, time restrictions (startTime, endTime).
- Tournaments: Time-bound (startTime, endTime), restricted registration (e.g., ["diamond"], ["dedicated"]), dedicated tasks (category="tournament", no boosters), regular tasks with boosters (e.g., Diamond=3x + special=2x = 5x).
- Auth: Registration with email verification, login, forgot password; roles (user, admin, moderator).
- Features: XP leaderboards, daily/weekly tasks, audit logs, notifications, caching.
- Non-Functional: Scalability (indexes), security (anti-cheat, verified users), API testing.
- Constraints: Node.js, MongoDB, Mongoose; explicit groups; no booleans; extend existing dirs.

#### 1.2 Setup & Integration
- Clone: `git clone https://github.com/Ghofran565/Real-time-Leaderboard-backend.git`.
- Install: `npm install express-validator express-rate-limit nodemailer socket.io winston redis`.
- Update `.env`: JWT_SECRET, EMAIL_CREDS, MONGO_URI, REDIS_URL, PORT.
- Seed: Tasks (global, tournament, time-bound), ranks (with boosters), groups (with boosters), tournaments (with tournamentGroups) via Utilities/seed.js.
- Verify: Run `npm run server`; test `/api/auth`, `/api/scores`, `/api/leaderboards`, `/api/tournament`.

### 2. Development Phases
#### 2.1 Authentication & Roles (Week 1)
- Register (`POST /api/auth/register`): Validate inputs, hash password, send verification email, set verified=false.
- Verify (`POST /api/auth/verify-email`): Check token, set verified=true.
- Login (`POST /api/auth/login`): Return JWT (playerId, role, rank, groups, verified).
- Forgot Password: `POST /api/auth/forgot-password` (send link), `POST /api/auth/reset-password` (update password).
- Middlewares: JWT (auth.js), role restrictions (role.js), verified user check (verified.js).

#### 2.2 Task & Tournament Management (Week 2)
- Tasks: Define schema; implement `GET /api/tasks/assigned` (filter by groups, playersBypass, tournament, time), `POST /api/tasks/:taskId/complete` (base/boosted XP), admin endpoints.
- Tournaments: Extend schema; add `POST /api/tournaments/:tournamentId/join` (rank/group check), `POST /api/tournaments/:tournamentId/tasks/complete`, admin endpoints.
- Time Validation: Check task startTime/endTime.
- Boosters: Apply to regular tasks during tournaments (rank + group).
- Caching: Redis for task lists.

#### 2.3 Progress, Ranks, Leaderboards, Security (Week 3)
- Players: `GET /api/players/:playerId/progress`, `GET /api/players/:playerId/rank`, admin endpoints.
- Ranks: Update based on totalXp; assign groups (e.g., "dedicated").
- Leaderboards: Extend `GET /api/leaderboards` for XP/tournament rankings; Socket.io updates.
- Security: Validate inputs, rate limit, anti-cheat, verified user checks.
- Notifications: Email for verification, rank-ups, tournaments.

#### 2.4 Testing & Deployment (Week 4)
- Tests: Unit (schemas, algorithms), integration (full flows), security (unauthorized, rate limits, unverified).
- Deploy: Docker, MongoDB Atlas, Redis, Nginx.
- Monitor: `GET /api/health`, PM2, Prometheus, logs.

### 3. Future Enhancements
- Dynamic tasks: Auto-generate daily/weekly/tournament.
- Tournaments: Brackets, multi-stage.
- Analytics: XP trends (Utilities/analytics.js).
- Scaling: RabbitMQ for async tasks.
- Social: Share ranks/scores.

### 4. Timeline (4 Weeks)
- Week 1: Setup, auth (register, verify, login, reset), schemas.
- Week 2: Task/tournament endpoints, time validation, boosters.
- Week 3: Progress, ranks, leaderboards, security, notifications.
- Week 4: Testing, deployment, monitoring.

### 5. Notes
- Style: Modular, async/await, API testing; reuse auth/scores/leaderboards.
- Tournament: Dedicated tasks (no boosters), restricted registration add exclusivity.
- Security: Validate boosters, registration, time, verification; log actions.
- Testing: Postman-driven; extend workspace.
- Docs: Update README; add Swagger.
- Backup: Git commits; MongoDB dumps.
- Additional: Socket.io for real-time; Redis for performance; notifications for engagement; audit logs for transparency.

## Improvements and Enhancements

### Clarity & Documentation
- **Diagrams**:  
  - Add an Entity Relationship Diagram (ERD) for models: Players, Tasks, Ranks, Groups, Tournaments, Tokens, AuditLogs.  
  - Include flowcharts for algorithms: Task Eligibility, XP Calculation, Rank Update, Tournament Registration.  
  - These visuals make onboarding faster for new developers.  

- **API Examples**:  
  Add sample requests and responses for clarity. For example:  

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

---

### Security
- Implement **JWT refresh tokens with rotation** for long-lived sessions. Store refresh tokens securely (e.g., Redis).  
- Add **role-based audit logging** to flag suspicious admin actions (e.g., mass player rank changes).  

---

### Performance
- Define **Redis eviction policies**: Use LRU (Least Recently Used) with TTLs for leaderboards and task lists.  
- Plan for **MongoDB sharding** on Players and Leaderboards collections if scaling to millions of users.  

---

### Testing
- Add **load testing** tools like k6 or Artillery to simulate thousands of concurrent players.  
- Automate **end-to-end (E2E) tests** with GitHub Actions CI/CD pipeline. Example jobs: lint → test → build → deploy.  

---

### Deployment
- Add a **staging environment** (pre-production) for testing features before live deployment.  
- Set up **alerts and notifications**: Slack/Discord integration for errors, performance issues, and downtime alerts.  

---

## Final Notes
With these enhancements, the roadmap becomes production-grade and highly maintainable. The additions ensure scalability, stronger security, real-time monitoring, and improved collaboration across teams.
