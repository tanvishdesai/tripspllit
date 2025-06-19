

# Project TripSplit: Task Tracker

This document tracks the development tasks for the TripSplit application.

## Milestones

1.  **M1: Project Foundation & User Authentication** - Setup the core project and get users signing up and logging in.
2.  **M2: Core Trip & Expense Functionality** - Implement the ability to create trips and log expenses.
3.  **M3: Settlement & UPI Payment Flow** - Develop the settlement calculation logic and the UPI payment link generation.
4.  **M4: Polish, Testing & Deployment** - Finalize the UI/UX and deploy to production.

---

### **Active Work & Backlog**

#### Milestone 1: Project Foundation & User Authentication (In Progress)

*   `[x]` Initialize Next.js 14 project with TypeScript and Tailwind CSS.
*   `[ ]` Setup Vercel project and link to GitHub repository.
*   `[ ]` Provision a Vercel Postgres database and connect it to the Vercel project.
*   `[ ]` Setup Prisma ORM and define initial `User` schema (`name`, `email`, `password`, `upiId`).
*   `[ ]` Run initial Prisma migration to create the `User` table.
*   `[ ]` Integrate `Next-Auth.js` for authentication.
    *   `[ ]` Configure an Email/Password provider.
    *   `[ ]` Create the sign-up page/form with a required `upiId` field.
    *   `[ ]` Create the login page/form.
    *   `[ ]` Create a protected `/dashboard` route that only logged-in users can see.
*   `[ ]` Build a basic navigation bar showing login/logout status.

#### Milestone 2: Core Trip & Expense Functionality (Backlog)

*   `[ ]` **Database:** Define `Trip`, `Expense`, and `TripUser` schemas in Prisma and migrate the database.
*   `[ ]` **API:** Create API route for creating a new trip (`POST /api/trips`).
*   `[ ]` **API:** Create API route for fetching a user's trips (`GET /api/trips`).
*   `[ ]` **API:** Create API route for adding an expense to a trip (`POST /api/trips/[tripId]/expenses`).
*   `[ ]` **UI:** Build the user dashboard to list all their trips.
*   `[ ]` **UI:** Create a "New Trip" form.
*   `[ ]` **UI:** Build the individual trip page (`/trips/[tripId]`).
    *   `[ ]` Display trip name and members.
    *   `[ ]` List all expenses with title, amount, and who paid.
    *   `[ ]` Create an "Add Expense" form/modal on this page.
*   `[ ]` **Functionality:** Implement logic to invite/add friends to a trip (future enhancement could be by email).

#### Milestone 3: Settlement & UPI Payment Flow (Backlog)

*   `[ ]` **API:** Create a new API route for settlement calculation (`GET /api/trips/[tripId]/settle`).
*   `[ ]` **Backend Logic:** Implement the settlement algorithm in the API route.
    *   `[ ]` Fetch all expenses for the trip.
    *   `[ ]` Fetch all users in the trip.
    *   `[ ]` Calculate total cost and per-person share.
    *   `[ ]` Calculate the balance for each user (`spent - share`).
    *   `[ ]` **Crucial:** Implement a debt simplification algorithm to find the minimum number of transactions needed to settle up. (This prevents A->B, B->C, C->A cycles).
    *   `[ ]` The API should return a simple array of transactions: `[{ from: User, to: User, amount: Number }]`.
*   `[ ]` **UI:** Create a "Settle Up" tab/page within a trip.
*   `[ ]` **UI:** Display the simplified settlement plan clearly (e.g., "You owe John $25", "Jane owes you $10").
*   `[ ]` **UI:** For each payment the current user needs to make, display a "Pay with UPI" button.
*   `[ ]` **Functionality:** Clicking the button should generate the correct `upi://pay?pa=...` URL and set it as the `href` of an anchor tag.

#### Milestone 4: Polish, Testing & Deployment (Backlog)

*   `[ ]` Add loading states for all data-fetching operations (e.g., spinners, skeletons).
*   `[ ]` Add comprehensive error handling and user feedback (e.g., using toasts for success/error messages).
*   `[ ]` Ensure the application is fully responsive and works well on mobile devices.
*   `[ ]` Conduct end-to-end testing of the entire user flow.
*   `[ ]` Set up production environment variables on Vercel.
*   `[ ]` Deploy the `main` branch to the production Vercel URL.

### Discovered Mid-Process / Future Ideas

*   **Mark as Settled:** Add a feature for the recipient to mark a payment as received, which would update the UI.
*   **Uneven Splits:** Allow expenses to be split unevenly (e.g., one person pays for their meal + someone else's). This significantly complicates the settlement logic. Defer for v2.
*   **Notifications:** Email notifications when a user is added to a trip or when a settlement is calculated.
*   **Transaction History:** Keep a record of past settlements.