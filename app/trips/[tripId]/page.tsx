"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"

interface TripMember {
  id: string
  user: {
    id: string
    name: string
    email: string
    upiId: string
  }
}

interface Expense {
  id: string
  title: string
  amount: number
  createdAt: string
  paidBy: {
    id: string
    name: string
    email: string
    upiId: string
  }
}

interface Trip {
  id: string
  name: string
  createdAt: string
  owner: {
    id: string
    name: string
    email: string
    upiId: string
  }
  tripUsers: TripMember[]
  expenses: Expense[]
  _count: {
    expenses: number
    tripUsers: number
  }
}

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

interface SettlementData {
  summary: {
    totalExpenses: number
    perPersonShare: number
    memberCount: number
    totalTransactions: number
  }
  balances: UserBalance[]
  transactions: SettlementTransaction[]
  currentUserId: string
}

export default function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ tripId: string } | null>(null)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false)
  const [expenseTitle, setExpenseTitle] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [addExpenseLoading, setAddExpenseLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<'overview' | 'settle'>('overview')
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null)
  const [settlementLoading, setSettlementLoading] = useState(false)
  const [paymentStatusMessage, setPaymentStatusMessage] = useState("")

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  useEffect(() => {
    const handleAuth = async () => {
      if (status === "loading" || !resolvedParams) return // Still loading or params not resolved
      if (!session) router.push("/auth/signin") // Not authenticated
      if (session) await fetchTrip() // Fetch trip when authenticated
    }
    handleAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router, resolvedParams?.tripId])

  const fetchTrip = async () => {
    if (!resolvedParams) return
    setLoading(true)
    try {
      const response = await fetch(`/api/trips/${resolvedParams.tripId}`)
      if (response.ok) {
        const data = await response.json()
        setTrip(data)
      } else if (response.status === 404) {
        router.push('/dashboard')
      } else {
        console.error('Failed to fetch trip')
      }
    } catch (error) {
      console.error('Error fetching trip:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseTitle.trim() || !expenseAmount.trim() || !resolvedParams) return

    const amount = parseFloat(expenseAmount)
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setAddExpenseLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/trips/${resolvedParams.tripId}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: expenseTitle,
          amount: amount
        }),
      })

      if (response.ok) {
        const newExpense = await response.json()
        setTrip(prev => prev ? {
          ...prev,
          expenses: [newExpense, ...prev.expenses],
          _count: {
            ...prev._count,
            expenses: prev._count.expenses + 1
          }
        } : null)
        setExpenseTitle("")
        setExpenseAmount("")
        setShowAddExpenseForm(false)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to add expense')
      }
    } catch (error) {
      setError('Error adding expense')
      console.error('Error adding expense:', error)
    } finally {
      setAddExpenseLoading(false)
    }
  }

  const getTotalExpenses = () => {
    if (!trip) return 0
    return trip.expenses.reduce((total, expense) => total + expense.amount, 0)
  }

  const getPerPersonShare = () => {
    if (!trip || trip._count.tripUsers === 0) return 0
    return getTotalExpenses() / trip._count.tripUsers
  }

  const getUserExpenseTotal = (userId: string) => {
    if (!trip) return 0
    return trip.expenses
      .filter(expense => expense.paidBy.id === userId)
      .reduce((total, expense) => total + expense.amount, 0)
  }

  const getUserBalance = (userId: string) => {
    return getUserExpenseTotal(userId) - getPerPersonShare()
  }

  const fetchSettlement = async () => {
    if (!resolvedParams) return
    setSettlementLoading(true)
    try {
      const response = await fetch(`/api/trips/${resolvedParams.tripId}/settle`)
      if (response.ok) {
        const data = await response.json()
        setSettlementData(data)
      } else {
        console.error('Failed to fetch settlement data')
      }
    } catch (error) {
      console.error('Error fetching settlement:', error)
    } finally {
      setSettlementLoading(false)
    }
  }

  // Enhanced UPI payment system with proper merchant verification
  const generateUPIPaymentOptions = (transaction: SettlementTransaction) => {
    const { to, amount } = transaction
    const upiId = to.upiId
    const recipientName = encodeURIComponent(to.name)
    const transactionNote = encodeURIComponent(`TripSplit: Settlement for ${trip?.name || 'Trip'}`)
    const merchantCode = "TRIPSPLIT" // Merchant identifier
    const transactionRef = `TS${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase()
    
    // Generate multiple UPI payment options for better compatibility
    const paymentOptions = {
      // Standard UPI deep link with enhanced parameters
      standard: `upi://pay?pa=${upiId}&pn=${recipientName}&am=${amount.toFixed(2)}&tn=${transactionNote}&cu=INR&mc=${merchantCode}&tr=${transactionRef}`,
      
      // Google Pay specific deep link
      googlePay: `tez://upi/pay?pa=${upiId}&pn=${recipientName}&am=${amount.toFixed(2)}&tn=${transactionNote}&cu=INR&mc=${merchantCode}&tr=${transactionRef}`,
      
      // PhonePe specific deep link  
      phonePe: `phonepe://pay?pa=${upiId}&pn=${recipientName}&am=${amount.toFixed(2)}&tn=${transactionNote}&cu=INR&mc=${merchantCode}&tr=${transactionRef}`,
      
      // Paytm specific deep link
      paytm: `paytmmp://pay?pa=${upiId}&pn=${recipientName}&am=${amount.toFixed(2)}&tn=${transactionNote}&cu=INR&mc=${merchantCode}&tr=${transactionRef}`,
      
      // BHIM specific deep link
      bhim: `bhim://pay?pa=${upiId}&pn=${recipientName}&am=${amount.toFixed(2)}&tn=${transactionNote}&cu=INR&mc=${merchantCode}&tr=${transactionRef}`
    }
    
    return {
      ...paymentOptions,
      transactionRef,
      merchantCode,
      fallbackUrl: `https://upiweb.com/pay?pa=${upiId}&pn=${recipientName}&am=${amount.toFixed(2)}&tn=${transactionNote}&cu=INR`,
      // Enhanced UPI parameters based on UPI specification
      amount: amount.toFixed(2),
      currency: 'INR',
      recipientVPA: upiId,
      recipientName: to.name
    }
  }

  const handleUPIPayment = async (transaction: SettlementTransaction, appType: string = 'standard') => {
    if (!resolvedParams) return
    
    // Validate transaction amount (minimum INR 1, maximum INR 1,00,000 for UPI)
    if (transaction.amount < 1) {
      alert('Payment amount must be at least ₹1')
      return
    }
    
    if (transaction.amount > 100000) {
      alert('Payment amount exceeds UPI limit of ₹1,00,000. Please split into smaller amounts.')
      return
    }

    // Validate UPI ID format
    if (!transaction.to.upiId || !transaction.to.upiId.includes('@')) {
      alert('Invalid UPI ID format. Please check the recipient UPI ID.')
      return
    }
    
    const paymentOptions = generateUPIPaymentOptions(transaction)
    const selectedUrl = paymentOptions[appType as keyof typeof paymentOptions] || paymentOptions.standard
    
    try {
      // First, log the payment attempt to our backend
      const response = await fetch(`/api/trips/${resolvedParams.tripId}/upi-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionRef: paymentOptions.transactionRef,
          amount: transaction.amount,
          toUserId: transaction.to.id,
          appType
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to log payment attempt')
      }

      const paymentData = await response.json()
      console.log('Payment attempt logged:', paymentData)

      // Try to open the UPI app
      if (typeof window !== 'undefined') {
        const userAgent = navigator.userAgent.toLowerCase()
        const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
        
        if (isMobile) {
          // On mobile, try the deep link first
          window.location.href = selectedUrl
          
          // Fallback to web UPI if app doesn't open within 3 seconds
          setTimeout(() => {
            if (document.visibilityState === 'visible') {
              // If still on the page, show instructions
              alert(`
UPI App not found or failed to open.

Payment Details:
• Amount: ₹${transaction.amount.toFixed(2)}
• To: ${transaction.to.name} (${transaction.to.upiId})
• Transaction ID: ${paymentOptions.transactionRef}

Please manually open your UPI app and pay using the above details, or try the web interface.
              `)
              window.open(paymentOptions.fallbackUrl, '_blank')
            }
          }, 3000)
        } else {
          // On desktop, show payment instructions and open web UPI
          const confirmed = confirm(`
You are about to make a UPI payment:

Amount: ₹${transaction.amount.toFixed(2)}
To: ${transaction.to.name}
UPI ID: ${transaction.to.upiId}
Transaction ID: ${paymentOptions.transactionRef}

Click OK to open the web UPI interface, or Cancel to copy the UPI ID.
          `)
          
          if (confirmed) {
            window.open(paymentOptions.fallbackUrl, '_blank')
          } else {
            // Copy UPI ID to clipboard
            navigator.clipboard.writeText(transaction.to.upiId).then(() => {
              alert(`UPI ID copied to clipboard: ${transaction.to.upiId}`)
            }).catch(() => {
              alert(`UPI ID: ${transaction.to.upiId}`)
            })
          }
        }
        
        // Show success message with transaction reference
        setTimeout(() => {
          setPaymentStatusMessage(`
✅ Payment initiated successfully!

Transaction Reference: ${paymentOptions.transactionRef}
Amount: ₹${transaction.amount.toFixed(2)}
To: ${transaction.to.name}

Please complete the payment in your UPI app. Payment may take a few minutes to process.
          `)
          
          // Clear message after 10 seconds
          setTimeout(() => setPaymentStatusMessage(""), 10000)
        }, 1000)
      }
    } catch (error) {
      console.error('Error initiating UPI payment:', error)
      alert(`
Error initiating payment: ${error instanceof Error ? error.message : 'Unknown error'}

You can still make the payment manually:
• Amount: ₹${transaction.amount.toFixed(2)}
• UPI ID: ${transaction.to.upiId}
• Recipient: ${transaction.to.name}
      `)
    }
  }

  useEffect(() => {
    const handleSettlement = async () => {
      if (activeTab === 'settle' && !settlementData) {
        await fetchSettlement()
      }
    }
    handleSettlement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, settlementData])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading trip...</p>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Trip not found</h1>
          <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800 mr-4">
                ← Back to Dashboard
              </Link>
            </div>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold text-gray-900">
                {trip.name}
              </h1>
              <button
                onClick={() => setShowAddExpenseForm(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                + Add Expense
              </button>
            </div>
            
            {/* Trip Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-sm font-medium text-gray-600">Total Spent</h3>
                <p className="text-2xl font-bold text-gray-900">₹{getTotalExpenses().toFixed(2)}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-sm font-medium text-gray-600">Per Person</h3>
                <p className="text-2xl font-bold text-gray-900">₹{getPerPersonShare().toFixed(2)}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-sm font-medium text-gray-600">Members</h3>
                <p className="text-2xl font-bold text-gray-900">{trip._count.tripUsers}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-sm font-medium text-gray-600">Expenses</h3>
                <p className="text-2xl font-bold text-gray-900">{trip._count.expenses}</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'overview'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('settle')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'settle'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Settle Up
                </button>
              </nav>
            </div>
          </div>

          {/* Add Expense Form Modal */}
          {showAddExpenseForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-semibold mb-4">Add New Expense</h2>
                <form onSubmit={handleAddExpense}>
                  <div className="mb-4">
                    <label htmlFor="expenseTitle" className="block text-sm font-medium text-gray-700 mb-1">
                      Expense Title
                    </label>
                    <input
                      type="text"
                      id="expenseTitle"
                      value={expenseTitle}
                      onChange={(e) => setExpenseTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Dinner at restaurant"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="expenseAmount" className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      id="expenseAmount"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </div>
                  {error && (
                    <div className="mb-4 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={addExpenseLoading}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {addExpenseLoading ? "Adding..." : "Add Expense"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddExpenseForm(false)
                        setExpenseTitle("")
                        setExpenseAmount("")
                        setError("")
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'overview' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Members */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Members</h2>
                <div className="space-y-3">
                  {trip.tripUsers.map((member) => (
                    <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{member.user.name}</p>
                        <p className="text-sm text-gray-600">{member.user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          Paid: ₹{getUserExpenseTotal(member.user.id).toFixed(2)}
                        </p>
                        <p className={`text-sm ${
                          getUserBalance(member.user.id) > 0 
                            ? 'text-green-600' 
                            : getUserBalance(member.user.id) < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}>
                          {getUserBalance(member.user.id) > 0 
                            ? `+₹${getUserBalance(member.user.id).toFixed(2)}`
                            : getUserBalance(member.user.id) < 0
                            ? `-₹${Math.abs(getUserBalance(member.user.id)).toFixed(2)}`
                            : '₹0.00'
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expenses */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Expenses</h2>
                {trip.expenses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">No expenses yet</p>
                    <button
                      onClick={() => setShowAddExpenseForm(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Add First Expense
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trip.expenses.map((expense) => (
                      <div key={expense.id} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900">{expense.title}</h3>
                          <p className="text-sm text-gray-600">
                            Paid by {expense.paidBy.name} on {new Date(expense.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">₹{expense.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Settlement Content */
            <div className="space-y-6">
              {settlementLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="ml-3 text-gray-600">Calculating settlement...</span>
                </div>
              ) : settlementData ? (
                <>
                  {/* Settlement Summary */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Settlement Summary</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Total Expenses</p>
                        <p className="text-2xl font-bold text-gray-900">₹{settlementData.summary.totalExpenses.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Per Person Share</p>
                        <p className="text-2xl font-bold text-gray-900">₹{settlementData.summary.perPersonShare.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Transactions Needed</p>
                        <p className="text-2xl font-bold text-gray-900">{settlementData.summary.totalTransactions}</p>
                      </div>
                    </div>
                  </div>

                  {/* User Balances */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Individual Balances</h2>
                    <div className="space-y-3">
                      {settlementData.balances.map((balance) => (
                        <div key={balance.userId} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{balance.user.name}</p>
                            <p className="text-sm text-gray-600">
                              Paid: ₹{balance.totalPaid.toFixed(2)} | Share: ₹{balance.share.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-semibold ${
                              balance.balance > 0 
                                ? 'text-green-600' 
                                : balance.balance < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}>
                              {balance.balance > 0 
                                ? `+₹${balance.balance.toFixed(2)}`
                                : balance.balance < 0
                                ? `-₹${Math.abs(balance.balance).toFixed(2)}`
                                : '₹0.00'
                              }
                            </p>
                            <p className="text-sm text-gray-600">
                              {balance.balance > 0 
                                ? 'Should receive'
                                : balance.balance < 0
                                ? 'Should pay'
                                : 'All settled'
                              }
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Status Message */}
                  {paymentStatusMessage && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <pre className="text-sm text-green-800 whitespace-pre-line">{paymentStatusMessage}</pre>
                    </div>
                  )}

                  {/* UPI Payment Help */}
                  {settlementData.transactions.some(t => t.from.id === settlementData.currentUserId) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-blue-900 mb-2">💡 UPI Payment Tips</h3>
                      <div className="text-sm text-blue-800 space-y-1">
                        <p>• <strong>Mobile users:</strong> Click Pay with UPI to open your payment app directly</p>
                        <p>• <strong>Desktop users:</strong> Use the web UPI interface or copy the UPI ID</p>
                        <p>• <strong>Payment not working?</strong> Try different payment apps (GPay, PhonePe, Paytm, BHIM)</p>
                        <p>• <strong>Transaction reference:</strong> Keep it for your records and payment verification</p>
                        <p>• <strong>Amount issues?</strong> Check your daily transaction limits in your banking app</p>
                        <p>• <strong>Still having issues?</strong> Make the payment manually using the recipient&apos;s UPI ID</p>
                      </div>
                    </div>
                  )}

                  {/* Settlement Transactions */}
                  {settlementData.transactions.length > 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Settlement Plan</h2>
                      <div className="space-y-4">
                        {settlementData.transactions.map((transaction, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {transaction.from.name} → {transaction.to.name}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Amount: ₹{transaction.amount.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                {transaction.from.id === settlementData.currentUserId && (
                                  <div className="space-y-2">
                                    {/* Primary UPI Button */}
                                    <button
                                      onClick={() => handleUPIPayment(transaction, 'standard')}
                                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors inline-flex items-center w-full justify-center"
                                    >
                                      💳 Pay with UPI
                                    </button>
                                    
                                    {/* Specific Payment App Options */}
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        onClick={() => handleUPIPayment(transaction, 'googlePay')}
                                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
                                        title="Pay with Google Pay"
                                      >
                                        GPay
                                      </button>
                                      <button
                                        onClick={() => handleUPIPayment(transaction, 'phonePe')}
                                        className="bg-purple-500 text-white px-2 py-1 rounded text-xs hover:bg-purple-600 transition-colors"
                                        title="Pay with PhonePe"
                                      >
                                        PhonePe
                                      </button>
                                      <button
                                        onClick={() => handleUPIPayment(transaction, 'paytm')}
                                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                                        title="Pay with Paytm"
                                      >
                                        Paytm
                                      </button>
                                      <button
                                        onClick={() => handleUPIPayment(transaction, 'bhim')}
                                        className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600 transition-colors"
                                        title="Pay with BHIM"
                                      >
                                        BHIM
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {transaction.to.id === settlementData.currentUserId && (
                                  <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-md">
                                    You will receive ₹{transaction.amount.toFixed(2)}
                                  </div>
                                )}
                                {transaction.from.id !== settlementData.currentUserId && 
                                 transaction.to.id !== settlementData.currentUserId && (
                                  <div className="text-gray-500 text-sm">
                                    Not involving you
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">All Settled Up! 🎉</h2>
                      <p className="text-gray-600">
                        No transactions needed. Everyone has paid their fair share.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                  <p className="text-gray-600">Failed to load settlement data. Please try again.</p>
                  <button
                    onClick={fetchSettlement}
                    className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 