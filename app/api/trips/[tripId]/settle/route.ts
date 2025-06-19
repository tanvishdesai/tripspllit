import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface SettlementTransaction {
  from: {
    id: string
    name: string
    email: string
    upiId: string
  }
  to: {
    id: string
    name: string
    email: string
    upiId: string
  }
  amount: number
}

interface UserBalance {
  userId: string
  user: {
    id: string
    name: string
    email: string
    upiId: string
  }
  totalPaid: number
  share: number
  balance: number
}

// Debt simplification algorithm to minimize transactions
function simplifyDebts(balances: UserBalance[]): SettlementTransaction[] {
  const transactions: SettlementTransaction[] = []
  
  // Create arrays of creditors (positive balance) and debtors (negative balance)
  const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance)
  const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance)
  
  let i = 0, j = 0
  
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]
    const debtor = debtors[j]
    
    const settleAmount = Math.min(creditor.balance, Math.abs(debtor.balance))
    
    if (settleAmount > 0.01) { // Only create transaction if amount is significant
      transactions.push({
        from: debtor.user,
        to: creditor.user,
        amount: Math.round(settleAmount * 100) / 100 // Round to 2 decimal places
      })
      
      creditor.balance -= settleAmount
      debtor.balance += settleAmount
    }
    
    // Move to next creditor or debtor if current one is settled
    if (creditor.balance < 0.01) i++
    if (Math.abs(debtor.balance) < 0.01) j++
  }
  
  return transactions
}

// GET /api/trips/[tripId]/settle - Calculate settlement for a trip
export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get the user from database to get their ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const { tripId } = params

    // Check if trip exists and user is a member
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        OR: [
          { ownerId: user.id },
          { tripUsers: { some: { userId: user.id } } }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            upiId: true
          }
        },
        tripUsers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                upiId: true
              }
            }
          }
        },
        expenses: {
          include: {
            paidBy: {
              select: {
                id: true,
                name: true,
                email: true,
                upiId: true
              }
            }
          }
        }
      }
    })

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found or you don't have access" },
        { status: 404 }
      )
    }

    // Get all trip members (including owner)
    const allMembers = [
      { user: trip.owner },
      ...trip.tripUsers.map((tu: { user: { id: string; name: string; email: string; upiId: string } }) => ({ user: tu.user }))
    ]

    // Remove duplicates if owner is also in tripUsers
    const uniqueMembers = allMembers.filter((member, index, self) => 
      index === self.findIndex((m: { user: { id: string } }) => m.user.id === member.user.id)
    )

    // Calculate total expenses and per-person share
    const totalExpenses = trip.expenses.reduce((sum: number, expense: { amount: number }) => sum + expense.amount, 0)
    const memberCount = uniqueMembers.length
    const perPersonShare = memberCount > 0 ? totalExpenses / memberCount : 0

    // Calculate balance for each user
    const userBalances: UserBalance[] = uniqueMembers.map(member => {
      const totalPaid = trip.expenses
        .filter((expense: { paidBy: { id: string } }) => expense.paidBy.id === member.user.id)
        .reduce((sum: number, expense: { amount: number }) => sum + expense.amount, 0)
      
      const balance = totalPaid - perPersonShare
      
      return {
        userId: member.user.id,
        user: member.user,
        totalPaid,
        share: perPersonShare,
        balance: Math.round(balance * 100) / 100 // Round to 2 decimal places
      }
    })

    // Simplify debts to minimize transactions
    const transactions = simplifyDebts([...userBalances]) // Create copy for manipulation

    // Calculate summary statistics
    const summary = {
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      perPersonShare: Math.round(perPersonShare * 100) / 100,
      memberCount,
      totalTransactions: transactions.length
    }

    return NextResponse.json({
      summary,
      balances: userBalances,
      transactions,
      currentUserId: user.id
    })
  } catch (error) {
    console.error("Error calculating settlement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 