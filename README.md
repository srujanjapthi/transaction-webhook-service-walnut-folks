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

## Technology Stack

| Technology | Purpose                                      |
| ---------- | -------------------------------------------- |
| Node.js    | JavaScript runtime                           |
| TypeScript | Type-safe application development            |
| Express 5  | HTTP server and API routing                  |
| PostgreSQL | Persistent transaction storage               |
| Prisma 8   | Database access and data contract management |
| Redis      | Background job queue storage                 |
| BullMQ     | Asynchronous job processing                  |
| Zod        | Request and environment validation           |
| Pino       | Structured application logging               |
| Vitest     | Unit testing                                 |
| Supertest  | HTTP testing utilities                       |

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

Base URL:

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

A health endpoint can be used to verify service availability if configured in the application.

## Project Structure

```text
src/
├── config/
│   └── env.ts
│
├── lib/
│   ├── logger.ts
│   ├── redis.ts
│   └── bullmq-connection.ts
│
├── middleware/
│   ├── validate.middleware.ts
│   ├── error-handler.ts
│   └── not-found.ts
│
├── modules/
│   └── transactions/
│       ├── transaction.schema.ts
│       ├── transaction.locals.ts
│       ├── transaction.repository.ts
│       ├── transaction.service.ts
│       ├── transaction.controller.ts
│       └── transaction.routes.ts
│
├── queues/
│   ├── transaction.queue.ts
│   └── transaction.types.ts
│
├── workers/
│   └── transaction.worker.ts
│
├── prisma/
│   ├── contract.prisma
│   ├── contract.json
│   ├── contract.d.ts
│   └── db.ts
│
├── utils/
│   ├── api-response.ts
│   └── app-error.ts
│
├── constants/
│   └── error-codes.ts
│
├── app.ts
└── server.ts

tests/
└── unit/
    ├── transactions/
    └── middleware/
```

## Prerequisites

Make sure the following are installed:

- Node.js 24+
- npm
- PostgreSQL 15+
- Redis

## Environment Configuration

Create a `.env` file in the project root.

```env
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://postgres:password@localhost:5432/transaction_service"

REDIS_URL="redis://localhost:6379"

LOG_LEVEL=info
```

Update the database credentials according to your local PostgreSQL configuration.

## Running the Application

### 1. Clone the repository

```bash
git clone https://github.com/srujanjapthi/transaction-webhook-service-walnut-folks.git
cd transaction-webhook-service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create the `.env` file using the configuration described above.

### 4. Initialize the database

Make sure PostgreSQL and Redis are running.

Initialize the database using the Prisma 8 workflow configured in the project:

```bash
npx prisma db init
```

### 5. Start the application

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

The server will start on the configured port.

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

## Author

**Srujan S Padmashali**

GitHub: https://github.com/srujanjapthi
