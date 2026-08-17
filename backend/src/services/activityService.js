import Property from '../models/Property.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const STATUS_CHANGE_GRACE_MS = 2000;

function classifyTransactionEvent(transaction) {
  const propertyName = transaction.propertyId?.name || 'a property';

  if (transaction.status === 'Completed' && transaction.completedAt) {
    return {
      type: 'transaction_completed',
      title: 'Transaction completed',
      description: `${transaction.reference} for ${propertyName} was completed — property marked Sold.`,
      timestamp: transaction.completedAt,
    };
  }

  const createdMs = new Date(transaction.createdAt).getTime();
  const updatedMs = new Date(transaction.updatedAt).getTime();

  if (updatedMs - createdMs > STATUS_CHANGE_GRACE_MS) {
    return {
      type: 'transaction_status_changed',
      title: 'Transaction status updated',
      description: `${transaction.reference} for ${propertyName} changed to ${transaction.status}.`,
      timestamp: transaction.updatedAt,
    };
  }

  return {
    type: 'transaction_created',
    title: 'New transaction created',
    description: `${transaction.reference} was created for ${propertyName}.`,
    timestamp: transaction.createdAt,
  };
}

export async function getRecentActivity(limit = 8) {
  const [recentProperties, recentBuyers, recentTransactions] = await Promise.all([
    Property.find().sort({ createdAt: -1 }).limit(limit).select('name createdAt'),
    User.find({ role: 'buyer' }).sort({ createdAt: -1 }).limit(limit).select('username createdAt'),
    Transaction.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('propertyId', 'name')
      .select('status createdAt updatedAt completedAt propertyId'),
  ]);

  const events = [
    ...recentProperties.map((p) => ({
      type: 'property_added',
      title: 'New property added',
      description: `${p.name} was added to the property listings.`,
      timestamp: p.createdAt,
    })),
    ...recentBuyers.map((b) => ({
      type: 'buyer_registered',
      title: 'New buyer registered',
      description: `${b.username} registered through the Buyer Portal.`,
      timestamp: b.createdAt,
    })),
    ...recentTransactions.map(classifyTransactionEvent),
  ];

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, limit);
}
