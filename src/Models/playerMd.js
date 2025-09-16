import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
   {
       playerId: {
            type: mongoose.Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId(),
            unique: true,
            index: true,
          },
      username: {
         type: String,
         required: [true, 'Username is required.'],
         unique: [true, 'Username was taken.'],
         minLength: [3, 'Username must have at least 3 characters.'],
         maxLength: [32, 'Username must not exceed 32 characters.'],
         match:[/^[a-z0-9_-]{3,15}$/g, 'Username is invalid, you can only use lower-case letters and numbers and "_" and "-"'],
         index: true,
      },
      email: {
         type: String,
         required: [true, 'Email is required.'],
         unique: [true, 'Email already used.'],
         match: [/[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/g, 'Email is invalid.'],
         index: true,
      },
      password: {
         type: String,
      },
      verified: {
         type: Boolean,
         default: false
      },
      profileImage: {
         type: String,
      },
      role: {
         type: String,
         default: 'user',
         enum: ['user', 'admin', 'mod', 'owner'],
         index: true,
      },
      rank: {
         type: Boolean,
         default: false
      },
      rank: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Rank',
         default: 'nemidonam', //! nemidonam
         index: true,
      },
      xp: {
         type: Number,
         default: 100
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
      lastUpdated: {
         type: Date,
         default: Date.now,
      },
   },
   { timestamps: true }
);

// Create indexes for efficient querying
playerSchema.index({ username: 1 }, { unique: true });
playerSchema.index({ email: 1 }, { unique: true });
playerSchema.index({ role: 1 });
playerSchema.index({ rank: 1 });
playerSchema.index({ groups: 1 });

const Player = mongoose.model('Player', playerSchema);

export default Player;