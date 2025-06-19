
# Project TripSplit: Planning & Architecture

## 1. High-Level Vision

**Project TripSplit** is a web application designed to simplify expense tracking for groups of friends on a trip. The core idea is to create a central place where any member can log expenses they've paid for the group. At the end of the trip, the application will automatically calculate who owes whom and provide a simplified settlement plan.

A key feature is the direct UPI integration, which allows users to settle their debts seamlessly by generating a pre-filled payment link that opens their preferred UPI application.

## 2. Core Features

*   **User Authentication:** Users can sign up with an email and password. During signup, they must provide their UPI ID.
*   **Trip Management:** Users can create a new "trip" and invite friends to join.
*   **Expense Logging:** Any member of a trip can add an expense, specifying the amount and a title (e.g., "$50 - Dinner").
*   **Live Dashboard:** A real-time view of all expenses for a trip, showing who paid for what.
*   **Settlement Calculation:** A dedicated "Settle Up" feature that calculates:
    1.  The total trip cost.
    2.  The equal share per person.
    3.  The net balance for each person (amount spent - equal share).
    4.  A simplified list of transactions required to settle all debts (e.g., "Alice pays Charlie $15" instead of a complex web of payments).
*   **UPI Payment Integration:** For each required payment, a "Pay with UPI" button generates a UPI deep link, which, when clicked on a mobile device, opens the user's UPI app with the recipient's UPI ID and the exact amount pre-filled.

## 3. Architecture

This project will follow a modern, serverless architecture to meet the constraint of using only Vercel for hosting.

*   **Frontend:** A **Next.js** application. This will handle all UI, routing, and user-facing interactions. It will be deployed on **Vercel**.
*   **Backend:** **Next.js API Routes**. Instead of a traditional, always-on server (like Express.js on a VM), we will use serverless functions for our backend logic. These are JavaScript/TypeScript files in the `/pages/api` directory of our Next.js project. Vercel automatically deploys these as globally distributed serverless functions. This is "self-hosted" in the sense that the code is yours and within your project, but you don't manage the underlying server infrastructure.
*   **Database:** **Vercel Postgres**. This is a serverless PostgreSQL database that integrates directly with Vercel. It provides a real, robust SQL database without you needing to host it separately. It's the perfect solution for your "self-hosted database but no hosting provider" requirement.

### Architectural Flow:

```
User's Browser  <-->  Vercel (Next.js Frontend)
                      |
                      | (API Calls)
                      V
                  Vercel (Next.js API Routes / Serverless Functions)
                      |
                      | (Database Queries via Prisma)
                      V
                  Vercel Postgres (Serverless Database)
```

## 4. Tech Stack & Tools

*   **Framework:** **Next.js 14** (App Router)
*   **Language:** **TypeScript**
*   **Styling:** **Tailwind CSS** (for rapid UI development)
*   **UI Components:** **Shadcn/ui** (accessible and composable components)
*   **Database:** **Vercel Postgres**
*   **ORM:** **Prisma** (for type-safe database access and schema management)
*   **Authentication:** **Next-Auth.js (v5 / Auth.js)** (for secure and easy handling of user sessions)
*   **Deployment:** **Vercel**

## 5. UPI Integration Deep Dive

The "fully functioning UPI integration" does **not** mean our app will become a payment processor or a PSP (Payment Service Provider). This would require immense legal and technical overhead.

Instead, we will use **UPI Deep Linking (Intent URLs)**. This is a standardized URL format that mobile operating systems recognize.

**How it works:**

1.  Our application will calculate that User A needs to pay User B ₹500.
2.  User B's UPI ID (`user-b@bank`) is stored in our database.
3.  We will generate a link (an `<a>` tag) with an `href` like this:
    `upi://pay?pa=user-b@bank&pn=User%20B&am=500.00&tn=Settlement%20for%20Goa%20Trip&cu=INR`
4.  When User A clicks this link on their phone:
    *   Their phone's OS will prompt them to choose a UPI app (GPay, PhonePe, Paytm, etc.).
    *   The chosen app will open with the payment details (Recipient UPI ID, Name, Amount, Note) already filled in.
    *   User A just needs to verify the details and enter their UPI PIN to complete the payment.

Our application's responsibility is to **generate the correct URL**. The actual transaction is handled securely between the user's bank and the recipient's bank via their UPI app.

## 6. Data Models (Schema)

We will define our database schema using Prisma.

*   **`User`**: `id`, `name`, `email`, `password`, `upiId`
*   **`Trip`**: `id`, `name`, `createdAt`, `ownerId`
*   **`Expense`**: `id`, `title`, `amount`, `createdAt`, `tripId`, `paidById`
*   **`TripUser`** (Join Table): To link users to trips (`userId`, `tripId`)

---

