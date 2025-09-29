import mongoose from 'mongoose';

//! CHECK ON THIS ONE

const PasswordResetTokenSchema = new mongoose.Schema(
	{
		playerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Player ID is required.'],
		},
		email: {
			type: String,
			required: true,
		},
		code: {
			type: String,
			required: true,
		},
		createdAt: {
			type: Date,
			default: Date.now,
			expires: '5min',
		},
	},
	{ timestamps: true }
);

// Create index for token
// verificationTokenSchema.index({ token: 1 }, { unique: true });

const PasswordResetToken = mongoose.model(
	'PasswordResetToken',
	PasswordResetTokenSchema
);

export default PasswordResetToken;
