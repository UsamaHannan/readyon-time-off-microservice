# Technical Requirement Document (TRD): Time-Off Microservice

## 1. Introduction

The objective of this project is to build a Time-Off Microservice for ReadyOn, serving as the backend for managing employee time-off requests. The critical requirement is to maintain accurate balance synchronization with the Human Capital Management (HCM) system, which remains the single source of truth for employment data.

## 2. Problem Statement & Challenges

### Problem
Keeping time-off balances synchronized between ReadyOn (the request interface) and the HCM system is difficult. ReadyOn must ensure that the user has a sufficient balance for a request, while handling asynchronous updates from the HCM (like anniversary bonuses or new year refreshes) and ensuring consistency.

### Challenges
1.  **Independent HCM Balance Mutations**: The HCM can update balances independently without ReadyOn initiating the change (e.g., anniversary bonus).
2.  **Concurrency Issues**: A user might submit multiple requests quickly, leading to race conditions if local balances are not managed properly.
3.  **Unreliable HCM Error Responses**: The HCM may not consistently return errors for invalid dimensions or insufficient balances. We need a defensive approach.
4.  **Network Unreliability**: Calls to the real-time HCM API may fail, timeout, or drop.

## 3. Architecture & Sync Strategy

The microservice will be built with **NestJS**, utilizing a **SQLite** database via TypeORM for local state management. The API will be RESTful.

### 3.1. Dual Sync Strategy

To address the challenges, we implement a dual synchronization strategy:

1.  **Real-Time Verification (Synchronous)**: When a time-off request is approved, the service makes a real-time call to the HCM to verify the balance before confirming the deduction.
2.  **Batch Reconciliation (Asynchronous)**: A scheduled or webhook-triggered batch process retrieves the entire corpus of balances from the HCM to update local records. This handles out-of-band updates (like anniversary bonuses).

### 3.2. Concurrency & Integrity

*   **Optimistic Locking**: The `TimeOffBalance` entity will use an `@VersionColumn()` to prevent concurrent updates from overwriting each other. If a concurrent update occurs, the second transaction will fail and can be retried.
*   **Shadow Balance**: ReadyOn maintains a local "shadow balance" to provide fast feedback to users without hitting the HCM for every read request.

### 3.3. Defensive Dimension Validation
To handle the challenge of "invalid combination of dimensions" mentioned in the requirements, the microservice explicitly validates the existence of the `locationId` against the local database before allowing a request to be created. If the dimension (location) is invalid, the request is rejected with a `404 Not Found` immediately, saving HCM processing time.

## 4. Data Model (SQLite)

We will maintain the following entities in SQLite:

1.  **User (Employee)**: ID, Email, Password Hash, Role (EMPLOYEE, MANAGER).
2.  **Location**: ID, Name (Balances are per-employee, per-location).
3.  **TimeOffBalance**: EmployeeID, LocationID, Balance (days), Version (for optimistic locking), LastSyncedAt.
4.  **TimeOffRequest**: ID, EmployeeID, LocationID, Type (SICK, CASUAL, ANNUAL), StartDate, EndDate, Days, Status, Version.
5.  **AuditLog**: ID, EntityType, EntityID, Action, OldValue, NewValue, Timestamp.

### 4.1. Time-Off Request Status Lifecycle
*   `PENDING`: Request created by employee.
*   `APPROVED_LOCALLY`: Manager approved, pending HCM sync.
*   `HCM_CONFIRMED`: HCM successfully accepted the request.
*   `REJECTED`: Manager rejected.
*   `HCM_REJECTED`: HCM rejected the request (e.g., insufficient real balance).
*   `CANCELLED`: Cancelled by employee.

## 5. Security & Authentication

A full authentication system is implemented using **JWT (JSON Web Tokens)** and **Passport.js**.
*   **Roles**: `EMPLOYEE` and `MANAGER`.
*   **Guards**: NestJS Guards will restrict access (e.g., only managers can approve requests).
*   Passwords will be hashed using `bcryptjs`.

## 6. API Endpoints

### Auth
*   `POST /auth/register`: Register a new user.
*   `POST /auth/login`: Login and receive a JWT.

### Balances
*   `GET /balances/:employeeId/:locationId`: Get local shadow balance.
*   `POST /balances/sync/batch`: Trigger batch sync from HCM.

### Time-Off Requests
*   `POST /time-off-requests`: Submit a new request (Employee).
*   `GET /time-off-requests`: List requests (Manager views all, Employee views own).
*   `PATCH /time-off-requests/:id/approve`: Approve request and sync to HCM (Manager).
*   `PATCH /time-off-requests/:id/reject`: Reject request (Manager).

## 7. HCM Mock Service

A separate Express.js server will act as the mock HCM, exposing:
*   `GET /api/hcm/balances/:employeeId/:locationId`
*   `POST /api/hcm/time-off`
*   `GET /api/hcm/balances/batch`

The mock will be configurable to simulate errors, latency, and out-of-band balance updates.

## 8. Test Strategy

*   **Unit Tests**: Mocked dependencies to test business logic isolation (e.g., optimistic locking logic, balance deduction math). Focus on Services and Controllers.
*   **Integration Tests**: Test TypeORM queries with an in-memory SQLite database.
*   **End-to-End (E2E) Tests**: Spin up the NestJS app and mock HCM server to test the entire lifecycle (Submit -> Approve -> HCM Confirm). We verified Authentication, Successful Login, and Proper Error Messaging across all controllers.

---
*Prepared by Engineering Team*
