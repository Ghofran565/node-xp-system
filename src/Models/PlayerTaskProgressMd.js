import mongoose from 'mongoose';

const playerTaskProgressSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Player ID is required.'],
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task ID is required.'],
      index: true,
    },
    completions: {
      type: Number,
      default: 0,
      min: [0, 'Completions cannot be negative.'],
    },
    lastCompleted: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

// Create composite index for playerId and taskId
// playerTaskProgressSchema.index({ playerId: 1, taskId: 1 }, { unique: true });

const PlayerTaskProgress = mongoose.model('PlayerTaskProgress', playerTaskProgressSchema);

export default PlayerTaskProgress;