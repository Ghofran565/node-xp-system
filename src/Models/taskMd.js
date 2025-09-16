import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
   {
      taskId: {
         type: mongoose.Schema.Types.ObjectId,
         default: () => new mongoose.Types.ObjectId(),
         unique: true,
         index: true,
      },
      title: {
         type: String,
         required: [true, 'Title is required.'],
         minLength: [3, 'Title must have at least 3 characters.'],
         maxLength: [32, 'Title must not exceed 32 characters.'],
      },
      xpReward: {
         type: Number,
         required: [true, 'XP reward is required.'],
         min: [1, 'XP reward must be greater than 0.'],
      },
      maxCompletions: {
         type: Number,
         default: 0, // 0 means unlimited
         min: [0, 'Max completions cannot be negative.'],
      },
      cooldown: {
         type: Timestamp,
         default: 0,
         min: [0, 'Timestamp cannot be negative.'],
      },
      groups: {
         type: [
            {
               type: mongoose.Schema.Types.ObjectId,
               ref: 'Group',
            },
         ],
         default: [],
         index: true,
      },
      playersBypass: {
         type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
         default: [],
         index: true,
      },
      // category: { //! check the road map
      //    type: String,
      //    required: [true, 'Category is required.'],
      //    enum: ['daily', 'tournament', 'weekly', 'special'],
      //    index: true,
      // },
      tournamentId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Tournament',
         index: true,
         required: false,
      },
      startTime: {
         type: Date,
         index: true,
         required: false,
      },
      endTime: {
         type: Date,
         index: true,
         required: false,
      },
   },
   { timestamps: true }
);

taskSchema.index({ taskId: 1 });
taskSchema.index({ groups: 1 });
taskSchema.index({ playersBypass: 1 });
taskSchema.index({ tournamentId: 1 });
taskSchema.index({ category: 1 });
taskSchema.index({ startTime: 1 });
taskSchema.index({ endTime: 1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;