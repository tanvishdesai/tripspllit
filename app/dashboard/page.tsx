"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"

interface Trip {
  id: string
  name: string
  createdAt: string
  owner: {
    id: string
    name: string
    email: string
  }
  tripUsers: Array<{
    user: {
      id: string
      name: string
      email: string
    }
  }>
  expenses: Array<{
    id: string
    title: string
    amount: number
    paidBy: {
      id: string
      name: string
      email: string
    }
  }>
  _count: {
    expenses: number
    tripUsers: number
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)
  const [showNewTripForm, setShowNewTripForm] = useState(false)
  const [newTripName, setNewTripName] = useState("")
  const [memberEmails, setMemberEmails] = useState("")
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "loading") return // Still loading
    if (!session) router.push("/auth/signin") // Not authenticated
    if (session) fetchTrips() // Fetch trips when authenticated
  }, [session, status, router])

  const fetchTrips = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/trips')
      if (response.ok) {
        const data = await response.json()
        setTrips(data)
      } else {
        console.error('Failed to fetch trips')
      }
    } catch (error) {
      console.error('Error fetching trips:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTripName.trim()) return

    setCreateLoading(true)
    setError("")

    try {
      const memberEmailsArray = memberEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email)

      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTripName,
          memberEmails: memberEmailsArray
        }),
      })

      if (response.ok) {
        const newTrip = await response.json()
        setTrips([newTrip, ...trips])
        setNewTripName("")
        setMemberEmails("")
        setShowNewTripForm(false)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create trip')
      }
    } catch (error) {
      setError('Error creating trip')
      console.error('Error creating trip:', error)
    } finally {
      setCreateLoading(false)
    }
  }

  const getTotalExpenses = (trip: Trip) => {
    if (!trip.expenses || !Array.isArray(trip.expenses)) {
      return 0
    }
    return trip.expenses.reduce((total, expense) => total + expense.amount, 0)
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Your Trips
              </h1>
              <button
                onClick={() => setShowNewTripForm(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                + New Trip
              </button>
            </div>
            <p className="text-gray-600">
              Welcome back, {session.user?.name}! Manage your trips and expenses here.
            </p>
          </div>

          {/* New Trip Form Modal */}
          {showNewTripForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-semibold mb-4">Create New Trip</h2>
                <form onSubmit={handleCreateTrip}>
                  <div className="mb-4">
                    <label htmlFor="tripName" className="block text-sm font-medium text-gray-700 mb-1">
                      Trip Name
                    </label>
                    <input
                      type="text"
                      id="tripName"
                      value={newTripName}
                      onChange={(e) => setNewTripName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Goa Trip 2024"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="memberEmails" className="block text-sm font-medium text-gray-700 mb-1">
                      Member Emails (optional)
                    </label>
                    <input
                      type="text"
                      id="memberEmails"
                      value={memberEmails}
                      onChange={(e) => setMemberEmails(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="friend1@email.com, friend2@email.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Comma-separated email addresses of existing users
                    </p>
                  </div>
                  {error && (
                    <div className="mb-4 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {createLoading ? "Creating..." : "Create Trip"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewTripForm(false)
                        setNewTripName("")
                        setMemberEmails("")
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

          {/* Trips List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading trips...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
                <p className="text-gray-600 mb-6">
                  Create your first trip to start tracking expenses with friends!
                </p>
                <button
                  onClick={() => setShowNewTripForm(true)}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Create Your First Trip
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {trip.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      trip.owner.id === session.user?.id 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {trip.owner.id === session.user?.id ? 'Owner' : 'Member'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Members:</span>
                      <span className="font-medium">{trip._count.tripUsers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Expenses:</span>
                      <span className="font-medium">{trip._count.expenses}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-medium">₹{getTotalExpenses(trip).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Created {new Date(trip.createdAt).toLocaleDateString()}
                  </div>
                  
                  {trip.expenses && trip.expenses.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600">Latest expense:</p>
                      <p className="text-sm font-medium truncate">
                        {trip.expenses[0].title} - ₹{trip.expenses[0].amount}
                      </p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 