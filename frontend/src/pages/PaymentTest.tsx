import { useState, useEffect } from 'react'
import { paymentsApi } from '../api/payments'

interface CreditPackage {
  id: number
  code: string
  name: string
  credits: number
  price_uah: number
  is_active: boolean
}

export default function PaymentTest() {
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [pkgs, bal] = await Promise.all([
        paymentsApi.getPackages(),
        paymentsApi.getBalance(),
      ])
      setPackages(pkgs)
      setBalance(bal.credits)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (packageCode: string) => {
    try {
      const idempotencyKey = `payment-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const order = await paymentsApi.createOrder({
        package_code: packageCode,
        idempotency_key: idempotencyKey,
      })

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = order.checkout_url

      Object.entries(order.checkout_fields).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      })

      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Payment Test Page</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <h2>Current Balance: {balance} credits</h2>
      </div>

      <h2>Available Packages</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {packages.map((pkg) => (
          <div key={pkg.id} style={{ padding: '15px', border: '1px solid #ccc' }}>
            <h3>{pkg.name}</h3>
            <p>Credits: {pkg.credits}</p>
            <p>Price: {pkg.price_uah} UAH</p>
            <button
              onClick={() => handlePurchase(pkg.code)}
              style={{ padding: '10px 20px', cursor: 'pointer' }}
            >
              Buy Now
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={loadData}
        style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
      >
        Refresh
      </button>
    </div>
  )
}
