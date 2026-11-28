import mongoose from 'mongoose';
import User from '../models/User.js';
import BuyerPreference from '../models/BuyerPreference.js';
import Inquiry from '../models/Inquiry.js';
import SiteVisit from '../models/SiteVisit.js';
import Transaction, { ACTIVE_TRANSACTION_STATUSES } from '../models/Transaction.js';
import AppError from '../utils/errors.js';
import { registerUser } from './authService.js';
import { createOrUpdatePreference } from './buyerPreferenceService.js';

const EDITABLE_USER_FIELDS = ['fullName', 'email', 'address'];

const EDITABLE_PREFERENCE_FIELDS = [
  'budgetMin',
  'budgetMax',
  'landType',
  'intendedUse',
  'location',
  'minLotSize',
];

function pick(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

export const listBuyers = async (search) => {
  const query = { role: 'buyer' };

  if (search && search.trim()) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ username: regex }, { email: regex }, { fullName: regex }];
  }

  const buyers = await User.find(query).select('-password -profilePicturePublicId').sort({ createdAt: -1 });

  if (buyers.length === 0) {
    return [];
  }

  const buyerIds = buyers.map((b) => b._id);
  const preferences = await BuyerPreference.find({ userId: { $in: buyerIds } });
  const preferencesByUserId = new Map(preferences.map((p) => [p.userId.toString(), p]));

  return buyers.map((buyer) => {
    const pref = preferencesByUserId.get(buyer._id.toString()) || null;
    return {
      userId: buyer._id,
      fullName: buyer.fullName ?? '',
      username: buyer.username,
      email: buyer.email,
      contactNumber: buyer.contactNumber ?? buyer.phone ?? null,
      address: buyer.address ?? '',
      profilePictureUrl: buyer.profilePictureUrl ?? null,
      registeredAt: buyer.createdAt,
      preferences: pref
        ? {
            landType: pref.landType,
            intendedUse: pref.intendedUse,
            budgetMin: pref.budgetMin,
            budgetMax: pref.budgetMax,
            location: pref.location,
            minLotSize: pref.minLotSize,
            updatedAt: pref.updatedAt,
          }
        : null,
    };
  });
};

function formatRelatedProperty(propertyDoc) {
  if (!propertyDoc || typeof propertyDoc !== 'object') return null;
  return {
    id: String(propertyDoc._id),
    name: propertyDoc.name || null,
    location: propertyDoc.location || null,
    type: propertyDoc.type || null,
    status: propertyDoc.status || null,
    price: propertyDoc.price ?? null,
  };
}

export const getBuyerDetails = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid buyer ID.', 400);
  }

  const buyer = await User.findOne({ _id: userId, role: 'buyer' }).select('-password -profilePicturePublicId');
  if (!buyer) {
    throw new AppError('Buyer account not found.', 404);
  }

  const [pref, inquiries, siteVisits, transactions] = await Promise.all([
    BuyerPreference.findOne({ userId: buyer._id }),
    Inquiry.find({ buyerId: buyer._id })
      .populate('propertyId', 'name location type status price')
      .sort({ createdAt: -1 }),
    SiteVisit.find({ buyerId: buyer._id })
      .populate('propertyId', 'name location type status')
      .sort({ createdAt: -1 }),
    Transaction.find({ buyerId: buyer._id })
      .populate('propertyId', 'name location type status price')
      .sort({ createdAt: -1 }),
  ]);

  return {
    userId: buyer._id,
    fullName: buyer.fullName ?? '',
    username: buyer.username,
    email: buyer.email,
    contactNumber: buyer.contactNumber ?? buyer.phone ?? null,
    address: buyer.address ?? '',
    profilePictureUrl: buyer.profilePictureUrl ?? null,
    registeredAt: buyer.createdAt,
    preferences: pref
      ? {
          landType: pref.landType,
          intendedUse: pref.intendedUse,
          budgetMin: pref.budgetMin,
          budgetMax: pref.budgetMax,
          location: pref.location,
          minLotSize: pref.minLotSize,
          updatedAt: pref.updatedAt,
        }
      : null,
    inquiries: inquiries.map((item) => ({
      id: String(item._id),
      property: formatRelatedProperty(item.propertyId),
      status: item.status,
      message: item.message || '',
      createdAt: item.createdAt,
    })),
    siteVisits: siteVisits.map((item) => ({
      id: String(item._id),
      property: formatRelatedProperty(item.propertyId),
      preferredDate: item.preferredDate,
      preferredTime: item.preferredTime || '',
      status: item.status,
      notes: item.notes || '',
      createdAt: item.createdAt,
    })),
    transactions: transactions.map((item) => ({
      id: String(item._id),
      reference: item.reference || '',
      property: formatRelatedProperty(item.propertyId),
      amount: item.amount ?? null,
      status: item.status,
      createdAt: item.createdAt,
      completedAt: item.completedAt ?? null,
    })),
  };
};


