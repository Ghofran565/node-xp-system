import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
    },
    groupName: {
      type: String,
      required: [true, 'Group name is required.'],
      minLength: [3, 'Group name must have at least 3 characters.'],
      maxLength: [32, 'Group name must not exceed 32 characters.'],
      index: true,
    },
    xpBooster: {
      type: Number,
      required: [true, 'XP booster is required.'],
      min: [1.0, 'XP booster must be at least 1.'],
    },
  },
  { timestamps: true }
);

// Create index for groupName
groupSchema.index({ groupName: 1 }, { unique: true });

const Group = mongoose.model('Group', groupSchema);

export default Group;