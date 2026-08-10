import User from '../models/User.js';
import BuyerPreference from '../models/BuyerPreference.js';
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

  const buyers = await User.find(query).select('-password').sort({ createdAt: -1 });

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
      fullName: buyer.fullName,
      username: buyer.username,
      email: buyer.email,
      address: buyer.address,
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

  const prefUpdates = pick(payload, EDITABLE_PREFERENCE_FIELDS);
  if (Object.keys(prefUpdates).length > 0) {
  
    const existing = await BuyerPreference.findOne({ userId });
    const merged = existing ? { ...existing.toObject(), ...prefUpdates } : prefUpdates;
    await createOrUpdatePreference(userId, merged);
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
  const buyer = await User.findOneAndDelete({ _id: userId, role: 'buyer' });
  if (!buyer) {
    throw new AppError('Buyer account not found.', 404);
  }

  await BuyerPreference.findOneAndDelete({ userId });

  return buyer;
};