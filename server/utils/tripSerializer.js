const serializeUserRef = (user) => {
  if (!user) return user;
  const id = user._id || user;
  return {
    _id: id.toString(),
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl || null,
  };
};

const serializeTrip = (trip) => {
  if (!trip) return null;

  const raw = typeof trip.toObject === 'function' ? trip.toObject() : trip;

  return {
    ...raw,
    _id: raw._id.toString(),
    owner: serializeUserRef(raw.owner),
    collaborators: (raw.collaborators || []).map((collaborator) => ({
      _id: collaborator._id?.toString(),
      role: collaborator.role,
      addedAt: collaborator.addedAt,
      user: serializeUserRef(collaborator.user),
    })),
  };
};

module.exports = {
  serializeTrip,
  serializeUserRef,
};
