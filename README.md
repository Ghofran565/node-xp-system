# Node.js XP-based tasks system

This repository hosts a **XP-based tasks API** built with Node.js, designed to manage player tasks, XP, tournaments, and a leaderboard with enhanced security and DevOps features.

# Postman's workspace link
- Soon we will put the link for you because this project is in **testing** state
- Whenever the public workspace is ready, we will put the link here even if it is not fully ready

## Project Structure

- **Controllers**: Handles business logic for authentication, tasks, tournaments, players, and leaderboards.
- **Middlewares**: Manages authentication, validation, and role restrictions.
- **Models**: Defines MongoDB schemas for tasks, players, ranks, groups, tournaments, and logs.
- **Routes**: Organizes RESTful API endpoints.
- **Utilities**: Includes helpers for error handling, logging, seeding, notifications, and caching.
- **Tests**: Contains Jest unit and integration tests.

## Installation
- Detailed setup instructions are in the [full README](README_full.md) or consult the team for Docker-based deployment.

## Project Highlights

- **Docker-Ready:** Containerized with Docker for consistent deployment across environments.
- **Redis Caching:** Leverages Redis for high-performance caching of task lists and leaderboards.
- **Comprehensive Testing:** Includes Jest unit and integration tests for schemas, algorithms, and full flows (e.g., register → verify → complete task).
- **GitHub CI/CD:** Automated CI/CD pipeline with GitHub Actions for linting, testing, building, and deploying.
- **Swagger Documentation:** Planned Swagger integration for clear API documentation.
- **Real-time Updates:** Uses Socket.io for real-time leaderboard and player progress updates.
- **Security Features:** Implements JWT authentication, rate limiting, input validation, and anti-cheat mechanisms.
- **Monitoring & Logging:** Winston logging, Prometheus metrics, and PM2 for process management.

## API Endpoints Examples

| Method | Endpoint                | Description                        |
|--------|-------------------------|------------------------------------|
| POST   | `/api/auth/register`    | Register a new user with email verification |
| POST   | `/api/tasks/:taskId/complete` | Complete a task and earn XP |
| GET    | `/api/leaderboards`     | Fetch XP or tournament rankings   |
| GET    | `/api/tournament`       | Get active tournaments            |

(Refer to the respective route files in the `Routes` directory for full details.)

## Development Phase

**Phase**: **Development & Testing**

**Current Focus**:
- Working on Unit testing and Manual testing
- Working on DevOps deployment with CI/CD and monitoring.
- Enhancing security with rate limiting.

## Common Issues

- **Missing Environment Variables**: Ensure all required variables are defined in the `.env` file to prevent runtime errors.

## Contributing

Contributions **are welcome!** Please follow these steps:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a detailed description of your changes.

## License

This project is licensed under the [MIT License](LICENSE).
