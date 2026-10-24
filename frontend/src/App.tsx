import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/products/ProductsPage'
import CustomersPage from './pages/customers/CustomersPage'
import BillingPage from './pages/billing/BillingPage'
import { DraftProvider } from './billing/DraftContext'
import InvoicesPage from './pages/invoices/InvoicesPage'
import PaymentsPage from './pages/payments/PaymentsPage'




export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DraftProvider> 
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
            </Route>
          </Route>
        </Routes>
      </DraftProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}