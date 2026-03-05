-- Add optional weekly attendance schedule for model public profile.
ALTER TABLE "Model"
ADD COLUMN "attendanceSchedule" JSONB;
