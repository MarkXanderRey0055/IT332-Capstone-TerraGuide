import BuyerPreference from "../models/buyerPreference.js";

export const createOrUpdatePreference = async (
  userId,
  data
) => {

  return await BuyerPreference.findOneAndUpdate(
    { userId },
    {
      ...data,
      userId,
    },
    {
      new: true,
      upsert: true,
    }
  );

};

export const getPreferenceByUser = async (
  userId
) => {

  return await BuyerPreference.findOne({
    userId,
  });

};