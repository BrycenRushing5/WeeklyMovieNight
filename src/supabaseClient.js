import { createClient } from '@supabase/supabase-js'

// You find these in Supabase Dashboard -> Project Settings -> API
const supabaseUrl = 'https://eqqxwtubtxawkptitvto.supabase.co'
const supabaseKey = 'sb_publishable_mA-uCK6LSalYCqnzMBAh8A_6ZwjdBrs'

export const supabase = createClient(supabaseUrl, supabaseKey)