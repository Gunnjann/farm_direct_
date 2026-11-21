import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFetch, useToast } from '../../context/AppContext';
import { api, qs } from '../../lib/api';
import { date } from '../../lib/format';
import { Button, ErrorBox, Loading } from '../../components/ui';
import { useT } from '../../lib/i18n';

export default function AdminUsers() {
  const [sp, setSp] = useSearchParams();
  const toast = useToast();
  const { tr } = useT();
  const [q, setQ] = useState(sp.get('q') || '');
  const role = sp.get('role') || '';
  const unverified = sp.get('unverified') || '';
  const { data, error, loading, reload } = useFetch(`/admin/users${qs({ role, unverified, q: sp.get('q') })}`);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };
  const update = async (u, body, msg) => {
    try {
      await api(`/admin/users/${u._id}`, { method: 'PATCH', body });
      toast(msg, 'ok');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="container page stack">
      <h1 style={{ margin: 0 }}>Users</h1>
      <div className="row">
        <form
          className="row grow"
          onSubmit={(e) => {
            e.preventDefault();
            set('q', q);
          }}
        >
          <input className="input grow" placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        </form>
        <select className="input" style={{ width: 'auto' }} value={role} onChange={(e) => set('role', e.target.value)} aria-label="Role">
          <option value="">All roles</option>
          {['customer', 'retailer', 'farmer', 'trader', 'broker', 'admin'].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button className="chip" aria-pressed={!!unverified} onClick={() => set('unverified', unverified ? '' : 'true')}>
          Unverified sellers
        </button>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Seller</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u._id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                  <td>
                    <strong>{u.name}</strong>
                    <div className="tiny muted">
                      {u.email}
                      {u.phone && ` · ${u.phone}`}
                    </div>
                  </td>
                  <td className="mono small">{u.role}</td>
                  <td className="small">{date(u.createdAt)}</td>
                  <td className="small">
                    {u.brokerProfile ? (
                      <>
                        {u.brokerProfile.businessName}
                        <div className="tiny muted">
                          {u.brokerProfile.district}, {u.brokerProfile.state} · {tr('licence', 'लाइसेंस')}: {u.brokerProfile.licenseNumber || '—'}
                        </div>
                        {u.brokerProfile.verified ? <span className="badge leaf">Verified</span> : <span className="badge turmeric">Pending</span>}
                      </>
                    ) : u.supplierProfile ? (
                      <>
                        {u.supplierProfile.displayName}
                        <div className="tiny muted">
                          {[u.supplierProfile.village, u.supplierProfile.district].filter(Boolean).join(', ')} · {u.supplierProfile.serviceAreas?.length || 0} pincodes
                        </div>
                        {u.supplierProfile.verified ? <span className="badge leaf">Verified</span> : <span className="badge turmeric">Pending</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ '--gap': '6px' }}>
                      {(u.supplierProfile || u.brokerProfile) && (() => {
                        const v = (u.brokerProfile || u.supplierProfile).verified;
                        return (
                          <Button size="sm" variant={v ? 'ghost' : 'leaf'} onClick={() => update(u, { verified: !v }, v ? 'Verification removed' : 'Verified')}>
                            {v ? 'Unverify' : 'Verify'}
                          </Button>
                        );
                      })()}
                      {u.role !== 'admin' && (
                        <Button size="sm" variant="ghost" onClick={() => update(u, { isActive: !u.isActive }, u.isActive ? 'Account disabled' : 'Account enabled')}>
                          {u.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
