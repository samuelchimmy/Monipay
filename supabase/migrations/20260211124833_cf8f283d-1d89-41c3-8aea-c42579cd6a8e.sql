-- Normalize existing chain values to lowercase
UPDATE activation_fundings SET chain = LOWER(chain) WHERE chain != LOWER(chain);

-- Add a trigger to auto-lowercase chain on insert/update
CREATE OR REPLACE FUNCTION normalize_chain_lowercase()
RETURNS TRIGGER AS $$
BEGIN
  NEW.chain := LOWER(NEW.chain);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_normalize_chain_activation_fundings
BEFORE INSERT OR UPDATE ON activation_fundings
FOR EACH ROW
EXECUTE FUNCTION normalize_chain_lowercase();