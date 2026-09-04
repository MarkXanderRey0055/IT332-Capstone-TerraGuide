import Property from '../models/Property.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Inquiry from '../models/Inquiry.js';
import SiteVisit from '../models/SiteVisit.js';

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
  const [recentProperties, recentBuyers, recentTransactions, recentInquiries, recentSiteVisits] = await Promise.all([
    Property.find().sort({ createdAt: -1 }).limit(limit).select('name createdAt'),
    User.find({ role: 'buyer' }).sort({ createdAt: -1 }).limit(limit).select('username createdAt'),
    Transaction.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('propertyId', 'name')
      .select('status createdAt updatedAt completedAt propertyId'),
    Inquiry.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('buyerId', 'fullName username')
      .populate('propertyId', 'name')
      .select('buyerId propertyId createdAt'),
    SiteVisit.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('buyerId', 'fullName username')
      .populate('propertyId', 'name')
      .select('buyerId propertyId createdAt'),
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
    ...recentInquiries.map((inq) => {
      const buyerName = inq.buyerId?.fullName || inq.buyerId?.username || 'A buyer';
      const propertyName = inq.propertyId?.name || 'a property';
      return {
        type: 'inquiry_created',
        title: 'New property inquiry',
        description: `${buyerName} sent an inquiry about ${propertyName}.`,
        timestamp: inq.createdAt,
      };
    }),
    ...recentSiteVisits.map((visit) => {
      const buyerName = visit.buyerId?.fullName || visit.buyerId?.username || 'A buyer';
      const propertyName = visit.propertyId?.name || 'a property';
      return {
        type: 'site_visit_created',
        title: 'New site visit request',
        description: `${buyerName} requested a site visit for ${propertyName}.`,
        timestamp: visit.createdAt,
      };
    }),
  ];

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, limit);
}