import mongoose from 'mongoose';

//! CHECK ON THIS ONE 

const verificationTokenSchema = new mongoose.Schema(
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
verificationTokenSchema.index({ token: 1 }, { unique: true });

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

export default VerificationToken;