import mongoose from 'mongoose';

const studySessionSchema = mongoose.Schema({
  user:              { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  title:             { type: String, required: true },
  subject:           { type: String, required: true },
  mode:              { type: String, enum: ['work', 'short', 'long'], default: 'work' },
  notes:             { type: String, default: '' },
  startTime:         { type: Date, required: true },
  status:            { type: String, enum: ['running', 'paused', 'completed', 'abandoned'], default: 'running' },
  duration:          { type: Number, default: 0 },
  pausedDuration:    { type: Number, default: 0 },
  lastPausedAt:      { type: Date, default: null },
  clockifyEntryId:   { type: String, default: null },
}, { timestamps: true });

// Instance methods
studySessionSchema.methods.pause = function() {
  this.status = 'paused';
  this.lastPausedAt = new Date();
};

studySessionSchema.methods.resume = function() {
  if (this.lastPausedAt) {
    const pauseTime = Math.floor((new Date() - this.lastPausedAt) / 1000);
    this.pausedDuration += pauseTime;
  }
  this.status = 'running';
  this.lastPausedAt = null;
};

studySessionSchema.methods.stop = function() {
  if (this.status === 'running') {
    this.duration = Math.floor((new Date() - this.startTime) / 1000);
  } else if (this.status === 'paused') {
    this.duration = Math.floor((new Date() - this.startTime) / 1000);
  }
  this.status = 'completed';
};

export default mongoose.model('StudySession', studySessionSchema);