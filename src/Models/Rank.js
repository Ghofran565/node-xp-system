import mongoose from 'mongoose';

const rankSchema = new mongoose.Schema(
  {
    rankId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
    },
    rankName: {
      type: String,
      required: [true, 'Rank name is required.'],
      minLength: [3, 'Rank name must have at least 3 characters.'],
      maxLength: [32, 'Rank name must not exceed 32 characters.'],
      index: true,
    },
    minXp: {
      type: Number,
      required: [true, 'Minimum XP is required.'],
      min: [0, 'Minimum XP cannot be negative.'],
    },
    xpBooster: {
      type: Float16Array,
      required: [true, 'XP booster is required.'],
      min: [1.0, 'XP booster must be at least 1.'],
    },
  },
  { timestamps: true }
);

// Create index for rankName
rankSchema.index({ rankName: 1 }, { unique: true });

const Rank = mongoose.model('Rank', rankSchema);

export default Rank;