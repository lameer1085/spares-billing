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
import CreditNotesPage from './pages/invoices/CreditNotesPage'
import PurchasesPage from './pages/purchases/PurchasesPage'
import PurchaseEntryPage from './pages/purchases/PurchaseEntryPage'
import SuppliersPage from './pages/suppliers/SuppliersPage'
import ReportsPage from './pages/reports/ReportsPage'
import QuotationsPage from './pages/quotations/QuotationsPage'
import QuotationFormPage from './pages/quotations/QuotationFormPage'
import SettingsPage from './pages/settings/SettingsPage'






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
              <Route path="/credit-notes" element={<CreditNotesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/quotations/new" element={<QuotationFormPage />} />
              <Route path="/quotations/:id/edit" element={<QuotationFormPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route element={<ProtectedRoute ownerOnly />}>
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/purchases/new" element={<PurchaseEntryPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
            </Route>
          </Route>
        </Routes>
      </DraftProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}