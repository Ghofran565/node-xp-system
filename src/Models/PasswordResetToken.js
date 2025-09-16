import mongoose from 'mongoose';

//! CHECK ON THIS ONE 

const passwordResetTokenSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Player ID is required.'],
    },
    token: {
      type: String,
      required: [true, 'Token is required.'],
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required.'],
    },
  },
  { timestamps: true }
);

// Create index for token
passwordResetTokenSchema.index({ token: 1 }, { unique: true });

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);

export default PasswordResetToken;