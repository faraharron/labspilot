import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://remgndebujykrvysdoid.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbWduZGVidWp5a3J2eXNkb2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjMwNTQsImV4cCI6MjA5MTk5OTA1NH0.qlc9zk03xItRz86-rNrK4j5DGyR_kSQSokrgOcfPMYA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
