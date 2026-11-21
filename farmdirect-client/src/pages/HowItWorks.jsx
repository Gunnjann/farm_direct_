import { Link } from 'react-router-dom';

const Section = ({ title, steps }) => (
  <div className="card stack">
    <div className="panel-title">{title}</div>
    <ol style={{ margin: 0, paddingLeft: 20 }} className="stack">
      {steps.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  </div>
);

export default function HowItWorks() {
  return (
    <div className="container page stack" style={{ maxWidth: 900, '--gap': '20px' }}>
      <h1>How FarmDirect works</h1>
      <p className="muted" style={{ fontSize: '1.1rem' }}>
        A marketplace — not a middleman. Farmers and traders set their own prices and deliver themselves (or offer pickup). FarmDirect handles discovery, payments, order tracking and complaints.
      </p>
      <Section
        title="For buyers"
        steps={[
          'Enter your pincode. You only see sellers who actually deliver there, with their real delivery fee.',
          'Check harvest date, grade and seller details. Bulk prices apply automatically.',
          'Pay online. Your money is linked to the order; if the seller rejects it, you are refunded in full.',
          'Track the order. If it arrives damaged, short or wrong, report it within 48 hours with photos.',
        ]}
      />
      <Section
        title="For farmers & traders"
        steps={[
          'Sign up, add your farm details and the pincodes you can deliver to (with your fee for each).',
          'List produce with price, stock, grade and harvest date. Add bulk tiers or a group-buy price.',
          'Accept or reject each order. Pack, deliver, and mark it delivered.',
          'Earnings = goods + delivery fee for every delivered order. FarmDirect charges buyers a small platform fee.',
        ]}
      />
      <Section
        title="Group orders"
        steps={[
          'Any buyer can start a group on a product with a group price, choosing a drop point and a deadline.',
          'Others join with their own quantity and pay their share. Spots are held for 15 minutes while paying.',
          'When paid quantity reaches the target by the deadline, the order is confirmed and goes to the seller.',
          'If not, everyone is refunded automatically. Full or closed groups never accept new members.',
        ]}
      />
      <Section
        title="Quality & responsibility"
        steps={[
          'Product descriptions, grades and organic claims come from the seller. FarmDirect does not grade produce unless marked as verified.',
          'The seller is responsible for what they send. Complaints go to the seller first, and a FarmDirect team member makes the final decision.',
          'The decision records who bears the cost (seller, delivery partner or platform), so refunds are fair.',
        ]}
      />
      <div className="row">
        <Link to="/shop" className="btn primary lg">
          Start shopping
        </Link>
        <Link to="/register?role=farmer" className="btn accent lg">
          Start selling
        </Link>
      </div>
    </div>
  );
}