export const createBuyer = async (payload) => {
  const { username, email, password, fullName, address, ...prefFields } = payload;

  const { user } = await registerUser({
    username,
    email,
    password,
    role: 'buyer',
    fullName,
    address,
  });

  const prefPayload = pick(prefFields, EDITABLE_PREFERENCE_FIELDS);
  const hasAllRequiredPrefFields = EDITABLE_PREFERENCE_FIELDS.every(
    (key) => key === 'minLotSize' || prefPayload[key] !== undefined
  );

  if (hasAllRequiredPrefFields) {
    await createOrUpdatePreference(user._id, prefPayload);
  }

  return user;
};

export const updateBuyer = async (userId, payload) => {
  const buyer = await User.findOne({ _id: userId, role: 'buyer' });
  if (!buyer) {
    throw new AppError('Buyer account not found.', 404);
  }

  const userUpdates = pick(payload, EDITABLE_USER_FIELDS);
  if (Object.keys(userUpdates).length > 0) {
    Object.assign(buyer, userUpdates);
    await buyer.save();
  }

  const prefKeysInPayload = EDITABLE_PREFERENCE_FIELDS.filter(
    (key) => payload[key] !== undefined
  );

  if (prefKeysInPayload.length > 0) {
    const existing = await BuyerPreference.findOne({ userId });

    const existingData = {};
    if (existing) {
      for (const field of EDITABLE_PREFERENCE_FIELDS) {
        if (existing[field] !== undefined) {
          existingData[field] = existing[field];
        }
      }
    }

    const prefUpdates = {};
    for (const key of prefKeysInPayload) {
      const val = payload[key];
      if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
        prefUpdates[key] = null;
      } else {
        prefUpdates[key] = val;
      }
    }

    const merged = { ...existingData, ...prefUpdates };

    const hasAnyActivePreference = EDITABLE_PREFERENCE_FIELDS.some(
      (key) => merged[key] !== null && merged[key] !== undefined && merged[key] !== ''
    );

    if (!hasAnyActivePreference) {
      if (existing) {
        await BuyerPreference.findOneAndDelete({ userId });
      }
    } else {
      await createOrUpdatePreference(userId, merged);
    }
  }

  const updatedPref = await BuyerPreference.findOne({ userId });

  return {
    userId: buyer._id,
    fullName: buyer.fullName,
    username: buyer.username,
    email: buyer.email,
    address: buyer.address,
    registeredAt: buyer.createdAt,
    preferences: updatedPref
      ? {
          landType: updatedPref.landType,
          intendedUse: updatedPref.intendedUse,
          budgetMin: updatedPref.budgetMin,
          budgetMax: updatedPref.budgetMax,
          location: updatedPref.location,
          minLotSize: updatedPref.minLotSize,
          updatedAt: updatedPref.updatedAt,
        }
      : null,
  };
};

export const deleteBuyer = async (userId) => {
  const activeTx = await Transaction.findOne({
    buyerId: userId,
    status: { $in: ACTIVE_TRANSACTION_STATUSES },
  });
  if (activeTx) {
    throw new AppError(
      `Cannot delete buyer because they have an active transaction (${activeTx.reference || activeTx.status}). Please complete or cancel the transaction first.`,
      409
    );
  }

  const buyer = await User.findOneAndDelete({ _id: userId, role: 'buyer' });
  if (!buyer) {
    throw new AppError('Buyer account not found.', 404);
  }

  await BuyerPreference.findOneAndDelete({ userId });

  return buyer;
};