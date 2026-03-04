-- Add optional profile characteristic fields for model public description.
ALTER TABLE "Model"
ADD COLUMN "genderIdentity" TEXT,
ADD COLUMN "genitalia" TEXT,
ADD COLUMN "sexualPreference" TEXT,
ADD COLUMN "ethnicity" TEXT,
ADD COLUMN "eyeColor" TEXT,
ADD COLUMN "hairStyle" TEXT,
ADD COLUMN "hairLength" TEXT,
ADD COLUMN "shoeSize" TEXT,
ADD COLUMN "silicone" TEXT,
ADD COLUMN "tattoos" TEXT,
ADD COLUMN "piercings" TEXT,
ADD COLUMN "smoker" TEXT,
ADD COLUMN "languages" TEXT;
