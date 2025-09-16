import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Action is required.'],
      minLength: [3, 'Action must have at least 3 characters.'],
      maxLength: [64, 'Action must not exceed 64 characters.'],
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Player ID is required.'],
    },
    details: {
      type: Object,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Create index for timestamp
auditLogSchema.index({ timestamp: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;