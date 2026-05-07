import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { ComingSoon } from "@/components/ComingSoon";
import Payroll from "./pages/Payroll";
import Invoices from "./pages/Invoices";
import Quotations from "./pages/Quotations";
import PurchaseOrders from "./pages/PurchaseOrders";
import Feedback from "./pages/Feedback";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Complaints from "./pages/Complaints";
import Technicians from "./pages/Technicians";
import TechnicianTracking from "./pages/TechnicianTracking";
import IvrsLogs from "./pages/IvrsLogs";
import Inventory from "./pages/Inventory";
import Factories from "./pages/Factories";
import Expenses from "./pages/Expenses";
import PublicFeedback from "./pages/PublicFeedback";
import PublicEta from "./pages/PublicEta";
import Settings from "./pages/Settings";
import AssignmentRules from "./pages/AssignmentRules";
import AmcContracts from "./pages/AmcContracts";
import Performance from "./pages/Performance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/feedback/:complaintId/:token" element={<PublicFeedback />} />
            <Route path="/eta/:token" element={<PublicEta />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/ivrs-logs" element={<ProtectedRoute roles={["admin","manager"]}><IvrsLogs /></ProtectedRoute>} />
              <Route path="/assignment-rules" element={<ProtectedRoute roles={["admin","manager"]}><AssignmentRules /></ProtectedRoute>} />
              <Route path="/technicians" element={<ProtectedRoute roles={["admin","manager"]}><Technicians /></ProtectedRoute>} />
              <Route path="/tracking" element={<ProtectedRoute roles={["admin","manager","technician"]}><TechnicianTracking /></ProtectedRoute>} />
              <Route path="/performance" element={<ProtectedRoute roles={["admin","manager"]}><Performance /></ProtectedRoute>} />
              <Route path="/amc" element={<ProtectedRoute roles={["admin","manager"]}><AmcContracts /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute roles={["admin","manager"]}><Inventory /></ProtectedRoute>} />
              <Route path="/factories" element={<ProtectedRoute roles={["admin","manager"]}><Factories /></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute roles={["admin","accountant"]}><Expenses /></ProtectedRoute>} />
              <Route path="/payroll" element={<ProtectedRoute roles={["admin","accountant"]}><Payroll /></ProtectedRoute>} />
              <Route path="/quotations" element={<ProtectedRoute roles={["admin","manager","accountant"]}><Quotations /></ProtectedRoute>} />
              <Route path="/purchase-orders" element={<ProtectedRoute roles={["admin","manager","accountant"]}><PurchaseOrders /></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute roles={["admin","manager","accountant"]}><Invoices /></ProtectedRoute>} />
              <Route path="/feedback" element={<ProtectedRoute roles={["admin","manager"]}><Feedback /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute roles={["admin"]}><Settings /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
