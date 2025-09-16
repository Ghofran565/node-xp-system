# Node-xp-system

This repository hosts a **Node-xp-system** built with Node.js, designed to manage player tasks, XP, tournaments, and game-specific leaderboards with enhanced security and DevOps features.

## Postman's Workspace Link
- The project is still in **Planning** phase, stay tunned
- Whenever the public workspace is ready, we will put the link here even if it is not completed.

## Project Structure

- **Controllers**: Handles business logic for authentication, tasks, tournaments, players, and leaderboards.
- **Middlewares**: Manages authentication, validation, and role restrictions.
- **Models**: Defines MongoDB schemas for tasks, players, ranks, groups, tournaments, and logs.
- **Routes**: Organizes RESTful API endpoints.
- **Utilities**: Includes helpers for error handling, logging, seeding, notifications, and caching.
- **Tests**: Contains Jest unit and integration tests.

## Installation
- Detailed setup instructions are in the [full README](README_full.md) or consult the team for Docker-based deployment.

## API Endpoints Examples

| Method | Endpoint                | Description                        |
|--------|-------------------------|------------------------------------|
| POST   | `/api/auth/register`    | Register a new user with email verification |
| POST   | `/api/tasks/:taskId/complete` | Complete a task and earn XP |
| GET    | `/api/leaderboards`     | Fetch XP or tournament rankings   |
| GET    | `/api/tournament`       | Get active tournaments            |

(Refer to the `Routes` directory for full details.)

## Development Phase

**Phase**: **Planning and Development**

**Current Focus**:
- Implementing authentication, task management, and tournament features.
- Enhancing security with rate limiting and anti-cheat.
- Preparing for DevOps deployment with CI/CD and monitoring.

## Common Issues
- **Missing Environment Variables**: Ensure `.env` is configured in `src` with `PORT`, `MONGO_URI`, `JWT_SECRET`, etc.
- **Docker Build Failures**: Verify `package.json` is in `src` and Dockerfile paths are correct.

## Contributing
Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a detailed description of your changes.

## License
This project is licensed under the [MIT License](LICENSE).