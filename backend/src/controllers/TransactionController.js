import * as transactionService from '../services/transactionService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

export const getTransactions = asyncHandler(async (req, res) => {
  const { status, buyerId, propertyId, search } = req.query;
  const transactions = await transactionService.listTransactions({ status, buyerId, propertyId, search });
  return sendSuccess(res, 200, 'Transactions fetched successfully', transactions);
});


export const getPendingCount = asyncHandler(async (req, res) => {
  const pendingCount = await transactionService.getPendingTransactionCount();
  return sendSuccess(res, 200, 'Pending transaction count fetched successfully', { pendingCount });
});


export const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await transactionService.getTransactionById(req.params.id);
  return sendSuccess(res, 200, 'Transaction fetched successfully', transaction);
});


export const createTransaction = asyncHandler(async (req, res) => {
  const { buyerId, propertyId, amount, notes } = req.body;
  const transaction = await transactionService.createTransaction({
    buyerId,
    propertyId,
    amount,
    notes,
    createdByUserId: req.user._id,
  });
  return sendSuccess(res, 201, 'Transaction created successfully', transaction);
});


export const updateTransaction = asyncHandler(async (req, res) => {
  const { amount, notes, status } = req.body;
  const transaction = await transactionService.updateTransaction(req.params.id, { amount, notes, status });
  return sendSuccess(res, 200, 'Transaction updated successfully', transaction);
});
