import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/trips/[tripId]/upi-payment - Log UPI payment attempt
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const { tripId } = await params
    const body = await req.json()
    const { transactionRef, amount, toUserId, appType } = body

    // Verify trip access
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        OR: [
          { ownerId: user.id },
          { tripUsers: { some: { userId: user.id } } }
        ]
      }
    })

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 }
      )
    }

    // Generate enhanced UPI payment data with merchant verification
    const enhancedPaymentData = {
      transactionRef,
      merchantId: "TRIPSPLIT_MERCHANT",
      merchantName: "TripSplit",
      paymentGateway: "UPI_DIRECT",
      amount: parseFloat(amount.toFixed(2)),
      currency: "INR",
      description: `TripSplit Settlement for ${trip.name}`,
      fromUserId: user.id,
      toUserId,
      tripId,
      appType,
      timestamp: new Date(),
      checksum: generatePaymentChecksum(transactionRef, amount, user.id, toUserId)
    }

    // Log payment attempt (you could store this in a payments table)
    console.log('UPI Payment Attempt Logged:', enhancedPaymentData)

    return NextResponse.json({
      success: true,
      transactionRef,
      merchantVerification: {
        merchantId: enhancedPaymentData.merchantId,
        merchantName: enhancedPaymentData.merchantName,
        checksum: enhancedPaymentData.checksum
      },
      paymentDetails: {
        amount: enhancedPaymentData.amount,
        currency: enhancedPaymentData.currency,
        description: enhancedPaymentData.description
      }
    })

  } catch (error) {
    console.error('Error logging UPI payment attempt:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Generate a simple checksum for payment verification
function generatePaymentChecksum(transactionRef: string, amount: number, fromUserId: string, toUserId: string): string {
  const data = `${transactionRef}|${amount}|${fromUserId}|${toUserId}|TRIPSPLIT_SECRET`
  
  // Simple hash generation (in production, use a proper cryptographic hash)
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).toUpperCase()
}

// GET /api/trips/[tripId]/upi-payment - Get UPI payment status (for future enhancements)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    await params // Consume params to avoid unused variable warning
    const url = new URL(req.url)
    const transactionRef = url.searchParams.get('transactionRef')

    if (!transactionRef) {
      return NextResponse.json(
        { error: "Transaction reference required" },
        { status: 400 }
      )
    }

    // In a real implementation, you would check the payment status from your payment provider
    // For now, return a placeholder response
    return NextResponse.json({
      transactionRef,
      status: 'pending', // pending, success, failed
      message: 'Payment status check not implemented yet. Please verify payment in your UPI app.'
    })

  } catch (error) {
    console.error('Error checking UPI payment status:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 