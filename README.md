# Transaction Webhook Service

A backend service that receives transaction webhooks, acknowledges them immediately, and processes transactions asynchronously using a background job queue.

The service is designed to provide fast webhook responses, reliable transaction processing, duplicate prevention, and transaction status tracking.

## Features

- **Fast webhook acknowledgment:** Accepts valid transaction webhooks and responds with HTTP `202 Accepted` without waiting for transaction processing to finish.
- **Asynchronous processing:** Uses BullMQ and Redis to process transactions in the background.
- **Simulated processing delay:** Introduces a 30-second delay to simulate an external payment or banking API call.
- **Duplicate prevention:** Uses a unique transaction ID in PostgreSQL and BullMQ job IDs to prevent duplicate transaction processing.
- **Transaction status tracking:** Maintains transaction statuses throughout the processing lifecycle.
- **Transaction retrieval:** Retrieve an individual transaction or list transactions with pagination and optional status filtering.
- **Input validation:** Validates incoming webhook payloads and query parameters using Zod.
- **Centralized error handling:** Provides consistent API error responses.
- **Structured logging:** Uses Pino for application and HTTP request logging.
- **Graceful shutdown:** Handles application shutdown and closes database, Redis, queue, worker, and HTTP server connections.
- **Dockerized local environment:** Uses Docker Compose to run the application, PostgreSQL, and Redis locally.
- **Containerized production deployment:** Packages the application into a Docker image and publishes it to Amazon ECR.
- **Automated CI/CD:** Uses GitHub Actions to run tests, build Docker images, publish them to ECR, and deploy them to EC2 through AWS Systems Manager.
- **HTTPS support:** Uses Nginx as a reverse proxy and Let's Encrypt for SSL/TLS certificates.

## Technology Stack

| Technology          | Purpose                                      |
| ------------------- | -------------------------------------------- |
| Node.js 24          | JavaScript runtime                           |
| TypeScript 7        | Type-safe application development            |
| Express 5           | HTTP server and API routing                  |
| PostgreSQL          | Persistent transaction storage               |
| Prisma 8 (RC)       | Database access and data contract management |
| Redis               | Background job queue storage                 |
| BullMQ 6            | Asynchronous job processing                  |
| Zod 4               | Request and environment validation           |
| Pino 10             | Structured application logging               |
| Vitest 5            | Unit testing                                 |
| Docker              | Application containerization                 |
| Docker Compose      | Multi-container orchestration                |
| AWS ECR             | Docker image registry                        |
| AWS EC2             | Application hosting                          |
| AWS Systems Manager | Remote deployment command execution          |
| GitHub Actions      | CI/CD automation                             |
| Nginx               | Reverse proxy and HTTPS termination          |
| Let's Encrypt       | SSL/TLS certificates                         |

## Architecture

The application separates synchronous webhook handling from asynchronous transaction processing.

### Webhook request flow

1. The client sends a transaction webhook.
2. Express receives the request and validates the payload.
3. The service checks whether the transaction already exists.
4. If it is a new transaction, it is persisted in PostgreSQL with `PENDING` status.
5. A background job is added to the BullMQ queue.
6. The API immediately responds with HTTP `202 Accepted`.

### Background processing flow

1. The BullMQ worker picks up the queued job.
2. The transaction status changes from `PENDING` to `PROCESSING`.
3. The worker simulates an external API call using a 30-second delay.
4. On successful processing, the transaction status changes to `PROCESSED`.
5. If processing fails after the configured retry attempts, the transaction is marked as `FAILED`.

### High-level architecture

```text
                    Client
                      |
                      | POST /v1/webhooks/transactions
                      v
                  Express API
                      |
                Request Validation
                      |
               Transaction Service
                      |
                  PostgreSQL
                   (PENDING)
                      |
                      v
                  BullMQ Queue
                      |
                    Redis
                      |
                      v
               Background Worker
                      |
               Simulated API Call
                  (30 seconds)
                      |
                      v
                  PostgreSQL
              (PROCESSED / FAILED)
```

### Deployment architecture

**Local development**

```text
                 Docker Compose
                      |
          +-----------+-----------+
          |           |           |
       Express    PostgreSQL    Redis
        API        Container   Container
          |
     BullMQ Worker
```

