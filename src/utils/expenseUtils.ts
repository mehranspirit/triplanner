import { SplitMethod, SplitDetails, ExpenseParticipant } from '../types/expenseTypes';
import { User } from '../types/eventTypes';

// Utility function to round monetary values to 2 decimal places
export const roundToTwoDecimals = (value: number): number => {
  return parseFloat(value.toFixed(2));
};

// Utility function to calculate equal share with proper rounding
export const calculateEqualShare = (amount: number, participantCount: number): number => {
  return roundToTwoDecimals(amount / participantCount);
};

// Map participant shares from _id to userId format
export const mapParticipantShares = (participantShares: { [key: string]: number }, participants: User[]) => {
  return participants.reduce((acc, p) => {
    const share = participantShares[p._id] || 0;
    return { ...acc, [p._id]: share };
  }, {});
};

// Map userId to _id for participant shares
export const mapUserIdToId = (participantShares: { [key: string]: number }, participants: User[]) => {
  return participants.reduce((acc, p) => {
    const share = participantShares[p._id] || 0;
    return { ...acc, [p._id]: share };
  }, {});
};

// Map _id to userId for participant shares
export const mapIdToUserId = (participantShares: { [key: string]: number }, participants: User[]) => {
  return participants.reduce((acc, p) => {
    const share = participantShares[p._id] || 0;
    return { ...acc, [p._id]: share };
  }, {});
};

export const createParticipantWithSplitDetails = (
  participant: User,
  splitMethod: SplitMethod,
  amount: number,
  selectedParticipants: string[],
  participantShares: { [key: string]: number }
) => {
  const participantShare = participantShares[participant._id] || 0;
  let share = 0;
  const splitDetails: SplitDetails = {};

  if (splitMethod === 'equal') {
    share = calculateEqualShare(amount, selectedParticipants.length);
    splitDetails.equal = {
      splitCount: selectedParticipants.length
    };
  } else if (splitMethod === 'percentage') {
    const percentage = participantShare;
    share = roundToTwoDecimals((amount * percentage) / 100);
    splitDetails.percentage = {
      value: percentage
    };
  } else if (splitMethod === 'shares') {
    const totalShares = selectedParticipants.reduce(
      (sum, id) => sum + (participantShares[id] || 0),
      0
    );
    share = roundToTwoDecimals((amount * participantShare) / totalShares);
    splitDetails.shares = {
      value: participantShare,
      totalShares: totalShares
    };
  } else {
    share = roundToTwoDecimals(participantShare);
    splitDetails.custom = {
      amount: roundToTwoDecimals(participantShare)
    };
  }

  return {
    userId: participant._id,
    name: participant.name,
    share: share,
    splitDetails,
    settled: false
  };
}; 