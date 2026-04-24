# ReadyOn Time-Off Microservice

This is a production-grade Time-Off Microservice that synchronizes balances with an external HCM system.

## Features Built
- **NestJS Architecture**: Clean, modular code following Domain-Driven Design principles.
- **SQLite Database**: File-based database with TypeORM (`better-sqlite3`).
- **Authentication**: Full JWT and Role-Based Access Control (EMPLOYEE, MANAGER).
- **Concurrency Control**: Optimistic locking (`@VersionColumn`) to prevent race conditions when deducting balances.
- **Dual Sync Strategy**: 
  - Real-time API verification on request approval.
  - Asynchronous Batch Sync for out-of-band updates (like anniversaries).
- **Mock HCM Server**: Standalone Express server simulating real-world latency, occasional errors, and unpredictable balance mutations.
- **Comprehensive Tests**: High test coverage using Jest for both Unit and E2E testing.
- **Audit Logging**: Every state change is recorded for traceability.

## Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- npm

### 1. Mock HCM Server Setup
Open a terminal and start the mock server:
```bash
cd mock-hcm
npm install
npm start
```
*The mock server will run on `http://localhost:3001`.*

### 2. Main Microservice Setup
Open a second terminal for the main app:
```bash
npm install
npm run start:dev
```
*The main NestJS app will run on `http://localhost:3000`.*

## Testing
**Unit Tests with Coverage Report:**
```bash
npm run test:cov
```
**E2E Tests:**
```bash
npm run test:e2e
```

## Manual Verification Walkthrough
1. **Import Postman Collection**: Import `ReadyOn.postman_collection.json`.
2. **Register & Login**: Register a Manager and Employee, then Login as Manager to get a token.
3. **Seed Data**: Run the `Inject Balance (HCM Mock Admin)` request to set 10 days for an employee.
4. **Sync**: Run `Batch Sync` to bring that balance into the microservice.
5. **Request**: Login as Employee and `Submit Request` for 3 days.
6. **Approve**: Login as Manager and `Approve Request`. Verify local balance is now 7.

## Postman Collection
A pre-configured Postman collection is included in the root: [ReadyOn.postman_collection.json](./ReadyOn.postman_collection.json).

## Documentation
Please refer to `docs/TRD.md` for the full Technical Requirement Document.
