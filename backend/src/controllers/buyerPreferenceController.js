import * as preferenceService from "../services/buyerPreferenceService.js";

export const savePreference = async (req, res) => {

  try {

    const preference =
      await preferenceService.createOrUpdatePreference(
        req.user._id,
        req.body
      );

    res.status(200).json({
      success: true,
      message: "Buyer preferences saved successfully.",
      data: preference,
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }

};

export const getMyPreference = async (req, res) => {

  const preference =
    await preferenceService.getPreferenceByUser(
      req.user._id
    );

  res.json({
    success: true,
    data: preference,
  });

};