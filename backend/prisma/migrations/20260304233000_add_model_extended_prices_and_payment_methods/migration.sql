-- Add extended pricing options and accepted payment methods for models.
ALTER TABLE "Model"
ADD COLUMN "price2Hours" INTEGER,
ADD COLUMN "price4Hours" INTEGER,
ADD COLUMN "priceOvernight" INTEGER,
ADD COLUMN "paymentMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
