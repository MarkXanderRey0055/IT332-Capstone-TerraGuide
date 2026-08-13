import mongoose from 'mongoose';
import Transaction, { ACTIVE_TRANSACTION_STATUSES, TRANSACTION_STATUSES } from '../models/Transaction.js';
import User from '../models/User.js';
import Property from '../models/Property.js';
import AppError from '../utils/errors.js';
import { updateProperty as updatePropertyRecord } from './propertyService.js';

const POPULATE_BUYER = 'fullName username email';
const POPULATE_PROPERTY = 'name location type status price';
const POPULATE_CREATED_BY = 'fullName username';

function populateTransaction(query) {
  return query
    .populate('buyerId', POPULATE_BUYER)
    .populate('propertyId', POPULATE_PROPERTY)
    .populate('createdBy', POPULATE_CREATED_BY);
}

// The only transitions allowed. Completed and Cancelled are both terminal
// — a completed sale can't be cancelled, and a cancelled deal can't be
// reopened (a genuinely new attempt should be a new transaction, keeping
// the history honest).
const ALLOWED_TRANSITIONS = {
  Reserved: ['Processing', 'Completed', 'Cancelled'],
  Processing: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

/**
 * Lists transactions with buyer/property populated. Since buyer/property
 * names are never duplicated onto the Transaction document itself, text
 * search happens after populating rather than as a database-level regex —
 * perfectly fine at this dataset size and avoids an aggregation pipeline
 * for something this small.
 */
export const listTransactions = async ({ status, buyerId, propertyId, search } = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (buyerId) filter.buyerId = buyerId;
  if (propertyId) filter.propertyId = propertyId;

  let transactions = await populateTransaction(Transaction.find(filter)).sort({ createdAt: -1 });

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    transactions = transactions.filter((t) => {
      const buyerName = t.buyerId?.fullName?.toLowerCase() || '';
      const propertyName = t.propertyId?.name?.toLowerCase() || '';
      const reference = t.reference?.toLowerCase() || '';
      return buyerName.includes(term) || propertyName.includes(term) || reference.includes(term);
    });
  }

  return transactions;
};

export const getTransactionById = async (transactionId) => {
  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    throw new AppError('Invalid transaction ID.', 400);
  }

  const transaction = await populateTransaction(Transaction.findById(transactionId));
  if (!transaction) {
    throw new AppError('Transaction not found.', 404);
  }
  return transaction;
};

export const createTransaction = async ({ buyerId, propertyId, amount, notes, createdByUserId }) => {
  if (!buyerId || !mongoose.Types.ObjectId.isValid(buyerId)) {
    throw new AppError('A valid buyer is required.', 400);
  }
  if (!propertyId || !mongoose.Types.ObjectId.isValid(propertyId)) {
    throw new AppError('A valid property is required.', 400);
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    throw new AppError('Transaction amount must be a number of 0 or more.', 400);
  }

  const buyer = await User.findOne({ _id: buyerId, role: 'buyer' });
  if (!buyer) {
    throw new AppError('Buyer not found or is not a registered buyer account.', 400);
  }

  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found.', 400);
  }

  if (property.status === 'Sold') {
    throw new AppError('This property is already marked Sold and cannot have a new transaction created against it.', 409);
  }

  const existingActive = await Transaction.findOne({
    propertyId,
    status: { $in: ACTIVE_TRANSACTION_STATUSES },
  });
  if (existingActive) {
    throw new AppError(
      `This property already has an active transaction (${existingActive.status}). Complete or cancel it before creating a new one.`,
      409
    );
  }

  const transaction = await Transaction.create({
    buyerId,
    propertyId,
    amount: amountNum,
    notes: notes ? notes.trim() : '',
    createdBy: createdByUserId,
    status: 'Reserved',
  });

  // New transaction reserves the property, per the approved workflow.
  await updatePropertyRecord(propertyId, { status: 'Reserved' });

  return getTransactionById(transaction._id);
};

export const updateTransaction = async (transactionId, { amount, notes, status }) => {
  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    throw new AppError('Invalid transaction ID.', 400);
  }

  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    throw new AppError('Transaction not found.', 404);
  }

  if (amount !== undefined) {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      throw new AppError('Transaction amount must be a number of 0 or more.', 400);
    }
    transaction.amount = amountNum;
  }

  if (notes !== undefined) {
    transaction.notes = notes.trim();
  }

  if (status !== undefined && status !== transaction.status) {
    if (!TRANSACTION_STATUSES.includes(status)) {
      throw new AppError(`Status must be one of: ${TRANSACTION_STATUSES.join(', ')}`, 400);
    }

    const allowedNextStatuses = ALLOWED_TRANSITIONS[transaction.status] || [];
    if (!allowedNextStatuses.includes(status)) {
      throw new AppError(
        `Cannot change transaction status from "${transaction.status}" to "${status}".`,
        400
      );
    }

    if (status === 'Completed') {
      transaction.completedAt = new Date();
      await updatePropertyRecord(transaction.propertyId, { status: 'Sold' });
    }

    if (status === 'Cancelled') {
      // Only revert the property if it's still sitting Reserved because of
      // this transaction — don't clobber an unrelated status change.
      const property = await Property.findById(transaction.propertyId);
      if (property && property.status === 'Reserved') {
        await updatePropertyRecord(transaction.propertyId, { status: 'Available' });
      }
    }

    transaction.status = status;
  }

  await transaction.save();

  return getTransactionById(transaction._id);
};

/**
 * Backs the Admin Dashboard's "Pending Transactions" stat card — a real
 * count instead of the hardcoded placeholder it replaces.
 */
export const getPendingTransactionCount = async () => {
  return Transaction.countDocuments({ status: { $in: ACTIVE_TRANSACTION_STATUSES } });
};
