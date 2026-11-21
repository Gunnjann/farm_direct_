import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout, { RequireAuth } from './components/Layout';
import { Loading } from './components/ui';
import { useAuth } from './context/AppContext';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductPage from './pages/ProductPage';
import { Login, Register } from './pages/Auth';

// Less-visited screens are code-split to keep the first load light on mobile data.
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Pay = lazy(() => import('./pages/Pay'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Groups = lazy(() => import('./pages/Groups'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const Account = lazy(() => import('./pages/Account'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Disputes = lazy(() => import('./pages/Disputes'));
const DisputeDetail = lazy(() => import('./pages/DisputeDetail'));
const SellerPublic = lazy(() => import('./pages/SellerPublic'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const SellerDashboard = lazy(() => import('./pages/seller/Dashboard'));
const SellerProducts = lazy(() => import('./pages/seller/Products'));
const ProductForm = lazy(() => import('./pages/seller/ProductForm'));
const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'));
const SellerSettings = lazy(() => import('./pages/seller/Settings'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const MandiBhav = lazy(() => import('./pages/market/MandiBhav'));
const Calculator = lazy(() => import('./pages/market/Calculator'));
const Vyapar = lazy(() => import('./pages/market/Vyapar'));
const DealDetail = lazy(() => import('./pages/market/DealDetail'));
const BrokerProfile = lazy(() => import('./pages/market/BrokerProfile'));

const BUYER = ['customer', 'retailer'];
const SELLER = ['farmer', 'trader'];

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which React would treat as a cleanup.
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function HomeRoute() {
  const { user } = useAuth();
  if (user && SELLER.includes(user.role)) return <Navigate to="/seller" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'broker') return <Navigate to="/vyapar" replace />;
  return <Home />;
}

export default function App() {
  const guard = (roles, el) => <RequireAuth roles={roles}>{el}</RequireAuth>;
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/sellers/:id" element={<SellerPublic />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/mine" element={guard(BUYER, <Groups mine />)} />
            <Route path="/groups/:id" element={<GroupDetail />} />

            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={guard(BUYER, <Checkout />)} />
            <Route path="/pay/:checkoutId" element={guard(BUYER, <Pay />)} />
            <Route path="/orders" element={guard(BUYER, <Orders />)} />
            <Route path="/orders/:id" element={guard(null, <OrderDetail />)} />

            <Route path="/account" element={guard(null, <Account />)} />
            <Route path="/notifications" element={guard(null, <Notifications />)} />
            <Route path="/disputes" element={guard(null, <Disputes />)} />
            <Route path="/disputes/:id" element={guard(null, <DisputeDetail />)} />

            <Route path="/seller" element={guard(SELLER, <SellerDashboard />)} />
            <Route path="/seller/products" element={guard(SELLER, <SellerProducts />)} />
            <Route path="/seller/products/new" element={guard(SELLER, <ProductForm />)} />
            <Route path="/seller/products/:id/edit" element={guard(SELLER, <ProductForm />)} />
            <Route path="/seller/orders" element={guard(SELLER, <SellerOrders />)} />
            <Route path="/seller/orders/:id" element={guard(SELLER, <OrderDetail seller />)} />
            <Route path="/seller/settings" element={guard(SELLER, <SellerSettings />)} />

            <Route path="/mandi" element={<MandiBhav />} />
            <Route path="/mandi/calculator" element={<Calculator />} />
            <Route path="/vyapar" element={<Vyapar />} />
            <Route path="/vyapar/brokers/:id" element={<BrokerProfile />} />
            <Route path="/vyapar/deals/:id" element={guard(['farmer', 'broker', 'admin'], <DealDetail />)} />

            <Route path="/admin" element={guard(['admin'], <AdminDashboard />)} />
            <Route path="/admin/users" element={guard(['admin'], <AdminUsers />)} />

            <Route
              path="*"
              element={
                <div className="container page">
                  <div className="empty stack">
                    <h2>Page not found</h2>
                    <a className="btn" href="/">
                      Go home
                    </a>
                  </div>
                </div>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
