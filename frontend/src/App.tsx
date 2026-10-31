import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { DraftProvider } from './billing/DraftContext'
import BrandingEffect from './components/BrandingEffect'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import BillingPage from './pages/billing/BillingPage'
import InvoicesPage from './pages/invoices/InvoicesPage'
import CreditNotesPage from './pages/invoices/CreditNotesPage'
import QuotationsPage from './pages/quotations/QuotationsPage'
import QuotationFormPage from './pages/quotations/QuotationFormPage'
import ProductsPage from './pages/products/ProductsPage'
import CustomersPage from './pages/customers/CustomersPage'
import PaymentsPage from './pages/payments/PaymentsPage'
import AccountPage from './pages/account/AccountPage'
import PurchasesPage from './pages/purchases/PurchasesPage'
import PurchaseEntryPage from './pages/purchases/PurchaseEntryPage'
import SuppliersPage from './pages/suppliers/SuppliersPage'
import ReportsPage from './pages/reports/ReportsPage'
import SettingsPage from './pages/settings/SettingsPage'
import UsersPage from './pages/users/UsersPage'
import GlobalInputStyles from './components/GlobalInputStyles'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DraftProvider>
          <BrandingEffect />
          <GlobalInputStyles />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/credit-notes" element={<CreditNotesPage />} />
                <Route path="/quotations" element={<QuotationsPage />} />
                <Route path="/quotations/new" element={<QuotationFormPage />} />
                <Route path="/quotations/:id/edit" element={<QuotationFormPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/account" element={<AccountPage />} />

                <Route element={<ProtectedRoute ownerOnly />}>
                  <Route path="/purchases" element={<PurchasesPage />} />
                  <Route path="/purchases/new" element={<PurchaseEntryPage />} />
                  <Route path="/suppliers" element={<SuppliersPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/users" element={<UsersPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DraftProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}