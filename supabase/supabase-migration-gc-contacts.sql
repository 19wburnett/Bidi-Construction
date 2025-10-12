-- Migration: Add GC contacts table for importing and managing contractor contacts
-- Run this in your Supabase SQL editor

-- Create gc_contacts table for storing GC's imported contacts
CREATE TABLE IF NOT EXISTS gc_contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  gc_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  trade_category TEXT NOT NULL,
  location TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique email per GC (same contact can be imported by different GCs)
  UNIQUE(gc_id, email)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gc_contacts_gc_id ON gc_contacts(gc_id);
CREATE INDEX IF NOT EXISTS idx_gc_contacts_trade_category ON gc_contacts(trade_category);
CREATE INDEX IF NOT EXISTS idx_gc_contacts_location ON gc_contacts(location);
CREATE INDEX IF NOT EXISTS idx_gc_contacts_email ON gc_contacts(email);

-- Enable Row Level Security
ALTER TABLE gc_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "GCs can view own contacts" ON gc_contacts
  FOR SELECT USING (auth.uid() = gc_id);

CREATE POLICY "GCs can insert own contacts" ON gc_contacts
  FOR INSERT WITH CHECK (auth.uid() = gc_id);

CREATE POLICY "GCs can update own contacts" ON gc_contacts
  FOR UPDATE USING (auth.uid() = gc_id);

CREATE POLICY "GCs can delete own contacts" ON gc_contacts
  FOR DELETE USING (auth.uid() = gc_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gc_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_gc_contacts_updated_at_trigger
  BEFORE UPDATE ON gc_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_gc_contacts_updated_at();

-- Create function to bulk import contacts for a GC
CREATE OR REPLACE FUNCTION bulk_import_gc_contacts(
  p_gc_id UUID,
  p_contacts JSONB
)
RETURNS TABLE(
  imported_count INTEGER,
  skipped_count INTEGER,
  errors TEXT[]
) AS $$
DECLARE
  contact JSONB;
  imported INTEGER := 0;
  skipped INTEGER := 0;
  error_list TEXT[] := '{}';
  error_msg TEXT;
BEGIN
  -- Loop through each contact in the JSONB array
  FOR contact IN SELECT * FROM jsonb_array_elements(p_contacts)
  LOOP
    BEGIN
      -- Try to insert the contact
      INSERT INTO gc_contacts (
        gc_id,
        email,
        name,
        company,
        phone,
        trade_category,
        location,
        notes
      ) VALUES (
        p_gc_id,
        contact->>'email',
        contact->>'name',
        contact->>'company',
        contact->>'phone',
        contact->>'trade_category',
        contact->>'location',
        contact->>'notes'
      );
      
      imported := imported + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Handle duplicate key or other errors
      IF SQLSTATE = '23505' THEN
        skipped := skipped + 1;
        error_msg := 'Skipped duplicate contact: ' || (contact->>'email');
      ELSE
        error_msg := 'Error importing ' || (contact->>'email') || ': ' || SQLERRM;
      END IF;
      
      error_list := array_append(error_list, error_msg);
    END;
  END LOOP;
  
  RETURN QUERY SELECT imported, skipped, error_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
