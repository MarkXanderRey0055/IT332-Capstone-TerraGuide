import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Property from '../models/Property.js';

const INQUIRY_CLOSING_STATUSES = ['Not interested', 'Property unavailable', 'Duplicate'];

function logNotificationFailure(label, error, notification = {}) {
  try {
    console.error(`[notificationService] ${label}`, {
      errorName: error?.name || 'Error',
      errorCode: error?.code,
      errorMessage: typeof error?.message === 'string' ? error.message.slice(0, 300) : 'Unknown notification error',
      relatedId: notification.relatedId?.toString?.(),
      relatedModel: notification.relatedModel,
      ...(notification.relatedModel === 'SiteVisit' ? { siteVisitId: notification.relatedId?.toString?.() } : {}),
    });
  } catch {
    // Logging is also best-effort; it must never interfere with the main workflow.
  }
}

async function safelyCreateNotifications(notifications) {
  const results = await Promise.allSettled(notifications.map(async (notification) => Notification.create(notification)));
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      logNotificationFailure('Notification creation failed', result.reason, notifications[index]);
    }
  }
}

async function notifyAdmins({ type, title, message, relatedId, relatedModel }) {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (!admins.length) return;
    await safelyCreateNotifications(admins.map((admin) => ({
      recipientId: admin._id,
      type,
      title,
      message,
      relatedId,
      relatedModel,
    })));
  } catch (error) {
    logNotificationFailure('Could not load admin recipients', error, { relatedId, relatedModel });
  }
}

async function notifyBuyer({ buyerId, type, title, message, relatedId, relatedModel }) {
  if (!buyerId) return;
  await safelyCreateNotifications([{
    recipientId: buyerId,
    type,
    title,
    message,
    relatedId,
    relatedModel,
  }]);
}

export const notifyAdminsOfNewInquiry = (inquiry) => notifyAdmins({
  type: 'inquiry_new',
  title: 'New buyer inquiry',
  message: 'A buyer submitted an inquiry.',
  relatedId: inquiry._id,
  relatedModel: 'Inquiry',
});

export const notifyAdminsOfNewSiteVisit = (siteVisit) => notifyAdmins({
  type: 'site_visit_new',
  title: 'New site visit request',
  message: 'A buyer requested a site visit.',
  relatedId: siteVisit._id,
  relatedModel: 'SiteVisit',
});

export const notifyBuyerOfInquiryUpdate = async ({ inquiry, statusChanged, responseChanged }) => {
  if (!statusChanged && !responseChanged) return;
  if (statusChanged && INQUIRY_CLOSING_STATUSES.includes(inquiry.status)) {
    let propertyName = inquiry.propertyId?.name;
    if (!propertyName) {
      try {
        const property = await Property.findById(inquiry.propertyId);
        propertyName = property?.name;
      } catch (error) {
        logNotificationFailure('Could not load property name for inquiry closure', error, {
          relatedId: inquiry._id,
          relatedModel: 'Inquiry',
        });
      }
    }
    await notifyBuyer({
      buyerId: inquiry.buyerId,
      type: 'inquiry_closed',
      title: 'Your inquiry was closed',
      message: `Your inquiry about ${propertyName || 'this property'} was closed: ${inquiry.status}.`,
      relatedId: inquiry._id,
      relatedModel: 'Inquiry',
    });
    return;
  }
  const returnedToPending = statusChanged && inquiry.status === 'Pending';
  await notifyBuyer({
    buyerId: inquiry.buyerId,
    type: 'inquiry_responded',
    title: returnedToPending ? 'Inquiry updated' : 'Administrator responded to your inquiry',
    message: returnedToPending
      ? 'Your inquiry was returned to Pending and its previous response was cleared.'
      : (inquiry.status === 'Responded'
        ? 'An administrator has responded to your inquiry.'
        : 'An administrator updated your inquiry.'),
    relatedId: inquiry._id,
    relatedModel: 'Inquiry',
  });
};

export const notifyBuyerOfInquiryConverted = async (inquiry) => {
  let propertyName = inquiry.propertyId?.name;
  if (!propertyName) {
    try {
      const property = await Property.findById(inquiry.propertyId);
      propertyName = property?.name;
    } catch (error) {
      logNotificationFailure('Could not load property name for inquiry conversion', error, {
        relatedId: inquiry._id,
        relatedModel: 'Inquiry',
      });
    }
  }
  await notifyBuyer({
    buyerId: inquiry.buyerId,
    type: 'inquiry_converted',
    title: 'Your inquiry is being processed',
    message: `Your inquiry about ${propertyName || 'this property'} has been converted into a transaction. The TerraGuide team will follow up with you.`,
    relatedId: inquiry._id,
    relatedModel: 'Inquiry',
  });
};

export const notifyBuyerOfSiteVisitUpdate = async ({ siteVisit, statusChanged, responseChanged, scheduleChanged }) => {
  if (!statusChanged && !responseChanged && !scheduleChanged) return;

  let type = 'site_visit_responded';
  let title = 'Site visit request updated';
  let message = 'An administrator updated your site visit request.';
  if (siteVisit.status === 'Scheduled') {
    type = 'site_visit_scheduled';
    title = 'Site visit scheduled';
    message = siteVisit.confirmedDate && siteVisit.confirmedTime
      ? `Your site visit is confirmed for ${new Date(siteVisit.confirmedDate).toLocaleDateString('en-PH')} at ${siteVisit.confirmedTime}.`
      : 'An administrator updated the confirmed time for your site visit.';
  } else if (siteVisit.status === 'Completed') {
    type = 'site_visit_completed';
    title = 'Site visit completed';
    message = 'Your site visit request has been marked Completed.';
  } else if (statusChanged) {
    message = 'Your site visit request status was updated to Pending.';
  }

  await notifyBuyer({
    buyerId: siteVisit.buyerId,
    type,
    title,
    message,
    relatedId: siteVisit._id,
    relatedModel: 'SiteVisit',
  });
};
