import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema(
   {
      tournamentId: {
         type: mongoose.Schema.Types.ObjectId,
         default: () => new mongoose.Types.ObjectId(),
         unique: true,
         index: true,
      },
      name: {
         type: String,
         required: [true, 'Tournament name is required.'],
         minLength: [3, 'Tournament name must have at least 3 characters.'],
         maxLength: [64, 'Tournament name must not exceed 64 characters.'],
      },
      startTime: {
         type: Date,
         required: [true, 'Start time is required.'],
         index: true,
      },
      endTime: {
         type: Date,
         required: [true, 'End time is required.'],
         index: true,
      },
      participants: {
         type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
         default: [],
      },
      tournamentGroups: {
         type: [
            {
               type: mongoose.Schema.Types.ObjectId,
               ref: 'Rank',
            },
         ],
         default: [],
         index: true,
      },
   },
   { timestamps: true }
);

// Create indexes
tournamentSchema.index({ tournamentId: 1 });
tournamentSchema.index({ startTime: 1 });
tournamentSchema.index({ endTime: 1 });
tournamentSchema.index({ tournamentGroups: 1 });

const Tournament = mongoose.model('Tournament', tournamentSchema);

export default Tournament;