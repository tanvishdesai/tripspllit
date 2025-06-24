# Payment Gateway Setup Guide

## Overview

This document explains how to set up production-ready UPI payment gateways for TripSplit. The current implementation uses a fallback method, but for production, you should integrate with established payment providers.

## Recommended Payment Gateways for India

### 1. Razorpay (Recommended)
- **Pros**: Best UPI support, extensive documentation, excellent developer experience
- **UPI Features**: UPI Autopay, UPI QR, UPI Link, UPI Recurring
- **Pricing**: 2% + GST per transaction
- **Setup**: Easy integration with good SDK support

### 2. Cashfree
- **Pros**: Competitive pricing, good UPI support
- **UPI Features**: UPI Intent, UPI QR, UPI Collect
- **Pricing**: 1.75% + GST per transaction
- **Setup**: Simple REST API integration

### 3. PayU
- **Pros**: Established player, supports multiple payment methods
- **UPI Features**: UPI Intent, UPI Collect
- **Pricing**: 2.3% + GST per transaction

## Razorpay Integration (Recommended)

### Step 1: Account Setup

1. Sign up at [razorpay.com](https://razorpay.com)
2. Complete KYC verification
3. Get your API keys from the dashboard

### Step 2: Install Dependencies

```bash
npm install razorpay
npm install @types/razorpay --save-dev
```

### Step 3: Environment Variables

Add to your `.env.local`:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

### Step 4: Update the Payment API

Replace the current implementation in `app/api/trips/[tripId]/create-payment/route.ts`:

```typescript
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

// In your POST handler:
const order = await razorpay.orders.create({
  amount: Math.round(amount * 100), // Amount in paise
  currency: 'INR',
  receipt: paymentData.order_id,
  payment_capture: 1,
  notes: {
    trip_id: paymentData.metadata.trip_id,
    settlement_from: paymentData.metadata.settlement_from,
    settlement_to: paymentData.metadata.settlement_to,
  }
})

return NextResponse.json({
  success: true,
  order_id: order.id,
  razorpay_order_id: order.id,
  amount: order.amount / 100,
  currency: order.currency,
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  // UPI-specific options
  prefill: {
    name: paymentData.customer_name,
    email: paymentData.customer_email,
  },
  theme: {
    color: '#10B981' // Green theme
  },
  method: {
    upi: true,
    // Disable other methods if you only want UPI
    card: false,
    netbanking: false,
    wallet: false,
  }
})
```

### Step 5: Frontend Integration

Update `handleUPIPayment` in your frontend:

```typescript
const handleUPIPayment = async (transaction: SettlementTransaction) => {
  try {
    // Create order
    const paymentRequest = await generateUPIPaymentRequest(transaction)
    
    // Initialize Razorpay
    const options = {
      key: paymentRequest.key,
      amount: paymentRequest.amount * 100,
      currency: 'INR',
      name: 'TripSplit',
      description: `Settlement for ${trip?.name}`,
      order_id: paymentRequest.razorpay_order_id,
      prefill: paymentRequest.prefill,
      theme: paymentRequest.theme,
      method: paymentRequest.method,
      handler: function (response: any) {
        // Payment successful
        alert(`Payment successful! Payment ID: ${response.razorpay_payment_id}`)
        // Verify payment on backend
        verifyPayment(response)
      },
      modal: {
        ondismiss: function() {
          setPaymentStatusMessage('Payment cancelled')
        }
      }
    }
    
    const razorpay = new (window as any).Razorpay(options)
    razorpay.open()
    
  } catch (error) {
    console.error('Payment failed:', error)
    setPaymentStatusMessage('Payment failed to initiate')
  }
}
```

### Step 6: Add Razorpay Script

Add to your `app/layout.tsx`:

```html
<Script src="https://checkout.razorpay.com/v1/checkout.js" />
```

### Step 7: Payment Verification

Create `app/api/trips/[tripId]/verify-payment/route.ts`:

```typescript
import crypto from 'crypto'
import Razorpay from 'razorpay'

export async function POST(req: NextRequest) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
  
  const body = razorpay_order_id + "|" + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body.toString())
    .digest("hex")
  
  if (expectedSignature === razorpay_signature) {
    // Payment verified - update your database
    // Mark settlement as paid
    return NextResponse.json({ verified: true })
  } else {
    return NextResponse.json({ verified: false }, { status: 400 })
  }
}
```

## Current Fallback Implementation

The current implementation provides:

1. **Standard UPI Intent Links**: `upi://pay?pa=...`
2. **QR Code Generation**: Using qrserver.com API
3. **Multiple Payment Methods**: Works with all UPI apps
4. **Error Handling**: Proper validation and user feedback

### Why the Fallback Works

1. **Industry Standard**: Uses the official UPI specification
2. **Universal Compatibility**: Works with all UPI-enabled apps
3. **No Gateway Dependency**: Direct bank-to-bank transfer
4. **Lower Costs**: No payment gateway fees (only bank charges)

## Testing Your Implementation

### Test Cases

1. **Mobile UPI Apps**: Test with GPay, PhonePe, Paytm, BHIM
2. **Desktop Browsers**: Ensure QR code generation works
3. **Amount Validation**: Test edge cases (₹1, ₹1,00,000)
4. **Network Failures**: Test offline scenarios
5. **Invalid UPI IDs**: Test error handling

### Test Data

Use these test UPI IDs (they won't actually charge money):
- Valid format: `test@paytm`
- Invalid format: `invalid-upi-id`

## Production Checklist

- [ ] Choose and setup payment gateway (Razorpay recommended)
- [ ] Obtain proper merchant credentials
- [ ] Implement payment verification
- [ ] Add webhook handling for async payment updates
- [ ] Set up proper logging and monitoring
- [ ] Test with real UPI IDs (small amounts)
- [ ] Configure proper error handling and user notifications
- [ ] Set up payment reconciliation process

## Security Considerations

1. **Never expose API secrets** in frontend code
2. **Always verify payments** on the backend
3. **Use HTTPS** for all payment-related communications
4. **Implement rate limiting** to prevent abuse
5. **Log all payment attempts** for audit trails
6. **Validate all inputs** thoroughly

## Support

For payment gateway specific issues:
- **Razorpay**: [support.razorpay.com](https://support.razorpay.com)
- **Cashfree**: [support.cashfree.com](https://support.cashfree.com)
- **PayU**: [support.payu.in](https://support.payu.in)

For UPI specification queries, refer to NPCI documentation. 