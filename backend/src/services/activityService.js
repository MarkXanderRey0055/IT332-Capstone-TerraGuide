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
      relatedId: transaction._id,
      relatedModel: 'Transaction',
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
      relatedId: transaction._id,
      relatedModel: 'Transaction',
    };
  }

  return {
    type: 'transaction_created',
    title: 'New transaction created',
    description: `${transaction.reference} was created for ${propertyName}.`,
    timestamp: transaction.createdAt,
    relatedId: transaction._id,
    relatedModel: 'Transaction',
  };
}

function classifyRequestEvent(record, { kind, buyerName, propertyName }) {
  const updatedMs = new Date(record.updatedAt).getTime();
  const createdMs = new Date(record.createdAt).getTime();
  if (Number.isFinite(updatedMs) && Number.isFinite(createdMs) && updatedMs - createdMs > STATUS_CHANGE_GRACE_MS) {
    const isInquiry = kind === 'inquiry';
    return {
      type: isInquiry ? (record.status === 'Responded' ? 'inquiry_responded' : 'inquiry_status_changed') : 'site_visit_status_changed',
      title: isInquiry ? (record.status === 'Responded' ? 'Inquiry response updated' : 'Inquiry status updated') : 'Site visit status updated',
      description: isInquiry
        ? (record.status === 'Responded'
          ? `${buyerName} received a response about ${propertyName}.`
          : `The inquiry from ${buyerName} about ${propertyName} changed to ${record.status}.`)
        : `${buyerName}'s site visit request for ${propertyName} changed to ${record.status}.`,
      timestamp: record.updatedAt,
      relatedId: record._id,
      relatedModel: kind === 'inquiry' ? 'Inquiry' : 'SiteVisit',
    };
  }
  const isInquiry = kind === 'inquiry';
  return {
    type: isInquiry ? 'inquiry_created' : 'site_visit_created',
    title: isInquiry ? 'New property inquiry' : 'New site visit request',
    description: isInquiry
      ? `${buyerName} sent an inquiry about ${propertyName}.`
      : `${buyerName} requested a site visit for ${propertyName}.`,
    timestamp: record.createdAt,
    relatedId: record._id,
    relatedModel: kind === 'inquiry' ? 'Inquiry' : 'SiteVisit',
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
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('buyerId', 'fullName username')
      .populate('propertyId', 'name')
      .select('buyerId propertyId status adminResponse createdAt updatedAt'),
    SiteVisit.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('buyerId', 'fullName username')
      .populate('propertyId', 'name')
      .select('buyerId propertyId status createdAt updatedAt'),
  ]);

  const events = [
    ...recentProperties.map((p) => ({
      type: 'property_added',
      title: 'New property added',
      description: `${p.name} was added to the property listings.`,
      timestamp: p.createdAt,
      relatedId: p._id,
      relatedModel: 'Property',
    })),
    ...recentBuyers.map((b) => ({
      type: 'buyer_registered',
      title: 'New buyer registered',
      description: `${b.username} registered through the Buyer Portal.`,
      timestamp: b.createdAt,
      relatedId: b._id,
      relatedModel: 'User',
    })),
    ...recentTransactions.map(classifyTransactionEvent),
    ...recentInquiries.map((inq) => {
      const buyerName = inq.buyerId?.fullName || inq.buyerId?.username || 'A buyer';
      const propertyName = inq.propertyId?.name || 'a property';
      return classifyRequestEvent(inq, { kind: 'inquiry', buyerName, propertyName });
    }),
    ...recentSiteVisits.map((visit) => {
      const buyerName = visit.buyerId?.fullName || visit.buyerId?.username || 'A buyer';
      const propertyName = visit.propertyId?.name || 'a property';
      return classifyRequestEvent(visit, { kind: 'site_visit', buyerName, propertyName });
    }),
  ];

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, limit);
}