**Production – AWS EC2**

```text
                       Internet
                          |
                          v
                  Cloudflare DNS
                          |
                          v
                EC2 Elastic IP Address
                          |
                          v
                      Nginx
                     (80/443)
                          |
                          v
                  Docker Container
                    (Port 3000)
                          |
                 +--------+--------+
                 |                 |
                 v                 v
            Express API      BullMQ Worker
                 |                 |
                 +--------+--------+
                          |
                 +--------+--------+
                 |                 |
                 v                 v
          Cloud PostgreSQL    Cloud Redis
```

**Production – Render**

```text
                       Internet
                          |
                          v
                       Render
                          |
                 +--------+--------+
                 |                 |
                 v                 v
            Express API      BullMQ Worker
                 |                 |
                 +--------+--------+
                          |
                 +--------+--------+
                 |                 |
                 v                 v
          Cloud PostgreSQL    Cloud Redis
```

### CI/CD architecture

GitHub Actions automates the build, image publishing, and EC2 deployment process.

```text
                  Developer
                      |
                      | Push to main
                      v
                 GitHub Repository
                      |
                      v
                 GitHub Actions
                      |
                +-----+------+
                |            |
                v            v
           Build & Test   Build Docker Image
                              |
                              v
                         Amazon ECR
                              |
                              v
                     AWS Systems Manager
                              |
                              v
                         EC2 Instance
                              |
                      Pull Latest Image
                              |
                              v
                       Docker Compose
                              |
                              v
                      Restart Application
                              |
                              v
                       Health Verification
```

## Transaction Lifecycle

```text
PENDING
   |
   v
PROCESSING
   |
   +----------> PROCESSED
   |
   +----------> FAILED
```

## API Endpoints

**Production Base URL (AWS EC2):**

```text
https://webhook-api.srujanjapthi.me
```

**Production Base URL (Render):**

```text
https://transaction-webhook-service-walnut-folks.onrender.com
```

**Local Base URL:**

```text
http://localhost:3000
```

### 1. Receive Transaction Webhook

**Endpoint:** `POST /v1/webhooks/transactions`

Accepts a transaction webhook, persists the transaction, and schedules asynchronous processing.

Example request:

```json
{
  "transaction_id": "txn_100001",
  "source_account": "ACC_1001",
  "destination_account": "ACC_2001",
  "amount": 1500.5,
  "currency": "INR"
}
```

Successful response:

**HTTP 202 Accepted**

```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_100001",
    "duplicate": false
  }
}
```

Submitting the same transaction again does not create another transaction record. Existing transactions are handled according to their current status.

### 2. Get Transaction by ID

**Endpoint:** `GET /v1/transactions/:transaction_id`

Retrieves the details and current processing status of a transaction.

Example:

```http
GET /v1/transactions/txn_100001
```

### 3. List Transactions

**Endpoint:** `GET /v1/transactions`

Retrieves transactions with pagination and optional status filtering.

Supported query parameters:

| Parameter | Description                              | Default      |
| --------- | ---------------------------------------- | ------------ |
| `page`    | Page number                              | 1            |
| `limit`   | Number of records per page (maximum 100) | 10           |
| `status`  | Filter by transaction status             | All statuses |

Example:

```http
GET /v1/transactions?page=1&limit=10&status=PROCESSED
```

### 4. Health Check

**Endpoint:** `GET /`

Returns the current health status of the application.

Example response:

**HTTP 200 OK**

```json
{
  "status": "HEALTHY",
  "current_time": "2026-11-08T17:08:07.033Z"
}
```

## Project Structure

```text
transaction-webhook-service/
├── src/
│   ├── config/
│   ├── constants/
│   ├── lib/
│   ├── middleware/
│   ├── models/
│   ├── modules/
│   ├── prisma/
│   ├── queues/
│   ├── scripts/
│   ├── types/
│   ├── utils/
│   ├── workers/
│   ├── app.ts
│   └── server.ts
├── tests/
├── postman/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
├── package-lock.json
├── prisma-8.md
├── prisma.config.ts
├── README.md
└── tsconfig.json
```

## Prerequisites

The application supports two local development approaches: running everything using Docker Compose or running the Node.js application directly on your machine.

