import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Razorpay configuration (you'll need to install razorpay: npm install razorpay)
// For now, we'll implement a mock version that provides the standard UPI interface

interface PaymentLogRequest {
  amount: string
  toUserId: string
  description: string
  upiId: string
}

// Simple payment logging API - no complex gateway integration needed
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

    const resolvedParams = await params
    const paymentData: PaymentLogRequest = await req.json()

    // Validate the trip exists and user has access
    const trip = await prisma.trip.findFirst({
      where: {
        id: resolvedParams.tripId,
        OR: [
          { ownerId: user.id },
          { tripUsers: { some: { userId: user.id } } }
        ]
      }
    })

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      )
    }

    // Validate amount
    const amount = parseFloat(paymentData.amount)
    if (isNaN(amount) || amount < 1 || amount > 100000) {
      return NextResponse.json(
        { error: "Invalid amount. Must be between ₹1 and ₹1,00,000" },
        { status: 400 }
      )
    }

    // Validate UPI ID format
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
    if (!upiRegex.test(paymentData.upiId)) {
      return NextResponse.json(
        { error: "Invalid UPI ID format" },
        { status: 400 }
      )
    }

    // Generate transaction reference
    const orderId = `TS${Date.now()}${Math.random().toString(36).substr(2, 5)}`
    
    // Log payment attempt for tracking (in production, store in payments table)
    const paymentLog = {
      orderId,
      tripId: resolvedParams.tripId,
      fromUserId: user.id,
      toUserId: paymentData.toUserId,
      amount: amount,
      currency: 'INR',
      description: paymentData.description,
      recipientUpiId: paymentData.upiId,
      status: 'initiated',
      timestamp: new Date(),
      userAgent: req.headers.get('user-agent') || 'unknown'
    }
    
    console.log('Payment attempt logged:', paymentLog)

    // Return success response
    return NextResponse.json({
      success: true,
      orderId,
      amount,
      currency: 'INR',
      description: paymentData.description,
      recipientUpiId: paymentData.upiId,
      message: 'Payment attempt logged successfully'
    })

  } catch (error) {
    console.error('Payment logging error:', error)
    return NextResponse.json(
      { 
        error: "Failed to log payment attempt",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
} 