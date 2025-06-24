import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Razorpay configuration (you'll need to install razorpay: npm install razorpay)
// For now, we'll implement a mock version that provides the standard UPI interface

interface PaymentRequest {
  amount: string
  currency: string
  order_id: string
  customer_id: string
  customer_name: string
  customer_email: string
  description: string
  return_url: string
  notify_url: string
  merchant_name: string
  merchant_vpa: string
  metadata: {
    trip_id: string
    settlement_from: string
    settlement_to: string
    transaction_type: string
  }
}

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
    const paymentData: PaymentRequest = await req.json()

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

    // For production, you would integrate with Razorpay here:
    // const Razorpay = require('razorpay')
    // const razorpay = new Razorpay({
    //   key_id: process.env.RAZORPAY_KEY_ID,
    //   key_secret: process.env.RAZORPAY_KEY_SECRET
    // })
    
    // const order = await razorpay.orders.create({
    //   amount: Math.round(amount * 100), // Amount in paise
    //   currency: 'INR',
    //   receipt: paymentData.order_id,
    //   payment_capture: 1
    // })

    // Since we don't have Razorpay set up, let's provide a working fallback solution
    // This creates a UPI payment request that works with the standard UPI specification
    
    const orderId = paymentData.order_id
    const upiPaymentUrl = `upi://pay?pa=${encodeURIComponent(paymentData.merchant_vpa)}&pn=${encodeURIComponent(paymentData.customer_name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(paymentData.description)}&tr=${encodeURIComponent(orderId)}`
    
    // Create a proper UPI QR code URL (you can use any QR service)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiPaymentUrl)}`
    
    // Log the payment attempt for tracking
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          // This would be in a separate payment_attempts table in production
          // For now, we'll just update the user's last activity
          updatedAt: new Date()
        }
      })
    } catch (error) {
      console.log('Failed to log payment attempt:', error)
    }

    // Return the payment response
    const response = {
      success: true,
      order_id: orderId,
      payment_url: upiPaymentUrl, // UPI deep link
      qr_code: qrCodeUrl, // QR code for scanning
      web_url: `${paymentData.return_url}?order_id=${orderId}&status=pending`, // Fallback web URL
      amount: amount,
      currency: 'INR',
      description: paymentData.description,
      merchant_name: paymentData.merchant_name,
      recipient_vpa: paymentData.merchant_vpa,
      payment_methods: {
        upi: {
          enabled: true,
          deep_link: upiPaymentUrl,
          qr_code: qrCodeUrl
        }
      },
      instructions: {
        mobile: "Click the payment link to open your UPI app and complete the payment",
        desktop: "Scan the QR code with any UPI app on your mobile device",
        manual: `Send ₹${amount} to UPI ID: ${paymentData.merchant_vpa} with reference: ${orderId}`
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json(
      { 
        error: "Failed to create payment request",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
} 