### Option 1: Using Docker Compose

Required software:

- Docker Engine
- Docker Compose plugin

No separate installation of Node.js, PostgreSQL, or Redis is required on the host machine. Docker Compose runs the application and its supporting services in containers.

### Option 2: Without Docker

Required software:

| Software   | Requirement             | Purpose                                      |
| ---------- | ----------------------- | -------------------------------------------- |
| Node.js    | 24+                     | Runs the application and development tooling |
| npm        | Included with Node.js   | Dependency management and scripts            |
| PostgreSQL | 15+                     | Persistent transaction storage               |
| Redis      | Compatible Redis server | BullMQ job queue storage                     |

PostgreSQL and Redis must be installed and running separately, either locally or through managed services.

## Environment Configuration

Create a `.env` file in the project root using `.env.example` as a reference.

The connection URLs differ between local development and production.

### Local development

**When using Docker Compose:**

The local Docker Compose configuration starts PostgreSQL and Redis as containers.

Example local configuration:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/transaction_service
REDIS_URL=redis://redis:6379
LOG_LEVEL=info
```

The hostnames `postgres` and `redis` resolve to the respective services inside the Docker Compose network.

**When running without Docker:**

If PostgreSQL and Redis are installed directly on your machine, use their local connection URLs.

Example:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transaction_service
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

Make sure the PostgreSQL database exists and both services are running.

### Production

The production configuration connects to managed PostgreSQL and Redis services.

Example production configuration:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=your_managed_postgresql_connection_url
REDIS_URL=your_managed_redis_connection_url
LOG_LEVEL=info
```

Replace the example values with the actual connection URLs provided by your cloud database and Redis providers.

Keep production credentials private. Never commit `.env` files or cloud connection strings to GitHub.

## Running Locally with Docker Compose

The local configuration runs the application, PostgreSQL, Redis, and the database initialization service.

### 1. Clone the repository

```bash
git clone https://github.com/srujanjapthi/transaction-webhook-service-walnut-folks.git

cd transaction-webhook-service-walnut-folks
```

### 2. Configure environment variables

Create a `.env` file in the project root using the local Docker configuration shown in the Environment Configuration section.

### 3. Start the services

```bash
docker compose up --build
```

Docker Compose performs the following steps:

1. Starts PostgreSQL and waits for its health check.
2. Runs the `db-init` service to initialize the database using the configured Prisma 8 workflow.
3. Starts Redis and waits for its health check.
4. Starts the application after database initialization and Redis readiness.

The API is available at:

```text
http://localhost:3000
```

### 4. Run in the background

```bash
docker compose up --build -d
```

### 5. View application logs

```bash
docker compose logs -f app
```

View individual service logs:

```bash
docker compose logs -f postgres
docker compose logs -f redis
```

### 6. Stop the services

```bash
docker compose down
```

This removes the containers and network while preserving PostgreSQL and Redis data in their Docker volumes.

To remove the project's containers and images:

```bash
docker compose down --rmi all
```

To also remove persistent database and Redis data:

```bash
docker compose down --rmi all --volumes
```

**Warning:** Removing volumes permanently deletes the local PostgreSQL and Redis data.

## Running Locally Without Docker

This approach runs the Node.js application directly on your machine. PostgreSQL and Redis must already be installed and running.

### 1. Clone the repository

```bash
git clone https://github.com/srujanjapthi/transaction-webhook-service-walnut-folks.git

cd transaction-webhook-service-walnut-folks
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Create a `.env` file in the project root using `.env.example` as a reference.

Configure the connection URLs for your local PostgreSQL and Redis instances.

Example:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transaction_service
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

### 4. Initialize Prisma Client

Generate the Prisma Client:

```bash
npm run db:generate
```

### 5. Apply database migrations

Make sure PostgreSQL is running and the configured database exists.

Run:

```bash
npm run db:migrate
```

This executes the Prisma development migration workflow.

### 6. Start the application

Development mode:

```bash
npm run dev
```

The application runs using `tsx` and automatically restarts when source files change.

For a production build:

```bash
npm run build
npm start
```

The server will start on the configured port.

## Production Deployment

The application has two production deployments: AWS EC2 and Render.

Both deployments run the same application and connect to managed PostgreSQL and Redis services.

### 1. AWS EC2 Deployment

The primary deployment uses Amazon EC2, Amazon ECR, Docker, and AWS Systems Manager.

**Production URL:**

https://webhook-api.srujanjapthi.me/

#### Infrastructure

| Component          | Service             | Responsibility                                      |
| ------------------ | ------------------- | --------------------------------------------------- |
| DNS                | Cloudflare          | Domain and DNS management                           |
| Compute            | AWS EC2             | Hosts the application                               |
| Container Registry | Amazon ECR          | Stores Docker images                                |
| Container Runtime  | Docker              | Runs the application container                      |
| Orchestration      | Docker Compose      | Starts and manages the production container         |
| Reverse Proxy      | Nginx               | Routes HTTP/HTTPS traffic to the application        |
| SSL/TLS            | Let's Encrypt       | Provides HTTPS certificates                         |
| Database           | Managed PostgreSQL  | Persistent transaction storage                      |
| Queue Storage      | Managed Redis       | BullMQ job storage                                  |
| Deployment         | AWS Systems Manager | Executes deployment commands on EC2                 |
| CI/CD              | GitHub Actions      | Automates testing, image publishing, and deployment |

#### Docker Image Publishing

The application is packaged into a Docker image using the project's `Dockerfile`.

GitHub Actions builds the image and publishes it to the private Amazon ECR repository:

```text
000540852340.dkr.ecr.ap-south-1.amazonaws.com/transaction-webhook-service
```

Each image is published with two tags:

- `latest` – identifies the latest published image.
- Git commit SHA – identifies the specific source revision used to build the image.

The Docker image is built on the GitHub Actions runner. The EC2 instance only pulls and runs the published image; it does not need to build the application from source.

#### CI/CD Pipeline

The GitHub Actions workflow is defined in:

```text
.github/workflows/ci.yml
```

The pipeline is triggered by pushes and pull requests targeting the `main` branch.

It consists of three jobs.

**1. Build and Test**

- Checks out the repository.
- Sets up Node.js 24.
- Installs dependencies using `npm ci`.
- Runs the TypeScript build.
- Executes the unit test suite.

**2. Build and Push Docker Image**

Runs after the build and test job succeeds.

- Authenticates with AWS using GitHub OIDC.
- Logs in to Amazon ECR.
- Builds the Docker image using Docker Buildx.
- Pushes the image to the ECR repository with `latest` and commit SHA tags.

This job runs only for pushes to `main`, not pull requests.

**3. Deploy to EC2**

Runs after the image publishing job succeeds.

- Authenticates with AWS using GitHub OIDC.
- Sends a deployment command to the EC2 instance using AWS Systems Manager.
- The EC2 instance authenticates with Amazon ECR using its IAM instance role.
- Pulls the latest Docker image.
- Restarts the application using Docker Compose.
- Performs a health check against the application.
- Reports deployment success or failure to GitHub Actions.

This job also runs only for pushes to `main`.

#### AWS Authentication

The deployment uses IAM roles instead of storing long-lived AWS access keys in GitHub.

**GitHub Actions authentication:**

GitHub Actions uses OpenID Connect (OIDC) to assume the `GitHubActionsTransactionServiceRole` IAM role.

This role provides permissions required to:

- Authenticate with Amazon ECR.
- Push Docker images to the application repository.
- Send deployment commands through AWS Systems Manager.
- Retrieve deployment command execution results.

**EC2 authentication:**

The EC2 instance uses an attached IAM instance role, `TransactionServiceEC2Role`, to:

- Authenticate with Amazon ECR.
- Pull the application Docker image.
- Communicate with AWS Systems Manager.

#### EC2 Deployment Configuration

The production Docker Compose configuration is maintained in the GitHub repository:

```text
docker-compose.prod.yml
```

The EC2 instance retrieves this configuration and keeps it alongside the production environment file.

Deployment directory:

```text
/opt/transaction-webhook-service/
├── .env
└── docker-compose.prod.yml
```

The `.env` file contains the production database and Redis connection URLs and is stored directly on EC2 with restricted file permissions.

The production Compose configuration references the ECR image rather than building the application on the EC2 instance.

#### Networking and HTTPS

The application runs inside a Docker container and listens on port `3000`.

Nginx runs on the EC2 instance and acts as a reverse proxy:

```text
                  Internet
                     |
                     v
        webhook-api.srujanjapthi.me
                     |
                     v
                  Nginx
                (Port 80/443)
                     |
                     v
           Docker Application
                 (Port 3000)
```

- Cloudflare manages DNS for the custom domain.
- An AWS Elastic IP provides a stable public IPv4 address for EC2.
- Nginx forwards incoming requests to the application on `localhost:3000`.
- Let's Encrypt provides the SSL/TLS certificate.
- HTTP requests are redirected to HTTPS.
- Port `3000` is not publicly exposed; external application traffic enters through Nginx on ports `80` and `443`.

### 2. Render Deployment

The application is also deployed as a Render web service.

**Deployment URL:**

https://transaction-webhook-service-walnut-folks.onrender.com/

The Render deployment is maintained separately from the AWS EC2 deployment.

It uses managed PostgreSQL and Redis services for persistent transaction storage and background job processing.

#### Important: Initial Request Delay

The Render service runs on the free tier and spins down after **15 minutes of inactivity**.

When the service has been inactive for this period, Render puts it into a suspended state. When a new request arrives, the service needs to start up again.

As a result:

- The first request after inactivity may take noticeably longer than usual.
- Subsequent requests should be faster while the service remains active.
- This initial delay is expected behavior and does not necessarily indicate an application error.

## Testing

Run the unit test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

The unit tests cover the core application logic, including:

- Transaction creation and duplicate handling.
- Queue job creation.
- Transaction retrieval and serialization.
- Pagination and filtering.
- Background worker processing.
- Transaction status transitions.
- Worker retry and failure handling.
- Request body and query validation.

Supertest is included for HTTP-level testing utilities.

## Technical Decisions

### 1. Asynchronous processing with BullMQ

Transaction processing can involve slow external services. Performing this work directly inside the webhook request would increase response latency and could cause request timeouts.

BullMQ allows the API to acknowledge requests quickly while background workers handle the actual processing.

### 2. Redis as the queue backend

Redis provides the storage and coordination required by BullMQ to manage queued jobs, worker execution, and job states.

### 3. PostgreSQL for persistent storage

Transaction records need durable storage and reliable uniqueness constraints.

PostgreSQL provides relational data integrity and supports efficient querying and pagination.

### 4. Prisma 8 for database access

Prisma provides a typed database contract and a structured way to interact with PostgreSQL.

### 5. Idempotency and duplicate prevention

A transaction ID is treated as a unique identifier.

The database unique constraint prevents duplicate transaction records, while BullMQ job IDs help avoid duplicate queued jobs for the same transaction.

### 6. Zod for validation

Zod validates incoming webhook payloads, query parameters, and environment variables at runtime.

Invalid requests are rejected before reaching the business logic.

### 7. Separation of concerns

The application follows a modular structure:

- **Routes:** Define API endpoints and middleware.
- **Controllers:** Handle HTTP requests and responses.
- **Services:** Contain business logic and coordinate operations.
- **Repositories:** Handle database operations.
- **Workers:** Execute background jobs.
- **Queues:** Manage job creation and configuration.

This separation makes the application easier to maintain, test, and extend.

### 8. Structured logging with Pino

Pino provides structured JSON logs with request details, processing information, and error context. This helps with debugging and production observability.

### 9. Docker Compose for local development

Docker Compose provides a reproducible local environment by running the application, PostgreSQL, and Redis together.

### 10. Containerized deployment with Amazon ECR

Building the Docker image in GitHub Actions and storing it in ECR separates application building from production execution.

The EC2 instance pulls a prebuilt image instead of compiling the application on the production server.

### 11. Automated deployment through AWS Systems Manager

AWS Systems Manager allows GitHub Actions to execute deployment commands on EC2 without exposing SSH access to the CI/CD pipeline or storing SSH private keys in GitHub.

### 12. Nginx as a reverse proxy

Nginx provides a public entry point for the application and forwards requests to the internal application port.

It also handles HTTPS termination, keeping the application container independent of SSL certificate management.

## Author

**Srujan S Padmashali**

GitHub: https://github.com/srujanjapthi
